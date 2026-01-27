from flask import Blueprint, request, jsonify
from app.services.server_manager import server_manager
from app.routes.server_routes import send_command_to_server

whitelist_bp = Blueprint("whitelist", __name__, url_prefix="/api")

@whitelist_bp.route("/whitelist", methods=["GET"])
def get_whitelist():
    server_name = request.args.get("server_name")
    if server_name:
        if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
        return jsonify({"server_name": server_name, "whitelist_enabled": True, "players": []}), 200
    return jsonify({"whitelist_status": "unknown"}), 200

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
