import sqlite3
from flask import Blueprint, jsonify, request
from app.config import config
from app.services import auto_restart as ar_service

auto_restart_bp = Blueprint("auto_restart", __name__, url_prefix="/api/servers/<server_name>")

_VALID_TRIGGERS = {"tps_below", "memory_above", "empty_server"}


@auto_restart_bp.route("/auto-restart/rules", methods=["GET"])
def list_rules(server_name: str):
    with sqlite3.connect(str(config.database_path)) as conn:
        rows = conn.execute(
            """SELECT id, trigger_type, threshold, duration_seconds, cooldown_minutes, enabled
               FROM auto_restart_rules WHERE server_name = ?""",
            (server_name,),
        ).fetchall()
    return jsonify({"rules": [
        {
            "id": r[0], "trigger_type": r[1], "threshold": r[2],
            "duration_seconds": r[3], "cooldown_minutes": r[4], "enabled": bool(r[5]),
        }
        for r in rows
    ]})


@auto_restart_bp.route("/auto-restart/rules", methods=["POST"])
def create_rule(server_name: str):
    data = request.get_json() or {}
    trigger_type = data.get("trigger_type", "")
    if trigger_type not in _VALID_TRIGGERS:
        return jsonify({"error": f"trigger_type must be one of {_VALID_TRIGGERS}"}), 400
    threshold = data.get("threshold")
    duration_seconds = data.get("duration_seconds")
    cooldown_minutes = data.get("cooldown_minutes", 30)
    if threshold is None or duration_seconds is None:
        return jsonify({"error": "threshold and duration_seconds are required"}), 400

    with sqlite3.connect(str(config.database_path)) as conn:
        cursor = conn.execute(
            """INSERT INTO auto_restart_rules
               (server_name, trigger_type, threshold, duration_seconds, cooldown_minutes)
               VALUES (?, ?, ?, ?, ?)""",
            (server_name, trigger_type, float(threshold), int(duration_seconds), int(cooldown_minutes)),
        )
    return jsonify({"id": cursor.lastrowid, "message": "Rule created"}), 201


@auto_restart_bp.route("/auto-restart/rules/<int:rule_id>", methods=["DELETE"])
def delete_rule(server_name: str, rule_id: int):
    with sqlite3.connect(str(config.database_path)) as conn:
        deleted = conn.execute(
            "DELETE FROM auto_restart_rules WHERE id = ? AND server_name = ?",
            (rule_id, server_name),
        ).rowcount
    if not deleted:
        return jsonify({"error": "Rule not found"}), 404
    return jsonify({"message": "Deleted"})


@auto_restart_bp.route("/auto-restart/cancel", methods=["POST"])
def cancel_restart(server_name: str):
    engine = ar_service.get_engine(server_name)
    if not engine:
        return jsonify({"error": "No active auto-restart engine for this server"}), 404
    cancelled = engine.cancel(server_name)
    if not cancelled:
        return jsonify({"message": "No pending restart to cancel"})
    return jsonify({"message": "Restart cancelled"})
