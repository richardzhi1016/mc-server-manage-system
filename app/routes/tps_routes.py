import sqlite3
from flask import Blueprint, jsonify, request
from app.config import config

tps_bp = Blueprint("tps", __name__, url_prefix="/api/servers/<server_name>")


@tps_bp.route("/tps/history", methods=["GET"])
def get_tps_history(server_name: str):
    hours = min(int(request.args.get("hours", 1)), 168)  # max 7 days
    with sqlite3.connect(str(config.database_path)) as conn:
        rows = conn.execute(
            """SELECT tps, status, timestamp FROM tps_history
               WHERE server_name = ?
                 AND timestamp >= datetime('now', ? || ' hours')
               ORDER BY timestamp ASC""",
            (server_name, f"-{hours}"),
        ).fetchall()
    return jsonify({
        "server_name": server_name,
        "history": [{"tps": r[0], "status": r[1], "timestamp": r[2]} for r in rows],
    })
