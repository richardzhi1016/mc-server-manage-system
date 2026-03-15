import logging
import os
import sqlite3
import sys
from pathlib import Path

# Add the parent directory of 'app' to sys.path so 'from app.xxx import' works
PROJECT_ROOT = str(Path(__file__).parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from app.config import config
from app.routes.server_routes import servers_bp, set_socketio
from app.routes.player_routes import players_bp
from app.routes.whitelist_routes import whitelist_bp
from app.routes.file_routes import files_bp
from app.routes.backup_routes import backup_bp
from app.routes.settings_routes import settings_bp
from app.routes.mod_routes import mods_bp
from app.routes.plugin_routes import plugins_bp
from app.services.server_manager import server_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

ALLOWED_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000,http://127.0.0.1:5000",
).split(",")

CORS(app, origins=ALLOWED_ORIGINS)

socketio = SocketIO(app, cors_allowed_origins=ALLOWED_ORIGINS, async_mode='threading')
set_socketio(socketio)

app.config["UPLOAD_FOLDER"] = str(config.upload_folder)

DATABASE_PATH = config.database_path

os.makedirs(config.database_dir, exist_ok=True)


def get_db_connection():
    """Get a database connection."""
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def row_to_dict(row):
    """Convert a sqlite3.Row to a dictionary."""
    if row is None:
        return None
    return dict(row)


def init_database():
    """Initialize the database with required tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS server_instance (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            server_type TEXT,
            version TEXT,
            port INTEGER
        )
    """)

    conn.commit()
    conn.close()


init_database()

app.register_blueprint(servers_bp)
app.register_blueprint(players_bp)
app.register_blueprint(whitelist_bp)
app.register_blueprint(files_bp)
app.register_blueprint(backup_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(mods_bp)
app.register_blueprint(plugins_bp)


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
            {
                "server_name": server_name, 
                "status": "joined", 
                "is_running": server_manager.is_server_running(server_name)
            },
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
    from app.routes.server_routes import send_command_to_server

    server_name = data.get("server_name")
    command = data.get("command", "")

    if not server_name or not command:
        emit(
            "command_error",
            {"error": "Missing server_name or command"},
        )
        return

    if server_name not in server_manager.running_servers:
        emit(
            "command_error",
            {"error": f"Server '{server_name}' is not running"},
        )
        return

    success, message = send_command_to_server(server_name, command)

    if success:
        emit(
            "command_sent",
            {"server_name": server_name, "command": command},
        )
    else:
        emit(
            "command_error",
            {"error": message},
        )


@app.route("/")
def hello_world():
    return "Minecraft Server Management API"


if __name__ == "__main__":
    logger.info("Starting Flask app...")
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)
