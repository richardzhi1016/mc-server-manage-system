import json
import logging
import os
import re
import shutil
import sqlite3
import subprocess
import threading
import time
import uuid
import urllib.request

import psutil
import py7zr
from datetime import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO

from app.config import config
from app.services.server_manager import (
    server_manager,
    validate_server_structure,
    find_server_jar,
    parse_log_level,
)

logger = logging.getLogger(__name__)

ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

servers_bp = Blueprint("servers", __name__, url_prefix="/api")
socketio: SocketIO | None = None


def set_socketio(sio: SocketIO) -> None:
    global socketio
    socketio = sio


class PTYProcessWatcher:
    """Uses pseudo-terminal (PTY) to run Java process with line buffering.

    Solves the Java stdout block buffering issue by using a PTY, which makes
    Java think it's writing to a terminal, forcing line buffering.
    """

    def __init__(
        self, server_name: str, command: list[str], cwd: str, socketio_instance: SocketIO
    ):
        self.server_name = server_name
        self.command = command
        self.cwd = cwd
        self.socketio = socketio_instance
        self.running = False
        self.pid = None
        self.thread = None
        self._stop_event = threading.Event()
        self.pty_process = None

    def _emit_log_line(self, line: str) -> None:
        timestamp = datetime.now().isoformat()
        clean_line = ANSI_ESCAPE.sub('', line).strip()
        if clean_line:
            level = parse_log_level(clean_line)
            self.socketio.emit(
                "log_message",
                {
                    "timestamp": timestamp,
                    "level": level,
                    "message": clean_line,
                    "server": self.server_name,
                },
                room=self.server_name,
                namespace="/",
            )

    def start(self) -> tuple[bool, int | None, str]:
        """Start the PTY process and return (success, pid, error_message)."""
        if self.running:
            return False, None, "Already running"

        try:
            if os.name == 'nt':
                return self._start_windows()
            else:
                return self._start_unix()
        except Exception as e:
            logger.error("PTY start error: %s", e)
            return False, None, str(e)

    def _start_windows(self) -> tuple[bool, int | None, str]:
        import winpty

        cmd_str = subprocess.list2cmdline(self.command)
        self.pty_process = winpty.PTY(80, 24)
        self.pty_process.spawn(cmd_str, cwd=self.cwd)

        self.pid = self.pty_process.pid
        logger.info("PTY process started with PID %d", self.pid)

        self.running = True
        self._stop_event.clear()
        self.thread = threading.Thread(target=self._watch_loop_windows, daemon=True)
        self.thread.start()

        return True, self.pid, ""

    def _start_unix(self) -> tuple[bool, int | None, str]:
        import pty

        master_fd, slave_fd = pty.openpty()

        self.pty_process = subprocess.Popen(
            self.command,
            cwd=self.cwd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
        )
        os.close(slave_fd)

        self.master_fd = master_fd
        self.pid = self.pty_process.pid

        self.running = True
        self._stop_event.clear()
        self.thread = threading.Thread(target=self._watch_loop_unix, daemon=True)
        self.thread.start()

        return True, self.pid, ""

    def stop(self) -> None:
        """Stop the PTY process. Does NOT send 'stop' command -- caller should do that."""
        self.running = False
        self._stop_event.set()

        try:
            if os.name != 'nt' and self.pty_process:
                self.pty_process.terminate()
                try:
                    self.pty_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.pty_process.kill()
        except Exception as e:
            logger.error("PTY stop error: %s", e)

        if self.thread:
            self.thread.join(timeout=2)

    def write_input(self, data: str) -> bool:
        """Write data to the PTY stdin."""
        try:
            if os.name == 'nt' and self.pty_process:
                self.pty_process.write(data)
                return True
            elif hasattr(self, 'master_fd'):
                os.write(self.master_fd, data.encode('utf-8'))
                return True
        except Exception as e:
            logger.error("PTY write error: %s", e)
        return False

    def is_alive(self) -> bool:
        """Check if the PTY process is still running."""
        try:
            if os.name == 'nt' and self.pty_process:
                return self.pty_process.isalive()
            elif self.pty_process:
                return self.pty_process.poll() is None
        except Exception:
            pass
        return False

    def _watch_loop_windows(self) -> None:
        """Read output from Windows PTY."""
        try:
            logger.info("PTYProcessWatcher (Windows) started for %s", self.server_name)
            buffer = ""

            while not self._stop_event.is_set() and self.pty_process.isalive():
                try:
                    data = self.pty_process.read(blocking=False)
                    if data:
                        buffer += data
                        while '\n' in buffer:
                            line, buffer = buffer.split('\n', 1)
                            line = line.rstrip('\r')
                            if line:
                                self._emit_log_line(line)
                    else:
                        time.sleep(0.05)
                except Exception as e:
                    error_msg = str(e).lower()
                    if "eof" in error_msg or "closed" in error_msg:
                        logger.info("PTY closed for %s", self.server_name)
                        break
                    logger.error("PTY read error: %s", e)
                    time.sleep(0.1)

            if buffer.strip():
                self._emit_log_line(buffer.strip())

            logger.info("PTYProcessWatcher (Windows) loop ended for %s", self.server_name)
        except Exception as e:
            logger.error("PTYProcessWatcher error: %s", e)
            self._emit_log_line(f"[ERROR] PTY watcher error: {e}")

    def _watch_loop_unix(self) -> None:
        """Read output from Unix PTY."""
        import select

        try:
            logger.info("PTYProcessWatcher (Unix) started for %s", self.server_name)
            buffer = b""

            while not self._stop_event.is_set():
                if self.pty_process.poll() is not None:
                    break

                rlist, _, _ = select.select([self.master_fd], [], [], 0.1)
                if self.master_fd in rlist:
                    try:
                        data = os.read(self.master_fd, 1024)
                        if not data:
                            break
                        buffer += data
                        while b'\n' in buffer:
                            line, buffer = buffer.split(b'\n', 1)
                            line_str = line.decode('utf-8', errors='replace').rstrip('\r')
                            if line_str:
                                self._emit_log_line(line_str)
                    except OSError:
                        break

            if buffer:
                line_str = buffer.decode('utf-8', errors='replace').strip()
                if line_str:
                    self._emit_log_line(line_str)

            os.close(self.master_fd)
            logger.info("PTYProcessWatcher (Unix) loop ended for %s", self.server_name)
        except Exception as e:
            logger.error("PTYProcessWatcher error: %s", e)
            self._emit_log_line(f"[ERROR] PTY watcher error: {e}")


def allowed_file(filename: str | None) -> bool:
    if not filename:
        return False
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in config.allowed_extensions
    )


def extract_7z_file(file_path: str, extract_to: str) -> tuple[bool, str | None]:
    try:
        with py7zr.SevenZipFile(file_path, mode="r") as archive:
            archive.extractall(path=extract_to)
        return True, None
    except Exception as e:
        return False, str(e)


@servers_bp.route("/upload-package", methods=["POST"])
def upload_package():
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify(
            {"error": "File type not allowed. Only 7z and 7zip files are accepted"}
        ), 400

    filename = secure_filename(file.filename) if file.filename else ""
    unique_id = str(uuid.uuid4())
    base_name = os.path.splitext(filename)[0]
    extension = os.path.splitext(filename)[1]
    unique_filename = f"{base_name}_{unique_id}{extension}"
    server_dir = str(config.upload_folder / base_name)

    if os.path.exists(server_dir) and os.listdir(server_dir):
        return jsonify({"error": f'Server directory "{base_name}" already exists'}), 409

    os.makedirs(server_dir, exist_ok=True)
    upload_path = os.path.join(server_dir, unique_filename)
    file.save(upload_path)

    success, error = extract_7z_file(upload_path, server_dir)
    if not success:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        return jsonify({"error": f"Failed to extract file: {error}"}), 500

    if os.path.exists(upload_path):
        os.remove(upload_path)

    items = os.listdir(server_dir)
    if len(items) == 1:
        single = items[0]
        single_path = os.path.join(server_dir, single)
        if os.path.isdir(single_path) and single == base_name:
            for item in os.listdir(single_path):
                shutil.move(os.path.join(single_path, item), server_dir)
            os.rmdir(single_path)

    is_valid, result = validate_server_structure(server_dir)
    if not is_valid:
        if os.path.exists(server_dir):
            shutil.rmtree(server_dir)
        return jsonify(
            {"error": "Invalid server structure", "validation_result": result}
        ), 422

    return jsonify(
        {
            "message": "Package uploaded and extracted successfully",
            "server_directory": server_dir,
        }
    ), 200


@servers_bp.route("/start-server", methods=["POST"])
def start_server():
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    server_name = data["server_name"]
    server_dir = str(config.get_server_dir(server_name))

    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server directory '{server_name}' not found"}), 404
    if server_manager.is_server_running(server_name):
        return jsonify({"error": f"Server '{server_name}' is already running"}), 409

    jar_file = find_server_jar(server_dir)
    if not jar_file:
        return jsonify({"error": "No JAR file found"}), 404

    jar_path = os.path.join(server_dir, jar_file)
    command = ["java", "-jar", jar_path, "nogui"]

    try:
        if not socketio:
            return jsonify({"error": "SocketIO not available"}), 500

        if server_name in server_manager.running_servers:
            server_manager.running_servers[server_name].stop()

        watcher = PTYProcessWatcher(server_name, command, server_dir, socketio)
        success, pid, error = watcher.start()
        if not success:
            return jsonify({"error": f"Failed to start server: {error}"}), 500

        server_manager.running_servers[server_name] = watcher

        socketio.emit(
            "server_started", {"server_name": server_name, "pid": pid},
            room=server_name,
            namespace="/",
        )

        return jsonify(
            {
                "message": f"Server '{server_name}' started",
                "jar_file": jar_file,
                "pid": pid,
            }
        ), 200
    except Exception as e:
        return jsonify({"error": f"Failed to start server: {str(e)}"}), 500


@servers_bp.route("/stop-server", methods=["POST"])
def stop_server():
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    server_name = data["server_name"]

    if server_name not in server_manager.running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    watcher = server_manager.running_servers[server_name]

    try:
        # Send 'stop' command for graceful shutdown
        watcher.write_input("stop\r\n")

        # Wait for graceful shutdown (up to 30 seconds)
        for _ in range(60):
            if not watcher.is_alive():
                break
            time.sleep(0.5)

        # Force kill if still alive
        if watcher.is_alive() and watcher.pid:
            try:
                proc = psutil.Process(watcher.pid)
                for child in proc.children(recursive=True):
                    child.kill()
                proc.kill()
            except psutil.NoSuchProcess:
                pass

        # Clean up watcher thread (stop() no longer sends duplicate 'stop')
        watcher.stop()
        del server_manager.running_servers[server_name]

        if socketio:
            socketio.emit("server_stopped", {"server_name": server_name}, room=server_name, namespace="/")
        return jsonify({"message": f"Server '{server_name}' stopped"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to stop server: {str(e)}"}), 500


@servers_bp.route("/server-status", methods=["GET"])
def server_status():
    return jsonify(server_manager.get_running_servers()), 200


@servers_bp.route("/server-metrics", methods=["GET"])
def get_server_metrics():
    server_name = request.args.get("server_name")
    try:
        metrics = {
            "cpu": psutil.cpu_percent(interval=0.1),
            "memory_used": psutil.virtual_memory().used / (1024 * 1024),
            "memory_total": psutil.virtual_memory().total / (1024 * 1024),
            "timestamp": datetime.now().isoformat(),
        }
        if server_name and server_name in server_manager.running_servers:
            sp = psutil.Process(server_manager.running_servers[server_name].pid)
            metrics["memory_used"] = sp.memory_info().rss / (1024 * 1024)
            metrics["cpu"] = sp.cpu_percent(interval=0.1)
        return jsonify(metrics), 200
    except Exception:
        return jsonify({"error": "Failed to get metrics"}), 500


@servers_bp.route("/server-logs/<server_name>", methods=["GET"])
def get_server_logs(server_name: str):
    log_file = str(config.get_server_dir(server_name) / "logs" / "latest.log")
    if not os.path.exists(log_file):
        return jsonify({"logs": []}), 200
    try:
        with open(log_file, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()[-1000:]
        logs = [
            {
                "timestamp": datetime.now().isoformat(),
                "level": parse_log_level(l),
                "message": l.strip(),
            }
            for l in lines
            if l.strip()
        ]
        return jsonify({"logs": logs}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def send_command_to_server(server_name: str, command: str) -> tuple[bool, str]:
    if server_name not in server_manager.running_servers:
        return False, f"Server '{server_name}' is not running"
    watcher = server_manager.running_servers[server_name]
    try:
        success = watcher.write_input(command + "\r\n")
        if success:
            return True, "Command sent"
        return False, "Failed to write to server"
    except Exception as e:
        return False, str(e)


@servers_bp.route("/servers", methods=["GET"])
def list_servers():
    """List all server instances from database."""
    with sqlite3.connect(str(config.database_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM server_instance").fetchall()

    servers = []
    for row in rows:
        server_name = row["name"]
        servers.append(
            {
                "id": row["id"],
                "name": server_name,
                "server_type": row["server_type"],
                "version": row["version"],
                "port": row["port"],
                "status": "running"
                if server_manager.is_server_running(server_name)
                else "stopped",
            }
        )

    return jsonify({"servers": servers}), 200


@servers_bp.route("/servers", methods=["POST"])
def create_server_instance():
    """Create a new server instance with folder and server.jar download."""
    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"error": "Missing 'name' parameter"}), 400

    server_id = str(uuid.uuid4())
    name = data["name"]
    server_type = data.get("type")
    version = data.get("version")
    version_url = data.get("version_url")
    port = data.get("port")

    server_dir = config.get_server_dir(name)
    if os.path.exists(server_dir):
        return jsonify({"error": f"Server directory '{name}' already exists"}), 409

    try:
        os.makedirs(server_dir, exist_ok=True)

        if version_url and server_type == "vanilla":
            try:
                with urllib.request.urlopen(version_url, timeout=30) as response:
                    version_meta = json.loads(response.read().decode("utf-8"))
            except Exception as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to fetch version metadata: {str(e)}"}), 500

            server_download = version_meta.get("downloads", {}).get("server")
            if not server_download:
                shutil.rmtree(server_dir)
                return jsonify({"error": "No server download available for this version"}), 400

            server_jar_url = server_download.get("url")
            if not server_jar_url:
                shutil.rmtree(server_dir)
                return jsonify({"error": "No server JAR URL found in version metadata"}), 400

            jar_path = os.path.join(str(server_dir), "server.jar")
            try:
                def report_progress(block_num, block_size, total_size):
                    if total_size > 0 and socketio:
                        progress = min(100, int(block_num * block_size * 100 / total_size))
                        socketio.emit("download_progress", {
                            "server_name": name,
                            "progress": progress,
                            "downloaded": min(block_num * block_size, total_size),
                            "total": total_size
                        })

                urllib.request.urlretrieve(server_jar_url, jar_path, report_progress)
            except Exception as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to download server.jar: {str(e)}"}), 500

        eula_path = os.path.join(str(server_dir), "eula.txt")
        with open(eula_path, "w", encoding="utf-8") as f:
            f.write("eula=true\n")

        with sqlite3.connect(str(config.database_path)) as conn:
            conn.row_factory = sqlite3.Row
            conn.execute(
                "INSERT INTO server_instance (id, name, server_type, version, port) VALUES (?, ?, ?, ?, ?)",
                (server_id, name, server_type, version, port),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM server_instance WHERE id = ?", (server_id,)).fetchone()
            server = dict(row) if row else {"id": server_id, "name": name, "server_type": server_type, "version": version, "port": port}

        return jsonify({
            "message": f"Server '{name}' created successfully",
            "server": server
        }), 201

    except sqlite3.IntegrityError:
        if os.path.exists(server_dir):
            shutil.rmtree(server_dir)
        return jsonify({"error": f"Server '{name}' already exists in database"}), 409
    except Exception as e:
        if os.path.exists(server_dir):
            shutil.rmtree(server_dir)
        return jsonify({"error": str(e)}), 500


@servers_bp.route("/servers/<server_name>/delete", methods=["DELETE"])
def delete_server(server_name: str):
    server_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404
    if server_manager.is_server_running(server_name):
        return jsonify({"error": "Server is running, stop it first"}), 400
    try:
        shutil.rmtree(server_dir)

        # Also remove from database
        with sqlite3.connect(str(config.database_path)) as conn:
            conn.execute("DELETE FROM server_instance WHERE name = ?", (server_name,))
            conn.commit()

        return jsonify({"message": f"Server '{server_name}' deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
