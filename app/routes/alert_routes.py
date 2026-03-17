import json
import sqlite3
from flask import Blueprint, jsonify, request
from app.config import config

alert_bp = Blueprint("alert", __name__, url_prefix="/api/servers/<server_name>")

_VALID_TYPES = {"discord_webhook", "email"}


@alert_bp.route("/alerts/config", methods=["GET"])
def list_alert_configs(server_name: str):
    with sqlite3.connect(str(config.database_path)) as conn:
        rows = conn.execute(
            "SELECT id, type, config_json, enabled FROM alert_configs WHERE server_name = ?",
            (server_name,),
        ).fetchall()
    return jsonify({"configs": [
        {"id": r[0], "type": r[1], "config": json.loads(r[2]), "enabled": bool(r[3])}
        for r in rows
    ]})


@alert_bp.route("/alerts/config", methods=["POST"])
def save_alert_config(server_name: str):
    data = request.get_json() or {}
    alert_type = data.get("type", "")
    if alert_type not in _VALID_TYPES:
        return jsonify({"error": f"type must be one of {_VALID_TYPES}"}), 400
    config_data = data.get("config", {})
    if alert_type == "discord_webhook" and not config_data.get("webhook_url"):
        return jsonify({"error": "webhook_url required for discord_webhook type"}), 400
    enabled = int(data.get("enabled", 1))

    with sqlite3.connect(str(config.database_path)) as conn:
        cursor = conn.execute(
            "INSERT INTO alert_configs (server_name, type, config_json, enabled) VALUES (?, ?, ?, ?)",
            (server_name, alert_type, json.dumps(config_data), enabled),
        )
        new_id = cursor.lastrowid
    return jsonify({"id": new_id, "message": "Alert config saved"}), 201


@alert_bp.route("/alerts/config/<int:config_id>", methods=["DELETE"])
def delete_alert_config(server_name: str, config_id: int):
    with sqlite3.connect(str(config.database_path)) as conn:
        deleted = conn.execute(
            "DELETE FROM alert_configs WHERE id = ? AND server_name = ?",
            (config_id, server_name),
        ).rowcount
    if not deleted:
        return jsonify({"error": "Config not found"}), 404
    return jsonify({"message": "Deleted"})
