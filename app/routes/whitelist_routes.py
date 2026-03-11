import json
import logging
import os
from flask import Blueprint, request, jsonify
from app.config import config
from app.services.server_manager import server_manager
from app.routes.server_routes import send_command_to_server

logger = logging.getLogger(__name__)
whitelist_bp = Blueprint("whitelist", __name__, url_prefix="/api")


def _read_json_list(path: str) -> list:
    """Read a JSON list file, returning [] on missing or parse error."""
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.error("Failed to read %s: %s", path, e)
        return []


@whitelist_bp.route("/whitelist", methods=["GET"])
def get_whitelist():
    server_name = request.args.get("server_name")
    if not server_name:
        return jsonify({"whitelist_status": "unknown"}), 200
    server_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404
    raw = _read_json_list(os.path.join(server_dir, "whitelist.json"))
    players = [
        {"username": e.get("name", ""), "uuid": e.get("uuid", ""), "added_at": ""}
        for e in raw if e.get("name")
    ]
    return jsonify({"server_name": server_name, "whitelist_enabled": True, "players": players}), 200


@whitelist_bp.route("/whitelist/add", methods=["POST"])
def add_to_whitelist():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    server_name = data.get("server_name")
    username = data.get("username")
    if not server_name or not username: return jsonify({"error": "Missing parameters"}), 400
    if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    command = f"/whitelist add {username}"
    success, message = send_command_to_server(server_name, command)
    return jsonify({"message": f"{username} added to whitelist"} if success else {"error": message}), 200 if success else 500


@whitelist_bp.route("/whitelist/remove", methods=["POST"])
def remove_from_whitelist():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    server_name = data.get("server_name")
    username = data.get("username")
    if not server_name or not username: return jsonify({"error": "Missing parameters"}), 400
    if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    command = f"/whitelist remove {username}"
    success, message = send_command_to_server(server_name, command)
    return jsonify({"message": f"{username} removed from whitelist"} if success else {"error": message}), 200 if success else 500


@whitelist_bp.route("/bans", methods=["GET"])
def get_bans():
    server_name = request.args.get("server_name")
    if not server_name:
        return jsonify({"banned_players": []}), 200
    server_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404
    raw = _read_json_list(os.path.join(server_dir, "banned-players.json"))
    banned = [
        {
            "username": e.get("name", ""),
            "uuid": e.get("uuid", ""),
            "banned_by": e.get("source", ""),
            "banned_at": e.get("created", ""),
            "expires": e.get("expires", "forever"),
            "reason": e.get("reason", ""),
        }
        for e in raw if e.get("name")
    ]
    return jsonify({"server_name": server_name, "banned_players": banned}), 200
