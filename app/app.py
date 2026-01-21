import os
import uuid
import subprocess
import threading
import time
import re
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import py7zr
from werkzeug.utils import secure_filename
from auth import require_auth, require_admin
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

ADMIN_API_KEY = os.environ.get("MC_ADMIN_API_KEY") or os.environ.get("ADMIN_API_KEY")


def init_default_admin():
    """Initialize default admin account if no users exist."""
    import json
    import sqlite3
    from models.user import UserStorage

    storage = UserStorage()

    old_users_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "users.json"
    )

    if os.path.exists(old_users_file):
        try:
            with open(old_users_file, "r") as f:
                old_users = json.load(f)

            conn = sqlite3.connect(storage.db_path)
            cursor = conn.cursor()
            for user_data in old_users:
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    (
                        user_data["id"],
                        user_data["username"],
                        user_data["password_hash"],
                        user_data["role"],
                        user_data["created_at"],
                    ),
                )
            conn.commit()
            conn.close()

            os.rename(old_users_file, old_users_file + ".backup")
            print(f"Migrated {len(old_users)} users from JSON to SQLite")
        except Exception as e:
            print(f"Failed to migrate users: {e}")

    if storage.count_users() == 0:
        admin_password = os.environ.get("ADMIN_PASSWORD") or "admin123"
        admin_user = storage.create_user("admin", admin_password, "admin")
        if admin_user:
            print(
                f"Default admin account created. Username: admin, Password: {admin_password}"
            )
        else:
            print("Failed to create default admin account")


@app.before_request
def require_api_key():
    if request.path.startswith("/api/auth/"):
        return
    if not request.path.startswith("/api"):
        return

    key = request.headers.get("X-API-Key")
    if not key:
        key = request.args.get("api_key")

    if ADMIN_API_KEY:
        if not key or key != ADMIN_API_KEY:
            return jsonify({"error": "Unauthorized"}), 401
        return

    from auth import get_token_from_header, decode_token

    token = get_token_from_header()
    if token:
        payload = decode_token(token)
        if payload:
            g.auth_user = {
                "user_id": payload.get("sub"),
                "username": payload.get("username"),
                "role": payload.get("role"),
            }
            return


@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    """Authenticate user and return JWT token."""
    from models.user import UserStorage
    from auth import verify_password, generate_token

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    storage = UserStorage()
    user = storage.get_user_by_username(username)

    if not user or not verify_password(password, user.password_hash):
        return jsonify({"error": "Invalid username or password"}), 401

    token = generate_token(user.id, user.username, user.role)

    return jsonify(
        {
            "message": "Login successful",
            "token": token,
            "user": user.to_response(),
        }
    ), 200


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    """Logout user (client-side token deletion)."""
    return jsonify({"message": "Logged out successfully"}), 200


@app.route("/api/auth/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    """Register a new user account."""
    from models.user import UserStorage

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    username = data.get("username")
    password = data.get("password")
    confirm_password = data.get("confirm_password")

    if not username or not password or not confirm_password:
        return jsonify(
            {"error": "Username, password, and confirm_password are required"}
        ), 400

    import re

    username_pattern = r"^[a-zA-Z0-9_]{3,20}$"
    if not re.match(username_pattern, username):
        return jsonify(
            {
                "error": "Username must be 3-20 characters and contain only letters, numbers, and underscores"
            }
        ), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    storage = UserStorage()
    existing_user = storage.get_user_by_username(username)
    if existing_user:
        return jsonify({"error": "Username already exists"}), 409

    user = storage.create_user(username, password, "user")
    if not user:
        return jsonify({"error": "Failed to create user"}), 500

    return jsonify(
        {"message": "User registered successfully", "user": user.to_response()}
    ), 201


@app.route("/api/auth/request-password-reset", methods=["POST"])
def request_password_reset():
    """Request a password reset (Phase 1: admin contact instructions)."""
    from models.user import UserStorage

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    username = data.get("username")
    if not username:
        return jsonify({"error": "Username is required"}), 400

    storage = UserStorage()
    storage.get_user_by_username(username)

    contact_info = os.environ.get("PASSWORD_RESET_CONTACT", "admin@example.com")

    return jsonify(
        {
            "message": "Please contact an administrator to reset your password",
            "contact_info": contact_info,
        }
    ), 200


@app.route("/api/auth/me", methods=["GET"])
def get_current_user():
    """Get current authenticated user information."""
    from auth import get_token_from_header, decode_token

    token = get_token_from_header()
    if not token:
        return jsonify({"error": "Missing authentication token"}), 401

    payload = decode_token(token)
    if not payload:
        return jsonify({"error": "Invalid or expired token"}), 401

    return jsonify(
        {
            "user_id": payload.get("sub"),
            "username": payload.get("username"),
            "role": payload.get("role"),
        }
    ), 200


@app.route("/api/users", methods=["GET"])
@require_admin
def list_users():
    """List all users (admin only)."""
    from models.user import UserStorage

    storage = UserStorage()
    users = storage.get_all_users()
    return jsonify({"users": [u.to_response() for u in users]}), 200


@app.route("/api/users", methods=["POST"])
@require_admin
def create_user():
    """Create a new user (admin only)."""
    from models.user import UserStorage

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    username = data.get("username")
    password = data.get("password")
    role = data.get("role", "user")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if role not in ["admin", "user"]:
        return jsonify({"error": "Invalid role. Must be 'admin' or 'user'"}), 400

    storage = UserStorage()
    user = storage.create_user(username, password, role)

    if not user:
        return jsonify({"error": "Username already exists"}), 409

    return jsonify(
        {"message": "User created successfully", "user": user.to_response()}
    ), 201


@app.route("/api/users/<user_id>", methods=["PUT"])
@require_admin
def update_user(user_id):
    """Update a user (admin only)."""
    from models.user import UserStorage

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    storage = UserStorage()

    user = storage.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    updates = {}

    reset_by_admin = data.get("reset_by_admin", False)

    if "new_password" in data and reset_by_admin:
        if len(data["new_password"]) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        updates["password"] = data["new_password"]
        logging.info(
            f"Admin {g.auth_user['username']} reset password for user {user.username}"
        )
    elif "password" in data:
        if len(data["password"]) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        updates["password"] = data["password"]

    if "role" in data:
        if data["role"] not in ["admin", "user"]:
            return jsonify({"error": "Invalid role. Must be 'admin' or 'user'"}), 400
        updates["role"] = data["role"]

    updated_user = storage.update_user(user_id, updates)
    if not updated_user:
        return jsonify({"error": "Failed to update user"}), 500
    return jsonify(
        {"message": "User updated successfully", "user": updated_user.to_response()}
    ), 200


@app.route("/api/users/<user_id>", methods=["DELETE"])
@require_admin
def delete_user(user_id):
    """Delete a user (admin only)."""
    from models.user import UserStorage
    from flask import g

    storage = UserStorage()

    user = storage.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user_id == g.auth_user["user_id"]:
        return jsonify({"error": "You cannot delete your own account"}), 400

    if user.role == "admin" and storage.count_admins() <= 1:
        return jsonify({"error": "Cannot delete the last admin account"}), 400

    if storage.delete_user(user_id):
        return jsonify({"message": "User deleted successfully"}), 200

    return jsonify({"error": "Failed to delete user"}), 500


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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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
@require_auth
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

        # Accept EULA
        eula_path = os.path.join(server_dir, "eula.txt")
        with open(eula_path, "w") as f:
            f.write("eula=true\n")

        # Create default server.properties
        properties = f"""#Minecraft server properties
#Generated by MC Server Manager
spawn-protection=16
max-tick-time=60000
query.port={port}
generator-settings={{}}
force-gamemode=false
allow-nether=true
enforce-whitelist=false
gamemode=survival
broadcast-console-to-ops=true
enable-query=false
player-idle-timeout=0
difficulty={difficulty}
spawn-monsters=true
op-permission-level=4
resource-pack-hash=
announce-player-achievements=true
pvp=true
snooper-enabled=true
level-type=DEFAULT
hardcore=false
enable-command-block=false
max-players={max_players}
network-compression-threshold=256
max-world-size=29999984
server-port={port}
server-ip=
spawn-npcs=true
allow-flight=false
level-name=world
view-distance=10
resource-pack=
spawn-animals=true
white-list=false
generate-structures=true
online-mode=true
max-build-height=256
level-seed=
use-native-transport=true
motd={motd}
enable-rcon=false
"""

        properties_path = os.path.join(server_dir, "server.properties")
        with open(properties_path, "w") as f:
            f.write(properties)

        return jsonify(
            {
                "message": f"Server '{server_name}' created successfully",
                "server_name": server_name,
                "version": server_version,
                "jar_file": jar_filename,
                "server_dir": server_dir,
            }
        ), 201

    except Exception as e:
        # Clean up on failure
        if os.path.exists(server_dir):
            import shutil

            shutil.rmtree(server_dir)
        return jsonify({"error": f"Failed to create server: {str(e)}"}), 500


@app.route("/api/settings/startup", methods=["GET"])
@require_auth
def get_startup_settings():
    """Get startup parameters for a server."""
    server_name = request.args.get("server_name")
    if not server_name:
        return jsonify({"error": "Missing server_name parameter"}), 400

    from config import read_startup_conf

    config = read_startup_conf(server_name)
    return jsonify(config), 200


@app.route("/api/settings/startup", methods=["POST"])
@require_auth
def update_startup_settings():
    """Update startup parameters for a server."""
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing server_name parameter"}), 400

    server_name = data["server_name"]
    from config import write_startup_conf

    config = {
        "min_memory": data.get("min_memory", 1024),
        "max_memory": data.get("max_memory", 2048),
        "jvm_flags": data.get("jvm_flags", ["-nogui"]),
    }

    if write_startup_conf(server_name, config):
        return jsonify({"message": "Startup settings saved successfully"}), 200
    else:
        return jsonify({"error": "Failed to save startup settings"}), 500


@app.route("/api/settings/server-properties", methods=["GET"])
@require_auth
def get_server_properties():
    """Get server.properties for a server."""
    server_name = request.args.get("server_name")
    if not server_name:
        return jsonify({"error": "Missing server_name parameter"}), 400

    from config import read_server_properties, SERVER_PROPERTIES_SCHEMA

    properties = read_server_properties(server_name)
    schema = SERVER_PROPERTIES_SCHEMA

    result = {
        "properties": properties,
        "schema": schema,
    }
    return jsonify(result), 200


@app.route("/api/settings/server-properties", methods=["POST"])
@require_auth
def update_server_properties():
    """Update server.properties for a server."""
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing server_name parameter"}), 400

    server_name = data["server_name"]
    properties = data.get("properties", {})
    from config import write_server_properties

    if write_server_properties(server_name, properties):
        return jsonify({"message": "Server properties saved successfully"}), 200
    else:
        return jsonify({"error": "Failed to save server properties"}), 500


@app.route("/api/settings/theme", methods=["POST"])
@require_auth
def save_theme():
    """Save user theme preference."""
    data = request.get_json()
    if not data or "theme" not in data:
        return jsonify({"error": "Missing theme parameter"}), 400

    theme = data["theme"]
    if theme not in ["light", "dark"]:
        return jsonify({"error": "Invalid theme value"}), 400

    return jsonify({"message": "Theme saved successfully"}), 200


@app.route("/api/backups", methods=["GET"])
@require_auth
def list_backups():
    """List available backups."""
    server_name = request.args.get("server_name")
    from backup import list_backups as lb

    backups = lb(server_name)
    return jsonify({"backups": backups}), 200


@app.route("/api/backups", methods=["POST"])
@require_auth
def create_backup():
    """Create a new backup."""
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing server_name parameter"}), 400

    server_name = data["server_name"]
    from backup import create_backup as cb

    backup = cb(server_name)
    if backup:
        return jsonify(
            {"message": "Backup created successfully", "backup": backup}
        ), 201
    else:
        return jsonify({"error": "Failed to create backup"}), 500


@app.route("/api/backups/restore", methods=["POST"])
@require_auth
def restore_backup():
    """Restore a server from a backup."""
    data = request.get_json()
    if not data or "server_name" not in data or "backup_id" not in data:
        return jsonify({"error": "Missing server_name or backup_id parameter"}), 400

    server_name = data["server_name"]
    backup_id = data["backup_id"]
    from backup import restore_backup as rb

    if rb(server_name, backup_id):
        return jsonify({"message": "Backup restored successfully"}), 200
    else:
        return jsonify({"error": "Failed to restore backup"}), 500


@app.route("/api/backups/<backup_id>", methods=["DELETE"])
@require_auth
def delete_backup(backup_id):
    """Delete a backup."""
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing server_name parameter"}), 400

    server_name = data["server_name"]
    from backup import delete_backup as db

    if db(server_name, backup_id):
        return jsonify({"message": "Backup deleted successfully"}), 200
    else:
        return jsonify({"error": "Failed to delete backup"}), 500


@app.route("/api/backups/<server_name>/<backup_id>/download", methods=["GET"])
@require_auth
def download_backup(server_name, backup_id):
    """Download a backup file."""
    from backup import get_backup_path
    from flask import send_file

    backup_path = get_backup_path(server_name, backup_id)
    if not os.path.exists(backup_path):
        return jsonify({"error": "Backup not found"}), 404

    try:
        return send_file(
            backup_path,
            as_attachment=True,
            download_name=f"{server_name}_{backup_id}.tar.gz",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/scheduled-tasks", methods=["GET"])
@require_auth
def list_scheduled_tasks():
    """List scheduled tasks."""
    from backup import load_scheduled_tasks, get_next_run_time

    tasks = load_scheduled_tasks()
    for task in tasks:
        task["next_run"] = get_next_run_time(task)

    return jsonify({"tasks": tasks}), 200


@app.route("/api/scheduled-tasks", methods=["POST"])
@require_auth
def create_scheduled_task():
    """Create a new scheduled task."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["type", "schedule"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing {field} parameter"}), 400

    from backup import add_scheduled_task

    task = add_scheduled_task(data)
    return jsonify({"message": "Task created successfully", "task": task}), 201


@app.route("/api/scheduled-tasks/<task_id>", methods=["DELETE"])
@require_auth
def delete_scheduled_task(task_id):
    """Delete a scheduled task."""
    from backup import delete_scheduled_task as dt

    if dt(task_id):
        return jsonify({"message": "Task deleted successfully"}), 200
    else:
        return jsonify({"error": "Task not found"}), 404


@app.route("/api/scheduled-tasks/<task_id>", methods=["PUT"])
@require_auth
def update_scheduled_task(task_id):
    """Update a scheduled task."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    from backup import update_scheduled_task as ut

    if ut(task_id, data):
        return jsonify({"message": "Task updated successfully"}), 200
    else:
        return jsonify({"error": "Task not found"}), 404


@app.route("/api/scheduler/status", methods=["GET"])
@require_auth
def scheduler_status():
    """Get scheduler status."""
    from backup import load_scheduled_tasks, get_next_run_time

    tasks = load_scheduled_tasks()
    enabled_tasks = [t for t in tasks if t.get("enabled", True)]

    return jsonify(
        {
            "running": True,
            "task_count": len(enabled_tasks),
            "next_tasks": sorted(
                [
                    {"id": t["id"], "type": t["type"], "next_run": get_next_run_time(t)}
                    for t in enabled_tasks
                ],
                key=lambda x: x["next_run"] or "",
            )[:5],
        }
    ), 200


if __name__ == "__main__":
    init_default_admin()
    socketio.run(app, host="::", port=5000, debug=False)
