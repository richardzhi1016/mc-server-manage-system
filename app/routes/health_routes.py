import sqlite3
from flask import Blueprint, jsonify
from app.config import config
from app.services.health_scorer import take_snapshot

health_bp = Blueprint("health", __name__, url_prefix="/api/servers/<server_name>")


@health_bp.route("/health", methods=["GET"])
def get_health(server_name: str):
    # Get latest TPS from DB (no direct monitor reference needed)
    with sqlite3.connect(str(config.database_path)) as conn:
        row = conn.execute(
            "SELECT tps FROM tps_history WHERE server_name = ? ORDER BY timestamp DESC LIMIT 1",
            (server_name,),
        ).fetchone()
    latest_tps = row[0] if row else None
    snapshot = take_snapshot(server_name, tps=latest_tps)
    return jsonify({
        "server_name": server_name,
        "score": snapshot.score,
        "grade": snapshot.grade,
        "cpu": snapshot.cpu,
        "memory_pct": snapshot.memory_pct,
        "tps": snapshot.tps,
        "timestamp": snapshot.timestamp,
    })
