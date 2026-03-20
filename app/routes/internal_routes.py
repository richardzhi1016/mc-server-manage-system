import logging
import os

from flask import Blueprint, request, jsonify

from app.services.server_manager import server_manager
from app.services.tps_monitor import get_monitor

logger = logging.getLogger(__name__)

internal_bp = Blueprint("internal", __name__, url_prefix="/api/internal")


def _get_remote_addr() -> str:
    return request.remote_addr or ""


def _check_auth():
    """Returns error response tuple or None if authorized."""
    if _get_remote_addr() not in ("127.0.0.1", "::1"):
        return jsonify({"error": "Forbidden"}), 403
    secret = os.environ.get("INTERNAL_SECRET", "")
    if not secret or request.headers.get("X-Internal-Secret") != secret:
        return jsonify({"error": "Unauthorized"}), 401
    return None


@internal_bp.route("/servers", methods=["GET"])
def list_running_servers():
    err = _check_auth()
    if err:
        return err
    running = list(server_manager.running_servers.keys())
    return jsonify({"servers": running})


@internal_bp.route("/server-status/<server_name>", methods=["GET"])
def server_status(server_name: str):
    err = _check_auth()
    if err:
        return err
    if not server_manager.is_server_running(server_name):
        return jsonify({"error": "Server not running"}), 404

    monitor = get_monitor(server_name)
    tps = monitor.current_tps if monitor else None
    health = None
    try:
        import sqlite3 as _sq3
        from app.config import config as _cfg
        with _sq3.connect(str(_cfg.database_path)) as _conn:
            row = _conn.execute(
                "SELECT score FROM health_snapshots WHERE server_name=? ORDER BY timestamp DESC LIMIT 1",
                (server_name,)
            ).fetchone()
        if row:
            health = row[0]
    except Exception:
        logger.warning("Failed to read health snapshot for %s", server_name, exc_info=True)
    players_online = len(server_manager.online_players.get(server_name, set()))

    return jsonify({"server_name": server_name, "tps": tps, "health_score": health, "players_online": players_online})


@internal_bp.route("/online-players/<server_name>", methods=["GET"])
def online_players(server_name: str):
    err = _check_auth()
    if err:
        return err
    players = list(server_manager.online_players.get(server_name, set()))
    return jsonify({"server_name": server_name, "players": players})


@internal_bp.route("/console-command", methods=["POST"])
def console_command():
    err = _check_auth()
    if err:
        return err
    data = request.get_json()
    if not data or "server_name" not in data or "command" not in data:
        return jsonify({"error": "Missing server_name or command"}), 400
    server_name = data["server_name"]
    command = data["command"]
    watcher = server_manager.running_servers.get(server_name)
    if not watcher:
        return jsonify({"error": f"Server '{server_name}' not running"}), 404
    watcher.write_input(command + "\r\n")
    return jsonify({"message": "Command sent"})
