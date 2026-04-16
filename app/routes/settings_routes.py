import json
import logging
import os
from flask import Blueprint, request, jsonify
from app.config import config

logger = logging.getLogger(__name__)

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

# Server properties UI schema
_SERVER_PROPERTIES_SCHEMA = {
    "server-port": {
        "type": "number",
        "label": "服务端口",
        "default": 25565,
        "min": 1024,
        "max": 65535,
    },
    "max-players": {
        "type": "number",
        "label": "最大玩家数",
        "default": 20,
        "min": 1,
        "max": 100,
    },
    "difficulty": {
        "type": "select",
        "label": "难度",
        "default": "easy",
        "options": ["peaceful", "easy", "normal", "hard"],
    },
    "gamemode": {
        "type": "select",
        "label": "默认游戏模式",
        "default": "survival",
        "options": ["survival", "creative", "adventure", "spectator"],
    },
    "pvp": {
        "type": "boolean",
        "label": "允许 PVP",
        "default": True,
    },
    "online-mode": {
        "type": "boolean",
        "label": "正版验证",
        "default": True,
    },
    "white-list": {
        "type": "boolean",
        "label": "开启白名单",
        "default": False,
    },
    "enable-command-block": {
        "type": "boolean",
        "label": "启用命令方块",
        "default": False,
    },
    "view-distance": {
        "type": "number",
        "label": "视距",
        "default": 10,
        "min": 3,
        "max": 32,
    },
    "spawn-protection": {
        "type": "number",
        "label": "出生点保护半径",
        "default": 16,
        "min": 0,
        "max": 100,
    },
    "motd": {
        "type": "text",
        "label": "服务器描述 (MOTD)",
        "default": "A Minecraft Server",
    },
    "level-name": {
        "type": "text",
        "label": "世界名称",
        "default": "world",
    },
    "level-seed": {
        "type": "text",
        "label": "世界种子",
        "default": "",
    },
}


def _get_startup_settings_path(server_dir: str) -> str:
    return os.path.join(server_dir, "startup_settings.json")


def _read_startup_settings(server_dir: str) -> dict:
    path = _get_startup_settings_path(server_dir)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error("Failed to read startup_settings.json: %s", e)
    return {
        "min_memory": config.default_min_memory,
        "max_memory": config.default_max_memory,
        "jvm_flags": [],
        "backup_on_startup": False,
    }


def _parse_server_properties(props_path: str) -> dict[str, str]:
    """Read server.properties and return key-value dict, skipping comments and blanks."""
    if not os.path.exists(props_path):
        return {}
    props: dict[str, str] = {}
    try:
        with open(props_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    props[key.strip()] = value.strip()
    except Exception as e:
        logger.error("Failed to parse server.properties: %s", e)
    return props


def _write_server_properties(props_path: str, updates: dict[str, str]) -> None:
    """Merge updates into existing server.properties, preserving comments and order."""
    lines: list[str] = []
    written_keys: set[str] = set()

    if os.path.exists(props_path):
        with open(props_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

    new_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue
        if "=" in stripped:
            key = stripped.partition("=")[0].strip()
            if key in updates:
                new_lines.append(f"{key}={updates[key]}\n")
                written_keys.add(key)
                continue
        new_lines.append(line)

    # Append keys not already in the file
    for key, value in updates.items():
        if key not in written_keys:
            new_lines.append(f"{key}={value}\n")

    with open(props_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)


# ── Startup settings ─────────────────────────────────────────────────────────

@settings_bp.route("/startup", methods=["GET"])
def get_startup_settings():
    server_name = request.args.get("server_name")
    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400

    server_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404

    settings = _read_startup_settings(server_dir)
    return jsonify(settings), 200


@settings_bp.route("/startup", methods=["POST"])
def update_startup_settings():
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400

    server_name = data["server_name"]
    server_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404

    min_memory = data.get("min_memory", config.default_min_memory)
    max_memory = data.get("max_memory", config.default_max_memory)
    jvm_flags = data.get("jvm_flags", [])
    backup_on_startup = data.get("backup_on_startup", False)

    if not isinstance(min_memory, int) or min_memory < 256:
        return jsonify({"error": "min_memory must be an integer >= 256"}), 400
    if not isinstance(max_memory, int) or max_memory < min_memory:
        return jsonify({"error": "max_memory must be an integer >= min_memory"}), 400
    if not isinstance(jvm_flags, list):
        return jsonify({"error": "jvm_flags must be a list"}), 400
    if not isinstance(backup_on_startup, bool):
        return jsonify({"error": "backup_on_startup must be a boolean"}), 400

    settings = {
        "min_memory": min_memory,
        "max_memory": max_memory,
        "jvm_flags": jvm_flags,
        "backup_on_startup": backup_on_startup,
    }

    path = _get_startup_settings_path(server_dir)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        logger.error("Failed to write startup_settings.json: %s", e)
        return jsonify({"error": "Failed to save settings"}), 500

    return jsonify({"message": "Startup settings saved"}), 200


# ── Server properties ─────────────────────────────────────────────────────────

@settings_bp.route("/server-properties", methods=["GET"])
def get_server_properties():
    server_name = request.args.get("server_name")
    if not server_name:
        return jsonify({"error": "Missing 'server_name' parameter"}), 400

    server_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404

    props_path = os.path.join(server_dir, "server.properties")
    properties = _parse_server_properties(props_path)

    return jsonify({"properties": properties, "schema": _SERVER_PROPERTIES_SCHEMA}), 200


@settings_bp.route("/server-properties", methods=["POST"])
def update_server_properties():
    data = request.get_json()
    if not data or "server_name" not in data or "properties" not in data:
        return jsonify({"error": "Missing 'server_name' or 'properties'"}), 400

    server_name = data["server_name"]
    updates: dict = data["properties"]

    if not isinstance(updates, dict):
        return jsonify({"error": "'properties' must be an object"}), 400

    server_dir = str(config.get_server_dir(server_name))
    if not os.path.exists(server_dir):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404

    props_path = os.path.join(server_dir, "server.properties")
    try:
        # Convert all values to strings (server.properties is plaintext)
        str_updates = {k: str(v) for k, v in updates.items()}
        _write_server_properties(props_path, str_updates)
    except Exception as e:
        logger.error("Failed to write server.properties: %s", e)
        return jsonify({"error": "Failed to save server properties"}), 500

    return jsonify({"message": "Server properties saved"}), 200
