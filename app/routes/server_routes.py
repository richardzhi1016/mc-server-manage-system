import json
import logging
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

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
    update_server_properties_port,
)
from app.services.tps_monitor import start_monitor, stop_monitor, get_monitor, ServerType
from app.services import alert_service as _alert_svc
from app.services.player_analytics import player_analytics_service

logger = logging.getLogger(__name__)

ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
_PLAYER_JOIN = re.compile(r"(\w+) joined the game")
_PLAYER_LEAVE = re.compile(r"(\w+) left the game")

servers_bp = Blueprint("servers", __name__, url_prefix="/api")
socketio: SocketIO | None = None


def set_socketio(sio: SocketIO) -> None:
    global socketio
    socketio = sio


def _find_forge_args_file(server_dir: str) -> str | None:
    """Find the Forge launch args file from run.sh or run.bat (modern Forge 1.17+)."""
    script = "run.bat" if sys.platform == "win32" else "run.sh"
    run_script_path = os.path.join(server_dir, script)
    if not os.path.exists(run_script_path):
        return None
    try:
        with open(run_script_path, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r'@(libraries[^\s]+(?:unix|win)_args\.txt)', content)
        if match:
            return os.path.join(server_dir, match.group(1).replace("/", os.sep))
    except Exception:
        pass
    return None


def _write_forge_jvm_args(jvm_args_path: str, min_mem: int, max_mem: int, jvm_flags: list) -> None:
    """Write JVM memory settings to user_jvm_args.txt for modern Forge servers."""
    lines = [f"-Xms{min_mem}m", f"-Xmx{max_mem}m"] + list(jvm_flags)
    with open(jvm_args_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def _server_has_launch_files(server_dir: str) -> bool:
    """Check if server directory has the necessary files to start (JAR or Forge run script)."""
    if _find_forge_args_file(server_dir):
        return True
    return find_server_jar(server_dir) is not None


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
            # Track online players from log events
            if m := _PLAYER_JOIN.search(clean_line):
                username = m.group(1)
                server_manager.player_joined(self.server_name, username)
                player_analytics_service.record_join(self.server_name, username)
            elif m := _PLAYER_LEAVE.search(clean_line):
                username = m.group(1)
                server_manager.player_left(self.server_name, username)
                player_analytics_service.record_leave(self.server_name, username)

            # Route line to TPS monitor
            _monitor = get_monitor(self.server_name)
            if _monitor:
                _monitor.handle_log_line(clean_line)

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

            player_analytics_service.close_all_sessions(self.server_name)
            server_manager.clear_players(self.server_name)
            stop_monitor(self.server_name)
            # Only alert if this was not a clean stop (server still in running_servers = unexpected exit)
            if self.server_name in server_manager.running_servers:
                _alert_svc.send(self.server_name, _alert_svc.AlertEvent.server_crashed(self.server_name))
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
            player_analytics_service.close_all_sessions(self.server_name)
            server_manager.clear_players(self.server_name)
            stop_monitor(self.server_name)
            # Only alert if this was not a clean stop (server still in running_servers = unexpected exit)
            if self.server_name in server_manager.running_servers:
                _alert_svc.send(self.server_name, _alert_svc.AlertEvent.server_crashed(self.server_name))
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


def _get_server_type_from_db(server_name: str) -> str:
    """Query DB for server_type of the given server. Returns lowercase string."""
    try:
        with sqlite3.connect(str(config.database_path)) as conn:
            row = conn.execute(
                "SELECT server_type FROM server_instance WHERE name = ?",
                (server_name,),
            ).fetchone()
        return (row[0] or "vanilla").lower() if row else "vanilla"
    except Exception as e:
        logger.warning("Failed to query server_type for %s: %s", server_name, e)
        return "vanilla"


def _start_server_internal(server_name: str) -> tuple[bool, str]:
    """Core start logic. Returns (success, message). Called by route and scheduler."""
    server_dir = str(config.get_server_dir(server_name))

    if not os.path.exists(server_dir):
        return False, f"Server directory '{server_name}' not found"
    if server_manager.is_server_running(server_name):
        return False, f"Server '{server_name}' is already running"

    settings_path = os.path.join(server_dir, "startup_settings.json")
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                startup = json.loads(f.read())
        except Exception:
            startup = {}
    else:
        startup = {}
    min_mem = startup.get("min_memory", config.default_min_memory)
    max_mem = startup.get("max_memory", config.default_max_memory)
    jvm_flags = startup.get("jvm_flags", [])

    # Detect modern Forge (1.17+) which uses @args files instead of a root JAR
    forge_args_file = _find_forge_args_file(server_dir)
    if forge_args_file:
        jvm_args_path = os.path.join(server_dir, "user_jvm_args.txt")
        _write_forge_jvm_args(jvm_args_path, min_mem, max_mem, jvm_flags)
        rel_args = os.path.relpath(forge_args_file, server_dir)
        command = ["java", "@user_jvm_args.txt", f"@{rel_args}", "nogui"]
    else:
        jar_file = find_server_jar(server_dir)
        if not jar_file:
            return False, "No JAR file found"
        jar_path = os.path.join(server_dir, jar_file)
        command = [
            "java",
            f"-Xms{min_mem}m",
            f"-Xmx{max_mem}m",
            *jvm_flags,
            "-jar", jar_path, "nogui",
        ]

    if not socketio:
        return False, "SocketIO not available"

    try:
        if server_name in server_manager.running_servers:
            server_manager.running_servers[server_name].stop()

        watcher = PTYProcessWatcher(server_name, command, server_dir, socketio)
        success, pid, error = watcher.start()
        if not success:
            return False, f"Failed to start server: {error}"

        server_manager.running_servers[server_name] = watcher

        # Record server start time for uptime tracking
        try:
            import sqlite3 as _sq3
            from datetime import timezone as _tz
            with _sq3.connect(str(config.database_path)) as _conn:
                _conn.execute(
                    "UPDATE server_instance SET started_at = ? WHERE name = ?",
                    (datetime.now(_tz.utc).isoformat(), server_name)
                )
        except Exception as _e:
            logger.warning("Failed to record started_at for %s: %s", server_name, _e)

        # Detect server type and start TPS monitor
        _server_type_str = _get_server_type_from_db(server_name)
        if _server_type_str == "paper":
            _tps_type = ServerType.PAPER
        elif _server_type_str in ("fabric", "forge"):
            _tps_type = ServerType.SPARK
        else:
            _tps_type = ServerType.VANILLA
        start_monitor(server_name, _tps_type, socketio, watcher)

        socketio.emit(
            "server_started", {"server_name": server_name, "pid": pid},
            room=server_name,
            namespace="/",
        )
        return True, f"Server '{server_name}' started"
    except Exception as e:
        return False, f"Failed to start server: {str(e)}"


def _stop_server_internal(server_name: str) -> tuple[bool, str]:
    """Core stop logic. Returns (success, message). Called by route and scheduler."""
    if server_name not in server_manager.running_servers:
        return False, f"Server '{server_name}' is not running"

    watcher = server_manager.running_servers[server_name]

    try:
        from app.services.backup_service import backup_service
        if server_name in backup_service._active_backups:
            backup_info = backup_service._active_backups[server_name]
            if backup_info.get("save_disabled"):
                watcher.write_input("save-on\r\n")
                time.sleep(0.5)
    except Exception:
        pass

    try:
        watcher.write_input("stop\r\n")

        for _ in range(60):
            if not watcher.is_alive():
                break
            time.sleep(0.5)

        if watcher.is_alive() and watcher.pid:
            try:
                proc = psutil.Process(watcher.pid)
                for child in proc.children(recursive=True):
                    child.kill()
                proc.kill()
            except psutil.NoSuchProcess:
                pass

        stop_monitor(server_name)
        watcher.stop()
        del server_manager.running_servers[server_name]
        player_analytics_service.close_all_sessions(server_name)
        try:
            import sqlite3 as _sq3
            from datetime import timezone as _tz
            with _sq3.connect(str(config.database_path)) as _conn:
                _conn.execute(
                    "UPDATE server_instance SET started_at = NULL WHERE name = ?",
                    (server_name,)
                )
        except Exception as _e:
            logger.warning("Failed to clear started_at for %s: %s", server_name, _e)
        server_manager.clear_players(server_name)

        if socketio:
            socketio.emit("server_stopped", {"server_name": server_name}, room=server_name, namespace="/")
        return True, f"Server '{server_name}' stopped"
    except Exception as e:
        return False, f"Failed to stop server: {str(e)}"


@servers_bp.route("/start-server", methods=["POST"])
def start_server():
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    server_name = data["server_name"]

    # Pre-check for specific error codes
    server_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server directory '{server_name}' not found"}), 404
    if server_manager.is_server_running(server_name):
        return jsonify({"error": f"Server '{server_name}' is already running"}), 409
    if not _server_has_launch_files(server_dir):
        return jsonify({"error": "No server launch files found"}), 404

    success, message = _start_server_internal(server_name)
    if not success:
        return jsonify({"error": message}), 500

    watcher = server_manager.running_servers.get(server_name)
    pid = watcher.pid if watcher else None
    jar_file = find_server_jar(server_dir) or ""
    return jsonify({"message": message, "jar_file": jar_file, "pid": pid}), 200


@servers_bp.route("/stop-server", methods=["POST"])
def stop_server():
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    server_name = data["server_name"]

    if server_name not in server_manager.running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    success, message = _stop_server_internal(server_name)
    if not success:
        return jsonify({"error": message}), 500
    return jsonify({"message": message}), 200


@servers_bp.route("/server-status", methods=["GET"])
def server_status():
    return jsonify(server_manager.get_running_servers()), 200


@servers_bp.route("/server-metrics", methods=["GET"])
def get_server_metrics():
    server_name = request.args.get("server_name")
    try:
        disk = psutil.disk_usage(str(config.servers_dir))
        metrics = {
            "cpu": psutil.cpu_percent(interval=0.1),
            "memory_used": psutil.virtual_memory().used,
            "memory_total": psutil.virtual_memory().total,
            "disk_used": disk.used,
            "disk_total": disk.total,
            "players_online": 0,
            "players_max": 20,
            "timestamp": datetime.now().isoformat(),
        }
        if server_name and server_name in server_manager.running_servers:
            sp = psutil.Process(server_manager.running_servers[server_name].pid)
            metrics["memory_used"] = sp.memory_info().rss
            metrics["cpu"] = sp.cpu_percent(interval=0.1)
            metrics["players_online"] = len(server_manager.online_players.get(server_name, set()))
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


@servers_bp.route("/fabric/game-versions", methods=["GET"])
def get_fabric_game_versions():
    """Fetch Fabric-supported Minecraft game versions from Fabric Meta API."""
    try:
        url = f"{config.fabric_meta_url}/v2/versions/game"
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        return jsonify(data), 200
    except Exception as e:
        logger.error("Failed to fetch Fabric game versions: %s", e)
        return jsonify({"error": f"Failed to fetch Fabric game versions: {str(e)}"}), 500


@servers_bp.route("/fabric/loader-versions", methods=["GET"])
def get_fabric_loader_versions():
    """Fetch available Fabric loader versions from Fabric Meta API."""
    try:
        url = f"{config.fabric_meta_url}/v2/versions/loader"
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        return jsonify(data), 200
    except Exception as e:
        logger.error("Failed to fetch Fabric loader versions: %s", e)
        return jsonify({"error": f"Failed to fetch Fabric loader versions: {str(e)}"}), 500


@servers_bp.route("/fabric/installer-versions", methods=["GET"])
def get_fabric_installer_versions():
    """Fetch available Fabric installer versions from Fabric Meta API."""
    try:
        url = f"{config.fabric_meta_url}/v2/versions/installer"
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        return jsonify(data), 200
    except Exception as e:
        logger.error("Failed to fetch Fabric installer versions: %s", e)
        return jsonify({"error": f"Failed to fetch Fabric installer versions: {str(e)}"}), 500


_forge_versions_cache: dict[str, list[str]] = {}
_FORGE_PROMOTIONS_URL = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json"
_forge_promotions_cache: dict | None = None


def _get_forge_promotions() -> dict:
    """Fetch and cache the Forge promotions slim JSON (latest/recommended per MC version)."""
    global _forge_promotions_cache
    if _forge_promotions_cache is not None:
        return _forge_promotions_cache
    req = urllib.request.Request(
        _FORGE_PROMOTIONS_URL,
        headers={"User-Agent": "mc-server-manager/1.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _forge_promotions_cache = data
    return data


def _fetch_forge_versions(mc_version: str) -> list[str]:
    """Return Forge version strings for a given MC version, newest first."""
    # 1. Try the promotions API first (small JSON, fast)
    try:
        promos = _get_forge_promotions().get("promos", {})
        versions: list[str] = []
        seen: set[str] = set()
        for suffix in ("latest", "recommended"):
            key = f"{mc_version}-{suffix}"
            if key in promos and promos[key] not in seen:
                versions.append(promos[key])
                seen.add(promos[key])
        if versions:
            return versions
    except Exception as e:
        logger.warning("Forge promotions API failed (%s), falling back to Maven", e)

    # 2. Fallback: Maven metadata XML (full list, ~500 KB)
    url = f"{config.forge_maven_url}/net/minecraftforge/forge/maven-metadata.xml"
    req = urllib.request.Request(url, headers={"User-Agent": "mc-server-manager/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        xml_data = resp.read().decode("utf-8")
    root = ET.fromstring(xml_data)
    versioning = root.find("versioning")
    versions = []
    if versioning is not None:
        versions_elem = versioning.find("versions")
        if versions_elem is not None:
            prefix = f"{mc_version}-"
            for v in versions_elem.findall("version"):
                if v.text and v.text.startswith(prefix):
                    forge_ver = v.text[len(prefix):]
                    if not any(tag in forge_ver for tag in ("-rc", "-beta", "alpha")):
                        versions.append(forge_ver)
    versions.reverse()
    return versions


@servers_bp.route("/forge/versions", methods=["GET"])
def get_forge_versions():
    """Fetch available Forge versions for a given Minecraft version."""
    mc_version = request.args.get("mc_version")
    if not mc_version:
        return jsonify({"error": "mc_version parameter is required"}), 400
    if mc_version in _forge_versions_cache:
        return jsonify({"versions": _forge_versions_cache[mc_version]}), 200
    try:
        versions = _fetch_forge_versions(mc_version)
        _forge_versions_cache[mc_version] = versions
        return jsonify({"versions": versions}), 200
    except Exception as e:
        logger.error("Failed to fetch Forge versions for %s: %s", mc_version, e)
        return jsonify({"error": f"Failed to fetch Forge versions: {str(e)}"}), 500


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
    loader_version = data.get("loader_version")
    installer_version = data.get("installer_version")
    port = data.get("port")

    server_dir = config.get_server_dir(name)
    if os.path.exists(server_dir):
        return jsonify({"error": f"Server directory '{name}' already exists"}), 409

    try:
        os.makedirs(server_dir, exist_ok=True)

        def report_progress(block_num: int, block_size: int, total_size: int) -> None:
            if total_size > 0 and socketio:
                progress = min(100, int(block_num * block_size * 100 / total_size))
                socketio.emit("download_progress", {
                    "server_name": name,
                    "progress": progress,
                    "downloaded": min(block_num * block_size, total_size),
                    "total": total_size
                })

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
                urllib.request.urlretrieve(server_jar_url, jar_path, report_progress)
            except Exception as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to download server.jar: {str(e)}"}), 500

        elif server_type == "fabric":
            if not version:
                shutil.rmtree(server_dir)
                return jsonify({"error": "Minecraft version is required for Fabric server"}), 400

            try:
                # Resolve loader version if not provided
                if not loader_version:
                    loader_url = f"{config.fabric_meta_url}/v2/versions/loader"
                    with urllib.request.urlopen(loader_url, timeout=10) as resp:
                        loader_data = json.loads(resp.read().decode("utf-8"))
                    stable_loaders = [v for v in loader_data if v.get("stable")]
                    if not stable_loaders:
                        shutil.rmtree(server_dir)
                        return jsonify({"error": "No stable Fabric loader version found"}), 500
                    loader_version = stable_loaders[0]["version"]

                # Resolve installer version if not provided
                if not installer_version:
                    installer_url = f"{config.fabric_meta_url}/v2/versions/installer"
                    with urllib.request.urlopen(installer_url, timeout=10) as resp:
                        installer_data = json.loads(resp.read().decode("utf-8"))
                    stable_installers = [v for v in installer_data if v.get("stable")]
                    if not stable_installers:
                        shutil.rmtree(server_dir)
                        return jsonify({"error": "No stable Fabric installer version found"}), 500
                    installer_version = stable_installers[0]["version"]

                # Construct direct server JAR download URL (encode path segments)
                encoded_version = urllib.parse.quote(version, safe="")
                encoded_loader = urllib.parse.quote(loader_version, safe="")
                encoded_installer = urllib.parse.quote(installer_version, safe="")
                fabric_jar_url = (
                    f"{config.fabric_meta_url}/v2/versions/loader"
                    f"/{encoded_version}/{encoded_loader}/{encoded_installer}/server/jar"
                )

                jar_path = os.path.join(str(server_dir), "fabric-server-launch.jar")
                urllib.request.urlretrieve(fabric_jar_url, jar_path, report_progress)

            except urllib.error.HTTPError as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to download Fabric server JAR: HTTP {e.code}"}), 500
            except Exception as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to download Fabric server JAR: {str(e)}"}), 500

        elif server_type == "forge":
            if not version:
                shutil.rmtree(server_dir)
                return jsonify({"error": "Minecraft version is required for Forge server"}), 400
            if not loader_version:
                shutil.rmtree(server_dir)
                return jsonify({"error": "Forge loader version is required"}), 400

            forge_full_version = f"{version}-{loader_version}"
            encoded_full = urllib.parse.quote(forge_full_version, safe="")
            installer_filename = f"forge-{forge_full_version}-installer.jar"
            installer_url = (
                f"{config.forge_maven_url}/net/minecraftforge/forge"
                f"/{encoded_full}/{installer_filename}"
            )
            installer_path = os.path.join(str(server_dir), installer_filename)

            try:
                # maven.minecraftforge.net requires a User-Agent header (returns 403 without one)
                req = urllib.request.Request(
                    installer_url, headers={"User-Agent": "mc-server-manager/1.0"}
                )
                with urllib.request.urlopen(req, timeout=300) as resp:
                    total_size = int(resp.headers.get("Content-Length", 0))
                    downloaded = 0
                    chunk_size = 8192
                    with open(installer_path, "wb") as f:
                        while True:
                            chunk = resp.read(chunk_size)
                            if not chunk:
                                break
                            f.write(chunk)
                            downloaded += len(chunk)
                            report_progress(downloaded // chunk_size, chunk_size, total_size)
            except urllib.error.HTTPError as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to download Forge installer: HTTP {e.code}"}), 500
            except Exception as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to download Forge installer: {str(e)}"}), 500

            if socketio:
                socketio.emit("forge_installing", {"server_name": name})

            try:
                result = subprocess.run(
                    [
                        "java",
                        "-Xmx512m",
                        "-Djava.awt.headless=true",  # Prevent GUI dialogs on Windows
                        "-jar", installer_path,
                        "--installServer",
                    ],
                    cwd=server_dir,
                    capture_output=True,
                    text=True,
                    timeout=900,  # 15 min — downloads Minecraft server + all libraries
                )
            except subprocess.TimeoutExpired:
                shutil.rmtree(server_dir)
                return jsonify({"error": "Forge installer timed out (15 min limit)"}), 500
            except FileNotFoundError:
                shutil.rmtree(server_dir)
                return jsonify({"error": "Java not found. Please install Java 17+ and ensure it is in your PATH."}), 500
            except Exception as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to run Forge installer: {str(e)}"}), 500

            # Clean up installer and its log
            for cleanup_path in [installer_path, f"{installer_path}.log"]:
                if os.path.exists(cleanup_path):
                    os.remove(cleanup_path)

            if result.returncode != 0:
                shutil.rmtree(server_dir)
                # Prefer stderr; fall back to last 500 chars of stdout
                error_output = (result.stderr or result.stdout or "")[-600:] or "(no output)"
                return jsonify({"error": f"Forge installer failed: {error_output}"}), 500

        elif server_type == "paper":
            if not version:
                shutil.rmtree(server_dir)
                return jsonify({"error": "Minecraft version is required for Paper server"}), 400

            try:
                encoded_version = urllib.parse.quote(version, safe="")
                builds_url = f"{config.papermc_api_url}/projects/paper/versions/{encoded_version}/builds"

                with urllib.request.urlopen(builds_url, timeout=10) as resp:
                    builds_data = json.loads(resp.read().decode("utf-8"))

                builds = builds_data.get("builds", [])
                if not builds:
                    shutil.rmtree(server_dir)
                    return jsonify({"error": f"No Paper builds found for Minecraft {version}"}), 404

                latest_build = builds[-1]
                build_number = latest_build["build"]
                jar_filename = latest_build["downloads"]["application"]["name"]

                jar_url = (
                    f"{config.papermc_api_url}/projects/paper/versions/{encoded_version}"
                    f"/builds/{build_number}/downloads/{jar_filename}"
                )

                jar_path = os.path.join(str(server_dir), jar_filename)
                urllib.request.urlretrieve(jar_url, jar_path, report_progress)

            except urllib.error.HTTPError as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to download Paper server JAR: HTTP {e.code}"}), 500
            except Exception as e:
                shutil.rmtree(server_dir)
                return jsonify({"error": f"Failed to download Paper server JAR: {str(e)}"}), 500

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


_clone_lock = threading.Lock()


def _find_next_available_port() -> int | None:
    """Return the next unused port starting from 25565, or None if exhausted."""
    with sqlite3.connect(str(config.database_path)) as conn:
        rows = conn.execute(
            "SELECT port FROM server_instance WHERE port IS NOT NULL"
        ).fetchall()
    used_ports = {row[0] for row in rows}
    port = 25565
    while port in used_ports:
        port += 1
    return port if port <= 65535 else None


def _ignore_lock_files(directory: str, files: list[str]) -> list[str]:
    """Ignore session.lock files during shutil.copytree to avoid conflicts."""
    return [f for f in files if f == "session.lock"]


@servers_bp.route("/servers/next-available-port", methods=["GET"])
def get_next_available_port():
    """Get the next available port number not used by any server."""
    port = _find_next_available_port()
    if port is None:
        return jsonify({"error": "No available ports"}), 500
    return jsonify({"port": port}), 200


@servers_bp.route("/servers/<server_name>/clone", methods=["POST"])
def clone_server(server_name: str):
    """Clone an existing server to a new name with a new port."""
    data = request.get_json()
    if not data or "new_name" not in data:
        return jsonify({"error": "Missing 'new_name' parameter"}), 400

    # Validate source server name: reject path traversal attempts
    if ".." in server_name or "/" in server_name or "\\" in server_name:
        return jsonify({"error": "Invalid source server name"}), 400

    new_name = data["new_name"].strip()
    if not new_name:
        return jsonify({"error": "Server name cannot be empty"}), 400

    if len(new_name) > 64:
        return jsonify({"error": "Server name must be 64 characters or less"}), 400

    # Validate new name is filesystem-safe
    safe_name = secure_filename(new_name)
    if not safe_name or safe_name != new_name:
        return jsonify({"error": "Server name contains invalid characters"}), 400

    # Check source server exists in database
    with sqlite3.connect(str(config.database_path)) as conn:
        conn.row_factory = sqlite3.Row
        source_row = conn.execute(
            "SELECT * FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()

    if not source_row:
        return jsonify({"error": f"Source server '{server_name}' not found in database"}), 404

    # Check source server exists on filesystem
    source_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(source_dir):
        return jsonify({"error": f"Source server '{server_name}' directory not found"}), 404

    # Port handling
    new_port = data.get("new_port")
    if new_port is not None:
        try:
            new_port = int(new_port)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid port number"}), 400
        if new_port < 1024 or new_port > 65535:
            return jsonify({"error": "Port must be between 1024 and 65535"}), 400
    else:
        new_port = _find_next_available_port()
        if new_port is None:
            return jsonify({"error": "No available ports found"}), 500

    # Warn if source server is running (but allow cloning)
    warning = None
    if server_manager.is_server_running(server_name):
        warning = "Source server is currently running. Cloned world data may be inconsistent."

    # Serialize clone operations to prevent race conditions
    with _clone_lock:
        # Check new name is not taken (filesystem)
        dest_dir = str(config.get_server_dir(new_name))
        if os.path.exists(dest_dir):
            return jsonify({"error": f"Server directory '{new_name}' already exists"}), 409

        # Check new name is not taken (database)
        with sqlite3.connect(str(config.database_path)) as conn:
            existing = conn.execute(
                "SELECT id FROM server_instance WHERE name = ?", (new_name,)
            ).fetchone()
        if existing:
            return jsonify({"error": f"Server '{new_name}' already exists in database"}), 409

        # Check port not already in use by another server
        with sqlite3.connect(str(config.database_path)) as conn:
            port_check = conn.execute(
                "SELECT name FROM server_instance WHERE port = ?", (new_port,)
            ).fetchone()
        if port_check:
            return jsonify(
                {"error": f"Port {new_port} is already used by server '{port_check[0]}'"}
            ), 409

        # Copy server files (excluding session.lock)
        try:
            shutil.copytree(source_dir, dest_dir, ignore=_ignore_lock_files)
        except Exception as e:
            return jsonify({"error": f"Failed to copy server files: {str(e)}"}), 500

        # Update server.properties with the new port
        port_updated = update_server_properties_port(dest_dir, new_port)
        if not port_updated:
            logger.warning(
                "Could not update server.properties for cloned server '%s'. "
                "Port may conflict with source server.",
                new_name,
            )
            if warning is None:
                warning = "server.properties could not be updated with the new port. Please update it manually."
            else:
                warning += " Also, server.properties could not be updated with the new port."

        # Insert new database record
        new_id = str(uuid.uuid4())
        try:
            with sqlite3.connect(str(config.database_path)) as conn:
                conn.execute(
                    "INSERT INTO server_instance (id, name, server_type, version, port) VALUES (?, ?, ?, ?, ?)",
                    (new_id, new_name, source_row["server_type"], source_row["version"], new_port),
                )
                conn.commit()
        except sqlite3.IntegrityError:
            if os.path.exists(dest_dir):
                shutil.rmtree(dest_dir)
            return jsonify({"error": f"Server '{new_name}' already exists in database"}), 409
        except Exception as e:
            if os.path.exists(dest_dir):
                shutil.rmtree(dest_dir)
            return jsonify({"error": f"Database error: {str(e)}"}), 500

    server = {
        "id": new_id,
        "name": new_name,
        "server_type": source_row["server_type"],
        "version": source_row["version"],
        "port": new_port,
    }

    response = {
        "message": f"Server '{new_name}' cloned from '{server_name}' successfully",
        "server": server,
    }
    if warning:
        response["warning"] = warning

    return jsonify(response), 201
