import os
import uuid
import subprocess
import threading
import time
import re
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import py7zr
from werkzeug.utils import secure_filename
import logging

app = Flask(__name__)

# Enable CORS for all routes
CORS(app)

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

# Initialize SocketIO with async mode
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")


# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "servers")
ALLOWED_EXTENSIONS = {"7z", "7zip"}
# MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB - 取消文件大小限制

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
# app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE  # 取消文件大小限制

# Store running server processes
running_servers = {}

# Store log file watchers
log_watchers = {}

# Log level patterns in Minecraft logs
LOG_LEVEL_PATTERNS = {
    "ERROR": r"\[.*ERROR.*\]",
    "WARN": r"\[.*WARN.*\]",
    "INFO": r"\[.*INFO.*\]",
    "DEBUG": r"\[.*DEBUG.*\]",
}


def parse_log_level(line: str) -> str:
    """Extract log level from a log line"""
    for level, pattern in LOG_LEVEL_PATTERNS.items():
        if re.search(pattern, line):
            return level
    return "INFO"


class LogWatcher:
    """Watches a log file and emits new lines via SocketIO"""

    def __init__(self, server_name: str, log_file_path: str, socketio_instance):
        self.server_name = server_name
        self.log_file_path = log_file_path
        self.socketio = socketio_instance
        self.running = False
        self.thread = None
        self.file_position = 0
        self._stop_event = threading.Event()

    def _read_last_lines(self, num_lines: int = 1000) -> list:
        """Read the last N lines from the log file"""
        try:
            if not os.path.exists(self.log_file_path):
                return []
            with open(self.log_file_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
                return lines[-num_lines:] if len(lines) > num_lines else lines
        except Exception:
            return []

    def _emit_log_line(self, line: str):
        """Emit a log line to connected clients"""
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
            room=self.server_name,
        )

    def start(self):
        """Start watching the log file"""
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self.thread = threading.Thread(target=self._watch_loop, daemon=True)
        self.thread.start()

    def stop(self):
        """Stop watching the log file"""
        self.running = False
        self._stop_event.set()
        if self.thread:
            self.thread.join(timeout=2)

    def _watch_loop(self):
        """Main loop for watching log file changes"""
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


@socketio.on("connect")
def handle_connect():
    """Handle WebSocket connection"""
    emit("connected", {"status": "ok"})


@socketio.on("join_console")
def handle_join_console(data):
    """Join a server console room"""
    server_name = data.get("server_name")
    if server_name:
        join_room(server_name)
        emit(
            "console_joined",
            {"server_name": server_name, "status": "joined"},
        )


@socketio.on("leave_console")
def handle_leave_console(data):
    """Leave a server console room"""
    server_name = data.get("server_name")
    if server_name:
        leave_room(server_name)
        emit(
            "console_left",
            {"server_name": server_name, "status": "left"},
        )


@socketio.on("send_command")
def handle_send_command(data):
    """Send a command to a running Minecraft server"""
    server_name = data.get("server_name")
    command = data.get("command", "")

    if not server_name or not command:
        emit(
            "command_error",
            {"error": "Missing server_name or command"},
        )
        return

    if server_name not in running_servers:
        emit(
            "command_error",
            {"error": f"Server '{server_name}' is not running"},
        )
        return

    process = running_servers[server_name]
    if process.poll() is not None:
        emit(
            "command_error",
            {"error": f"Server '{server_name}' is not running"},
        )
        return

    try:
        process.stdin.write(command + "\n")
        process.stdin.flush()
        emit(
            "command_sent",
            {"server_name": server_name, "command": command},
        )
    except Exception as e:
        emit(
            "command_error",
            {"error": f"Failed to send command: {str(e)}"},
        )


def allowed_file(filename):
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def validate_fabric_server_structure(extract_dir):
    """
    Validate if the extracted files contain a valid Minecraft server structure.

    Validation Rule:
    - Root directory must contain at least one .jar file

    Args:
        extract_dir: Directory to validate

    Returns:
        tuple: (is_valid: bool, result: dict)
    """
    # Get all items in root directory
    root_items = os.listdir(extract_dir)

    # Find JAR files in root directory
    jar_files = [f for f in root_items if f.endswith(".jar")]

    # Check if there are any JAR files
    has_jar = len(jar_files) > 0

    # Generate structure info
    if has_jar:
        structure_info = f"[OK] JAR files found: {', '.join(jar_files)}"
    else:
        structure_info = "[MISSING] No JAR files in root directory"

    return has_jar, {
        "jar_files": jar_files,
        "jar_count": len(jar_files),
        "structure_info": structure_info,
    }


def extract_7z_file(file_path, extract_to):
    """Extract 7z file to specified directory"""
    try:
        with py7zr.SevenZipFile(file_path, mode="r") as archive:
            archive.extractall(path=extract_to)
        return True, None
    except Exception as e:
        return False, str(e)


@app.route("/api/upload-package", methods=["POST"])
def upload_package():
    """API endpoint to receive and extract 7z/7zip packages"""

    # Check if file is in request
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]

    # Check if file is selected
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Check file extension
    if not allowed_file(file.filename):
        return jsonify(
            {"error": "File type not allowed. Only 7z and 7zip files are accepted"}
        ), 400

    # Generate unique filename and directory
    filename = secure_filename(file.filename) if file.filename else ""
    unique_id = str(uuid.uuid4())
    base_name = os.path.splitext(filename)[0]
    extension = os.path.splitext(filename)[1]
    unique_filename = f"{base_name}_{unique_id}{extension}"

    # Create main directory for this upload
    server_dir = os.path.join(app.config["UPLOAD_FOLDER"], base_name)

    # Check if server directory already exists and has content
    if os.path.exists(server_dir) and os.listdir(server_dir):
        return jsonify(
            {
                "error": f'Server directory "{base_name}" already exists and contains files. Please choose a different name or delete the existing server first.'
            }
        ), 409  # 409 Conflict

    os.makedirs(server_dir, exist_ok=True)

    # Save uploaded file in the server directory
    upload_path = os.path.join(server_dir, unique_filename)
    file.save(upload_path)

    # Extract directly to the server directory (not to a subdirectory)
    extract_dir = server_dir

    # Extract the file
    success, error = extract_7z_file(upload_path, extract_dir)

    if not success:
        # Clean up on failure
        if os.path.exists(upload_path):
            os.remove(upload_path)
        # Don't remove server_dir as it might have other files
        return jsonify({"error": f"Failed to extract file: {error}"}), 500

    # Remove the uploaded archive file after successful extraction
    if os.path.exists(upload_path):
        os.remove(upload_path)

    # Check if extraction created an unnecessary nested directory
    # If there's only one directory and it's named the same as our base_name, flatten it
    items_in_extract_dir = os.listdir(extract_dir)
    if len(items_in_extract_dir) == 1:
        single_item = items_in_extract_dir[0]
        single_item_path = os.path.join(extract_dir, single_item)
        if os.path.isdir(single_item_path) and single_item == base_name:
            # Move contents up one level
            import shutil

            for item in os.listdir(single_item_path):
                shutil.move(
                    os.path.join(single_item_path, item),
                    os.path.join(extract_dir, item),
                )
            # Remove the now-empty nested directory
            os.rmdir(single_item_path)

    # Validate Fabric server structure
    is_valid, validation_result = validate_fabric_server_structure(extract_dir)
    structure_info = validation_result.get("structure_info", "")
    jar_files = validation_result.get("jar_files", [])

    if not is_valid:
        import shutil

        # Clean up extracted files
        if os.path.exists(extract_dir):
            shutil.rmtree(extract_dir)

        return (
            jsonify(
                {
                    "error": "Invalid server structure",
                    "message": "No JAR files found in the root directory.",
                    "validation_result": validation_result,
                }
            ),
            422,  # Unprocessable Entity
        )

    # Count extracted files
    extracted_files = os.listdir(extract_dir)

    # Return success response
    return jsonify(
        {
            "message": "Package uploaded and extracted successfully",
            "original_filename": filename,
            "server_directory": extract_dir,
            "files_extracted": len(extracted_files),
            "jar_files": jar_files,
            "structure_info": structure_info,
        }
    ), 200


def find_server_jar(server_dir):
    """Find the server JAR file in the server directory"""
    for file in os.listdir(server_dir):
        if file.endswith(".jar"):
            return file
    return None


@app.route("/api/start-server", methods=["POST"])
def start_server():
    """API endpoint to start a Minecraft Fabric server"""
    data = request.get_json()

    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400

    server_name = data["server_name"]
    server_dir = os.path.join(app.config["UPLOAD_FOLDER"], server_name)

    # Check if server directory exists
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server directory '{server_name}' not found"}), 404

    # Check if server is already running
    if server_name in running_servers:
        process = running_servers[server_name]
        if process.poll() is None:
            return jsonify(
                {
                    "error": f"Server '{server_name}' is already running",
                    "pid": process.pid,
                }
            ), 409

    # Find the server JAR file
    jar_file = find_server_jar(server_dir)
    if not jar_file:
        return jsonify({"error": "No JAR file found in server directory"}), 404

    jar_path = os.path.join(server_dir, jar_file)

    try:
        # Start the Minecraft server with stdin for command injection
        process = subprocess.Popen(
            ["java", "-jar", jar_path, "nogui"],
            cwd=server_dir,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        running_servers[server_name] = process

        # Start log watcher for this server
        logs_dir = os.path.join(server_dir, "logs")
        log_file = os.path.join(logs_dir, "latest.log")
        os.makedirs(logs_dir, exist_ok=True)

        if server_name not in log_watchers:
            log_watchers[server_name] = LogWatcher(server_name, log_file, socketio)
        log_watchers[server_name].start()

        # Notify connected clients
        socketio.emit(
            "server_started",
            {"server_name": server_name, "pid": process.pid},
        )

        return jsonify(
            {
                "message": f"Server '{server_name}' started successfully",
                "server_name": server_name,
                "jar_file": jar_file,
                "pid": process.pid,
            }
        ), 200

    except Exception as e:
        return jsonify({"error": f"Failed to start server: {str(e)}"}), 500


@app.route("/api/stop-server", methods=["POST"])
def stop_server():
    """API endpoint to stop a Minecraft Fabric server"""
    data = request.get_json()

    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400

    server_name = data["server_name"]

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    process = running_servers[server_name]

    if process.poll() is not None:
        del running_servers[server_name]
        return jsonify({"error": f"Server '{server_name}' was not running"}), 404

    try:
        # Send SIGTERM to gracefully stop the server
        process.terminate()

        # Wait for process to terminate (max 30 seconds)
        try:
            process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            # Force kill if it doesn't respond
            process.kill()
            process.wait()

        # Stop log watcher for this server
        if server_name in log_watchers:
            log_watchers[server_name].stop()
            del log_watchers[server_name]

        # Close stdin if open
        if process.stdin:
            process.stdin.close()

        del running_servers[server_name]

        # Notify connected clients
        socketio.emit(
            "server_stopped",
            {"server_name": server_name},
        )

        return jsonify({"message": f"Server '{server_name}' stopped successfully"}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to stop server: {str(e)}"}), 500


@app.route("/api/server-status", methods=["GET"])
def server_status():
    """API endpoint to get status of all running servers"""
    status = {}
    for server_name, process in list(running_servers.items()):
        if process.poll() is None:
            status[server_name] = {"running": True, "pid": process.pid}
        else:
            status[server_name] = {"running": False, "exit_code": process.returncode}
            del running_servers[server_name]

    return jsonify(status), 200


@app.route("/api/server-metrics", methods=["GET"])
def get_server_metrics():
    """API endpoint to get server metrics"""
    server_name = request.args.get("server_name")

    import psutil

    try:
        process = psutil.Process()
        memory_info = process.memory_info()
        cpu_percent = process.cpu_percent(interval=0.1)

        disk_usage = psutil.disk_usage(app.config["UPLOAD_FOLDER"])

        metrics = {
            "cpu": cpu_percent,
            "memory_used": memory_info.rss / (1024 * 1024),
            "memory_total": psutil.virtual_memory().total / (1024 * 1024),
            "disk_used": disk_usage.used / (1024 * 1024 * 1024),
            "disk_total": disk_usage.total / (1024 * 1024 * 1024),
            "players_online": 0,
            "players_max": 50,
            "timestamp": datetime.now().isoformat(),
        }

        if server_name and server_name in running_servers:
            server_process = running_servers[server_name]
            if server_process.poll() is None:
                try:
                    server_psutil = psutil.Process(server_process.pid)
                    server_memory = server_psutil.memory_info()
                    metrics["memory_used"] = server_memory.rss / (1024 * 1024)
                    metrics["cpu"] = server_psutil.cpu_percent(interval=0.1)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

        return jsonify(metrics), 200
    except Exception:
        return jsonify(
            {
                "cpu": 0,
                "memory_used": 0,
                "memory_total": 4096,
                "disk_used": 0,
                "disk_total": 100,
                "players_online": 0,
                "players_max": 50,
                "timestamp": datetime.now().isoformat(),
            }
        ), 200


@app.route("/api/server-logs/<server_name>", methods=["GET"])
def get_server_logs(server_name: str):
    """API endpoint to get recent log lines for a server"""
    server_dir = os.path.join(app.config["UPLOAD_FOLDER"], server_name)
    log_file = os.path.join(server_dir, "logs", "latest.log")
    lines = int(request.args.get("lines", 1000))

    if not os.path.exists(log_file):
        return jsonify({"logs": []}), 200

    try:
        with open(log_file, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            logs = []
            for line in recent_lines:
                if line.strip():
                    timestamp = datetime.now().isoformat()
                    level = parse_log_level(line)
                    logs.append(
                        {
                            "timestamp": timestamp,
                            "level": level,
                            "message": line.strip(),
                            "server": server_name,
                        }
                    )
            return jsonify({"logs": logs}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def send_command_to_server(server_name: str, command: str) -> tuple[bool, str]:
    """Send a command to a running Minecraft server and return success status and message"""
    if server_name not in running_servers:
        return False, f"Server '{server_name}' is not running"

    process = running_servers[server_name]
    if process.poll() is not None:
        return False, f"Server '{server_name}' is not running"

    try:
        process.stdin.write(command + "\n")
        process.stdin.flush()
        return True, f"Command sent: {command}"
    except Exception as e:
        return False, f"Failed to send command: {str(e)}"


@app.route("/api/players/online", methods=["GET"])
def get_online_players():
    """API endpoint to get list of online players"""
    server_name = request.args.get("server_name")

    if server_name:
        if server_name not in running_servers:
            return jsonify({"error": f"Server '{server_name}' is not running"}), 404
        return jsonify({"server_name": server_name, "players": []}), 200

    all_players = []
    for name in running_servers.keys():
        all_players.append({"server_name": name, "players": []})

    return jsonify({"servers": all_players}), 200


@app.route("/api/players/kick", methods=["POST"])
def kick_player():
    """API endpoint to kick a player from the server"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    server_name = data.get("server_name")
    username = data.get("username")
    reason = data.get("reason", "")

    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    if not username:
        return jsonify({"error": "Missing 'username' parameter"}), 400

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    command = f"/kick {username}"
    if reason:
        command += f" {reason}"

    success, message = send_command_to_server(server_name, command)

    if success:
        return jsonify({"message": f"{username} has been kicked"}), 200
    else:
        return jsonify({"error": message}), 500


@app.route("/api/players/ban", methods=["POST"])
def ban_player():
    """API endpoint to ban a player from the server"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    server_name = data.get("server_name")
    username = data.get("username")
    reason = data.get("reason", "Banned by an operator")

    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    if not username:
        return jsonify({"error": "Missing 'username' parameter"}), 400

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    command = f"/ban {username} {reason}"
    success, message = send_command_to_server(server_name, command)

    if success:
        return jsonify({"message": f"{username} has been banned"}), 200
    else:
        return jsonify({"error": message}), 500


@app.route("/api/players/unban", methods=["POST"])
def unban_player():
    """API endpoint to unban a player"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    server_name = data.get("server_name")
    username = data.get("username")

    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    if not username:
        return jsonify({"error": "Missing 'username' parameter"}), 400

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    command = f"/pardon {username}"
    success, message = send_command_to_server(server_name, command)

    if success:
        return jsonify({"message": f"{username} has been unbanned"}), 200
    else:
        return jsonify({"error": message}), 500


@app.route("/api/players/op", methods=["POST"])
def op_player():
    """API endpoint to grant operator status to a player"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    server_name = data.get("server_name")
    username = data.get("username")

    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    if not username:
        return jsonify({"error": "Missing 'username' parameter"}), 400

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    command = f"/op {username}"
    success, message = send_command_to_server(server_name, command)

    if success:
        return jsonify({"message": f"{username} is now an operator"}), 200
    else:
        return jsonify({"error": message}), 500


@app.route("/api/players/deop", methods=["POST"])
def deop_player():
    """API endpoint to remove operator status from a player"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    server_name = data.get("server_name")
    username = data.get("username")

    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    if not username:
        return jsonify({"error": "Missing 'username' parameter"}), 400

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    command = f"/deop {username}"
    success, message = send_command_to_server(server_name, command)

    if success:
        return jsonify({"message": f"{username} is no longer an operator"}), 200
    else:
        return jsonify({"error": message}), 500


@app.route("/api/players/teleport", methods=["POST"])
def teleport_player():
    """API endpoint to teleport a player to another player"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    server_name = data.get("server_name")
    player = data.get("player")
    target = data.get("target")

    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    if not player:
        return jsonify({"error": "Missing 'player' parameter"}), 400
    if not target:
        return jsonify({"error": "Missing 'target' parameter"}), 400

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    command = f"/tp {player} {target}"
    success, message = send_command_to_server(server_name, command)

    if success:
        return jsonify({"message": f"{player} teleported to {target}"}), 200
    else:
        return jsonify({"error": message}), 500


@app.route("/api/whitelist", methods=["GET"])
def get_whitelist():
    """API endpoint to get whitelist status"""
    server_name = request.args.get("server_name")

    if server_name:
        if server_name not in running_servers:
            return jsonify({"error": f"Server '{server_name}' is not running"}), 404
        return jsonify(
            {"server_name": server_name, "whitelist_enabled": True, "players": []}
        ), 200

    return jsonify({"whitelist_status": "unknown"}), 200


@app.route("/api/whitelist/add", methods=["POST"])
def add_to_whitelist():
    """API endpoint to add a player to the whitelist"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    server_name = data.get("server_name")
    username = data.get("username")

    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    if not username:
        return jsonify({"error": "Missing 'username' parameter"}), 400

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    command = f"/whitelist add {username}"
    success, message = send_command_to_server(server_name, command)

    if success:
        return jsonify({"message": f"{username} added to whitelist"}), 200
    else:
        return jsonify({"error": message}), 500


@app.route("/api/whitelist/remove", methods=["POST"])
def remove_from_whitelist():
    """API endpoint to remove a player from the whitelist"""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    server_name = data.get("server_name")
    username = data.get("username")

    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400
    if not username:
        return jsonify({"error": "Missing 'username' parameter"}), 400

    if server_name not in running_servers:
        return jsonify({"error": f"Server '{server_name}' is not running"}), 404

    command = f"/whitelist remove {username}"
    success, message = send_command_to_server(server_name, command)

    if success:
        return jsonify({"message": f"{username} removed from whitelist"}), 200
    else:
        return jsonify({"error": message}), 500


def validate_server_path(server_name: str, path: str) -> tuple[bool, str, str]:
    """
    Validate and sanitize a file path for a server.

    Args:
        server_name: The server directory name
        path: The requested file path (relative to server directory)

    Returns:
        tuple: (is_valid, error_message, absolute_path)
    """
    server_dir = os.path.abspath(os.path.join(app.config["UPLOAD_FOLDER"], server_name))

    if not os.path.exists(server_dir):
        return False, f"Server '{server_name}' not found", ""

    if ".." in path or path.startswith("/") or path.startswith("\\"):
        return False, "Invalid path: directory traversal not allowed", ""

    safe_path = path.lstrip("/\\")
    if safe_path:
        abs_path = os.path.abspath(os.path.join(server_dir, safe_path))
    else:
        abs_path = server_dir

    if not abs_path.startswith(server_dir):
        return False, "Access denied: path outside server directory", ""

    if not abs_path.startswith(server_dir):
        return False, "Access denied: path outside server directory", ""

    return True, "", abs_path


def get_file_info(file_path: str) -> dict:
    """Get file information for the API response"""
    is_dir = os.path.isdir(file_path)
    stat = os.stat(file_path)
    return {
        "name": os.path.basename(file_path),
        "path": os.path.relpath(file_path, os.path.dirname(os.path.dirname(file_path))),
        "is_directory": is_dir,
        "size": stat.st_size if not is_dir else 0,
        "modified": stat.st_mtime,
    }


@app.route("/api/servers/<server_name>/files", methods=["GET"])
def list_server_files(server_name: str):
    """List directory contents for a server"""
    path = request.args.get("path", "")

    is_valid, error, abs_path = validate_server_path(server_name, path)
    if not is_valid:
        return jsonify({"error": error}), 403

    if not os.path.exists(abs_path):
        return jsonify({"error": "Path not found"}), 404

    if not os.path.isdir(abs_path):
        return jsonify({"error": "Path is not a directory"}), 400

    try:
        items = []
        for item in os.listdir(abs_path):
            item_path = os.path.join(abs_path, item)
            items.append(get_file_info(item_path))
        items.sort(key=lambda x: (not x["is_directory"], x["name"].lower()))
        return jsonify({"path": path, "items": items}), 200
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/<server_name>/files/*path", methods=["GET"])
def read_server_file(server_name: str, path: str):
    """Read file contents from a server"""
    is_valid, error, abs_path = validate_server_path(server_name, path)
    if not is_valid:
        return jsonify({"error": error}), 403

    if not os.path.exists(abs_path):
        return jsonify({"error": "File not found"}), 404

    if os.path.isdir(abs_path):
        return jsonify({"error": "Path is a directory, not a file"}), 400

    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        file_info = get_file_info(abs_path)
        return jsonify({"content": content, "file": file_info}), 200
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/<server_name>/files/*path", methods=["PUT"])
def write_server_file(server_name: str, path: str):
    """Write file contents to a server"""
    is_valid, error, abs_path = validate_server_path(server_name, path)
    if not is_valid:
        return jsonify({"error": error}), 403

    data = request.get_json()
    if not data or "content" not in data:
        return jsonify({"error": "Missing content"}), 400

    try:
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(data["content"])
        return jsonify({"message": "File saved successfully"}), 200
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/<server_name>/files/*path", methods=["POST"])
def create_server_folder(server_name: str, path: str):
    """Create a folder in a server directory"""
    is_valid, error, abs_path = validate_server_path(server_name, path)
    if not is_valid:
        return jsonify({"error": error}), 403

    try:
        os.makedirs(abs_path, exist_ok=True)
        return jsonify({"message": "Folder created successfully"}), 201
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/<server_name>/files/*path", methods=["DELETE"])
def delete_server_file(server_name: str, path: str):
    """Delete a file or folder from a server"""
    is_valid, error, abs_path = validate_server_path(server_name, path)
    if not is_valid:
        return jsonify({"error": error}), 403

    if not os.path.exists(abs_path):
        return jsonify({"error": "Path not found"}), 404

    try:
        if os.path.isdir(abs_path):
            import shutil

            shutil.rmtree(abs_path)
        else:
            os.remove(abs_path)
        return jsonify({"message": "Deleted successfully"}), 200
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/<server_name>/rename", methods=["POST"])
def rename_server_file(server_name: str):
    """Rename a file or folder in a server"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    old_path = data.get("path", "")
    new_name = data.get("new_name", "")

    if not old_path or not new_name:
        return jsonify({"error": "Missing path or new_name"}), 400

    if "/" in new_name or "\\" in new_name or ".." in new_name:
        return jsonify({"error": "Invalid new name"}), 400

    is_valid, error, abs_old_path = validate_server_path(server_name, old_path)
    if not is_valid:
        return jsonify({"error": error}), 403

    if not os.path.exists(abs_old_path):
        return jsonify({"error": "Source path not found"}), 404

    try:
        new_path = os.path.join(os.path.dirname(abs_old_path), new_name)
        os.rename(abs_old_path, new_path)
        return jsonify({"message": "Renamed successfully"}), 200
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except FileExistsError:
        return jsonify({"error": "A file with that name already exists"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/<server_name>/upload", methods=["POST"])
def upload_server_file(server_name: str):
    """Upload a file to a server"""
    path = request.form.get("path", "")

    is_valid, error, abs_base_path = validate_server_path(server_name, path)
    if not is_valid:
        return jsonify({"error": error}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        filename = secure_filename(file.filename) if file.filename else "uploaded_file"
        file_path = os.path.join(abs_base_path, filename)
        os.makedirs(abs_base_path, exist_ok=True)
        file.save(file_path)
        return jsonify(
            {"message": "File uploaded successfully", "filename": filename}
        ), 201
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/servers/<server_name>/download/*path", methods=["GET"])
def download_server_file(server_name: str, path: str):
    """Download a file from a server"""
    is_valid, error, abs_path = validate_server_path(server_name, path)
    if not is_valid:
        return jsonify({"error": error}), 403

    if not os.path.exists(abs_path):
        return jsonify({"error": "File not found"}), 404

    if os.path.isdir(abs_path):
        return jsonify({"error": "Cannot download a directory"}), 400

    try:
        from flask import send_file

        return send_file(
            abs_path, as_attachment=True, download_name=os.path.basename(abs_path)
        )
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/")
def hello_world():
    return "Hello World!"


@app.route("/api/servers", methods=["GET"])
def list_servers():
    """List all available servers."""
    servers_dir = app.config["UPLOAD_FOLDER"]
    if not os.path.exists(servers_dir):
        return jsonify({"servers": []}), 200

    servers = []
    for name in os.listdir(servers_dir):
        server_dir = os.path.join(servers_dir, name)
        if os.path.isdir(server_dir):
            jar_file = find_server_jar(server_dir)
            servers.append(
                {
                    "name": name,
                    "status": "stopped" if name not in running_servers else "running",
                    "path": server_dir,
                    "jar_file": jar_file,
                }
            )

    return jsonify({"servers": servers}), 200


@app.route("/api/servers/create", methods=["POST"])
def create_server():
    """Create a new Minecraft server automatically by downloading the server jar."""
    data = request.get_json()

    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400

    server_name = data["server_name"]
    server_version = data.get("version", "1.21.1")
    difficulty = data.get("difficulty", "normal")
    max_players = data.get("max_players", 20)
    port = data.get("server_port", 25565)
    motd = data.get("motd", "A Minecraft Server")

    # Check if server directory already exists
    server_dir = os.path.join(app.config["UPLOAD_FOLDER"], server_name)
    if os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' already exists"}), 409

    try:
        # Create server directory
        os.makedirs(server_dir, exist_ok=True)

        # Download Minecraft server jar
        import urllib.request
        import json

        # Get download URL from Mojang API
        version_manifest_url = (
            "https://launchermeta.mojang.com/mc/game/version_manifest.json"
        )
        with urllib.request.urlopen(version_manifest_url) as response:
            manifest = json.loads(response.read().decode())

        # Find the requested version
        version_url = None
        for version in manifest["versions"]:
            if version["id"] == server_version:
                version_url = version["url"]
                break

        if not version_url:
            return jsonify({"error": f"Version {server_version} not found"}), 400

        # Get download URL from version manifest
        with urllib.request.urlopen(version_url) as response:
            version_data = json.loads(response.read().decode())

        server_download_url = version_data["downloads"]["server"]["url"]

        # Download server jar
        jar_filename = f"minecraft_server.{server_version}.jar"
        jar_path = os.path.join(server_dir, jar_filename)

        print(f"Downloading Minecraft server {server_version}...")
        with urllib.request.urlopen(server_download_url) as response:
            with open(jar_path, "wb") as f:
                f.write(response.read())
        print(f"Downloaded {jar_filename}")

        # Generate eula.txt
        eula_path = os.path.join(server_dir, "eula.txt")
        with open(eula_path, "w") as f:
            f.write(
                "# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n"
            )
            f.write(
                "# You acknowledge that not doing so is an infringement of Mojang's intellectual property rights.\n"
            )
            f.write(
                f"# Generated by mc-server-manage-system on {datetime.now().isoformat()}\n"
            )
            f.write("eula=true\n")
        print(f"Generated {eula_path}")

        # Generate server.properties
        server_properties_path = os.path.join(server_dir, "server.properties")
        with open(server_properties_path, "w") as f:
            f.write(f"# Minecraft server properties\n")
            f.write(
                f"# Generated by mc-server-manage-system on {datetime.now().isoformat()}\n"
            )
            f.write(f"server-name={server_name}\n")
            f.write(f"server-port={port}\n")
            f.write(f"motd={motd}\n")
            f.write(f"hardcore=false\n")
            f.write(f"allow-nether=true\n")
            f.write(f"level-name=world\n")
            f.write(f"enable-query=false\n")
            f.write(f"allow-flight=false\n")
            f.write(f"announce-player-achievements=true\n")
            f.write(f"spawn-npcs=true\n")
            f.write(f"white-list=false\n")
            f.write(f"spawn-animals=true\n")
            f.write(f"snooper-enabled=true\n")
            f.write(f"mode=survival\n")
            f.write(f"player-idle-timeout=0\n")
            f.write(f"difficulty={difficulty}\n")
            f.write(f"spawn-monsters=true\n")
            f.write(f"generate-structures=true\n")
            f.write(f"max-build-height=256\n")
            f.write(f"spawn-protection=16\n")
            f.write(f"max-players={max_players}\n")
            f.write(f"view-distance=10\n")
            f.write(f"allow-end=true\n")
            f.write(f"server-ip=\n")
        print(f"Generated {server_properties_path}")

        # Generate startup script
        startup_script_path = os.path.join(
            server_dir, "start.sh" if os.name != "nt" else "start.bat"
        )
        with open(startup_script_path, "w") as f:
            if os.name != "nt":
                f.write("#!/bin/bash\n")
                f.write(f'java -Xmx1024M -Xms512M -jar "{jar_filename}" nogui\n')
                os.chmod(startup_script_path, 0o755)
            else:
                f.write("@echo off\n")
                f.write(f'java -Xmx1024M -Xms512M -jar "{jar_filename}" nogui\n')
                f.write("pause\n")
        print(f"Generated {startup_script_path}")

        return jsonify(
            {
                "message": f"Server '{server_name}' created successfully",
                "server_name": server_name,
                "version": server_version,
                "jar_file": jar_filename,
                "server_dir": server_dir,
            }
        ), 200

    except Exception as e:
        # Clean up on failure
        if os.path.exists(server_dir):
            import shutil

            shutil.rmtree(server_dir)
        return jsonify({"error": f"Failed to create server: {str(e)}"}), 500


@app.route("/api/servers/<server_name>/delete", methods=["DELETE"])
def delete_server(server_name: str):
    """Delete a server directory and all its contents."""
    server_dir = os.path.join(app.config["UPLOAD_FOLDER"], server_name)

    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404

    if server_name in running_servers:
        return jsonify(
            {"error": f"Server '{server_name}' is still running. Stop it first."}
        ), 400

    try:
        import shutil

        shutil.rmtree(server_dir)
        return jsonify({"message": f"Server '{server_name}' deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to delete server: {str(e)}"}), 500


if __name__ == "__main__":
    print("Starting Flask app...")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)
