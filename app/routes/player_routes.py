from flask import Blueprint, request, jsonify
from app.config import config
from app.services.server_manager import server_manager
from app.routes.server_routes import send_command_to_server

players_bp = Blueprint("players", __name__, url_prefix="/api")

@players_bp.route("/players/online", methods=["GET"])
def get_online_players():
    server_name = request.args.get("server_name")
    if server_name:
        if server_name not in server_manager.running_servers:
            return jsonify({"error": f"Server '{server_name}' is not running"}), 404
        return jsonify({"server_name": server_name, "players": []}), 200
    all_players = []
    for name in server_manager.running_servers.keys():
        all_players.append({"server_name": name, "players": []})
    return jsonify({"servers": all_players}), 200

@players_bp.route("/players/kick", methods=["POST"])
def kick_player():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    server_name = data.get("server_name")
    username = data.get("username")
    reason = data.get("reason", "")
    if not server_name or not username: return jsonify({"error": "Missing parameters"}), 400
    if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    command = f"/kick {username}" + (f" {reason}" if reason else "")
    success, message = send_command_to_server(server_name, command)
    return jsonify({"message": f"{username} kicked"} if success else {"error": message}), 200 if success else 500

@players_bp.route("/players/ban", methods=["POST"])
def ban_player():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    server_name = data.get("server_name")
    username = data.get("username")
    reason = data.get("reason", "Banned by an operator")
    if not server_name or not username: return jsonify({"error": "Missing parameters"}), 400
    if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    command = f"/ban {username} {reason}"
    success, message = send_command_to_server(server_name, command)
    return jsonify({"message": f"{username} banned"} if success else {"error": message}), 200 if success else 500

@players_bp.route("/players/unban", methods=["POST"])
def unban_player():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    server_name = data.get("server_name")
    username = data.get("username")
    if not server_name or not username: return jsonify({"error": "Missing parameters"}), 400
    if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    command = f"/pardon {username}"
    success, message = send_command_to_server(server_name, command)
    return jsonify({"message": f"{username} unbanned"} if success else {"error": message}), 200 if success else 500

@players_bp.route("/players/op", methods=["POST"])
def op_player():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    server_name = data.get("server_name")
    username = data.get("username")
    if not server_name or not username: return jsonify({"error": "Missing parameters"}), 400
    if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    command = f"/op {username}"
    success, message = send_command_to_server(server_name, command)
    return jsonify({"message": f"{username} is now operator"} if success else {"error": message}), 200 if success else 500

@players_bp.route("/players/deop", methods=["POST"])
def deop_player():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    server_name = data.get("server_name")
    username = data.get("username")
    if not server_name or not username: return jsonify({"error": "Missing parameters"}), 400
    if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    command = f"/deop {username}"
    success, message = send_command_to_server(server_name, command)
    return jsonify({"message": f"{username} is no longer operator"} if success else {"error": message}), 200 if success else 500

@players_bp.route("/players/teleport", methods=["POST"])
def teleport_player():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    server_name = data.get("server_name")
    player = data.get("player")
    target = data.get("target")
    if not server_name or not player or not target: return jsonify({"error": "Missing parameters"}), 400
    if server_name not in server_manager.running_servers: return jsonify({"error": f"Server '{server_name}' is not running"}), 404
    command = f"/tp {player} {target}"
    success, message = send_command_to_server(server_name, command)
    return jsonify({"message": f"{player} teleported to {target}"} if success else {"error": message}), 200 if success else 500
