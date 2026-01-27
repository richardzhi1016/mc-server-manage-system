import os
import uuid
import subprocess
import threading
import time
import py7zr
import psutil
import urllib.request
import json
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

servers_bp = Blueprint("servers", __name__, url_prefix="/api")
socketio: SocketIO | None = None


def set_socketio(sio: SocketIO) -> None:
    global socketio
    socketio = sio


class LogWatcher:
    def __init__(
        self, server_name: str, log_file_path: str, socketio_instance: SocketIO
    ):
        self.server_name = server_name
        self.log_file_path = log_file_path
        self.socketio = socketio_instance
        self.running = False
        self.thread = None
        self.file_position = 0
        self._stop_event = threading.Event()

    def _read_last_lines(self, num_lines: int = 1000) -> list[str]:
        try:
            if not os.path.exists(self.log_file_path):
                return []
            with open(self.log_file_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
                return lines[-num_lines:] if len(lines) > num_lines else lines
        except Exception:
            return []

    def _emit_log_line(self, line: str) -> None:
        timestamp = datetime.now().isoformat()
        level = parse_log_level(line)
        clean_line = line.strip()
        self.socketio.emit(
            "log_message",
            {
                "timestamp": timestamp,
                "level": level,
                "message": clean_line,
                "server": self.server_name,
            },
            to=self.server_name,
        )

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self.thread = threading.Thread(target=self._watch_loop, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.running = False
        self._stop_event.set()
        if self.thread:
            self.thread.join(timeout=2)

    def _watch_loop(self) -> None:
        initial_lines = self._read_last_lines(1000)
        for line in initial_lines:
            if line.strip():
                self._emit_log_line(line)
        try:
            with open(self.log_file_path, "r", encoding="utf-8", errors="replace") as f:
                f.seek(0, os.SEEK_END)
                self.file_position = f.tell()
                while not self._stop_event.is_set():
                    line = f.readline()
                    if line:
                        self._emit_log_line(line)
                    else:
                        time.sleep(0.1)
        except FileNotFoundError:
            pass
        except Exception:
            pass


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
            import shutil

            for item in os.listdir(single_path):
                shutil.move(os.path.join(single_path, item), server_dir)
            os.rmdir(single_path)

    is_valid, result = validate_server_structure(server_dir)
    if not is_valid:
        import shutil

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
    try:
        process = subprocess.Popen(
            ["java", "-jar", jar_path, "nogui"],
            cwd=server_dir,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        server_manager.running_servers[server_name] = process
        log_file = str(config.get_logs_dir(server_name) / "latest.log")
        if server_name not in server_manager.log_watchers and socketio:
            server_manager.log_watchers[server_name] = LogWatcher(
                server_name, log_file, socketio
            )
        server_manager.log_watchers[server_name].start()
        if socketio:
            socketio.emit(
                "server_started", {"server_name": server_name, "pid": process.pid}
            )
        return jsonify(
            {
                "message": f"Server '{server_name}' started",
                "jar_file": jar_file,
                "pid": process.pid,
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
    process = server_manager.running_servers[server_name]

    try:
        process.terminate()
        try:
            process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        if server_name in server_manager.log_watchers:
            server_manager.log_watchers[server_name].stop()
            del server_manager.log_watchers[server_name]
        del server_manager.running_servers[server_name]
        if socketio:
            socketio.emit("server_stopped", {"server_name": server_name})
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
    process = server_manager.running_servers[server_name]
    try:
        process.stdin.write(command + "\n")
        process.stdin.flush()
        return True, "Command sent"
    except Exception as e:
        return False, str(e)


@servers_bp.route("/servers", methods=["GET"])
def list_servers():
    servers_dir = str(config.upload_folder)
    if not os.path.exists(servers_dir):
        return jsonify({"servers": []}), 200
    servers = []
    for name in os.listdir(servers_dir):
        server_dir = os.path.join(servers_dir, name)
        if os.path.isdir(server_dir):
            jar = find_server_jar(server_dir)
            servers.append(
                {
                    "name": name,
                    "status": "running"
                    if server_manager.is_server_running(name)
                    else "stopped",
                    "jar_file": jar,
                }
            )
    return jsonify({"servers": servers}), 200


@servers_bp.route("/servers", methods=["POST"])
def create_server_instance():
    """Create a new server instance in the database."""
    import sqlite3

    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"error": "Missing 'name' parameter"}), 400

    id = str(uuid.uuid4())
    name = data["name"]
    server_type = data.get("type")
    version = data.get("version")
    port = data.get("port")

    try:
        conn = sqlite3.connect(str(config.database_path))
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO server_instance (id, name, server_type, version, port) VALUES (?, ?, ?, ?, ?)",
            (id, name, server_type, version, port),
        )
        conn.commit()
        cursor.execute("SELECT * FROM server_instance WHERE id = ?", (id,))
        server = dict(cursor.fetchone()) if cursor.fetchone() else None
        conn.close()
        return jsonify({"message": f"Server '{name}' created", "server": server}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": f"Server '{name}' already exists"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@servers_bp.route("/servers/create", methods=["POST"])
def create_server():
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    server_name = data["server_name"]
    server_dir = str(config.get_server_dir(server_name))
    if os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' already exists"}), 409
    try:
        os.makedirs(server_dir, exist_ok=True)
        jar_file = "server.jar"
        with open(os.path.join(server_dir, jar_file), "w") as f:
            f.write("# Placeholder - download actual server jar")
        with open(os.path.join(server_dir, "eula.txt"), "w") as f:
            f.write("eula=true\n")
        return jsonify(
            {"message": f"Server '{server_name}' created", "server_dir": server_dir}
        ), 200
    except Exception as e:
        import shutil

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
        import shutil

        shutil.rmtree(server_dir)
        return jsonify({"message": f"Server '{server_name}' deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
