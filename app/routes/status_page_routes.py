import logging
import sqlite3
import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify

from app.config import config
from app.services.server_manager import server_manager
from app.services.tps_monitor import get_monitor

logger = logging.getLogger(__name__)

status_page_bp = Blueprint("status_page", __name__)


def _get_db():
    conn = sqlite3.connect(str(config.database_path))
    conn.row_factory = sqlite3.Row
    return conn


@status_page_bp.route("/api/servers/<server_name>/status-page/enable", methods=["POST"])
def enable_status_page(server_name: str):
    with _get_db() as conn:
        row = conn.execute(
            "SELECT public_token FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()
        if not row:
            return jsonify({"error": "Server not found"}), 404
        token = row["public_token"]
        if not token:
            token = str(uuid.uuid4())
            conn.execute(
                "UPDATE server_instance SET public_token = ? WHERE name = ?",
                (token, server_name),
            )
    return jsonify({"token": token, "url": f"/public/{token}"})


@status_page_bp.route("/api/servers/<server_name>/status-page/disable", methods=["POST"])
def disable_status_page(server_name: str):
    with _get_db() as conn:
        row = conn.execute(
            "SELECT id FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()
        if not row:
            return jsonify({"error": "Server not found"}), 404
        conn.execute(
            "UPDATE server_instance SET public_token = NULL WHERE name = ?", (server_name,)
        )
    return jsonify({"message": "Status page disabled"})


@status_page_bp.route(
    "/api/servers/<server_name>/status-page/token/reset", methods=["POST"]
)
def reset_status_page_token(server_name: str):
    new_token = str(uuid.uuid4())
    with _get_db() as conn:
        row = conn.execute(
            "SELECT id FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()
        if not row:
            return jsonify({"error": "Server not found"}), 404
        conn.execute(
            "UPDATE server_instance SET public_token = ? WHERE name = ?",
            (new_token, server_name),
        )
    return jsonify({"token": new_token, "url": f"/public/{new_token}"})


@status_page_bp.route("/api/servers/<server_name>/status-page/config", methods=["GET"])
def get_status_page_config(server_name: str):
    with _get_db() as conn:
        row = conn.execute(
            "SELECT public_token FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()
        if not row:
            return jsonify({"error": "Server not found"}), 404
        token = row["public_token"]
    return jsonify({"token": token, "url": f"/public/{token}" if token else None})


@status_page_bp.route("/api/public/status/<token>", methods=["GET"])
def public_status(token: str):
    with _get_db() as conn:
        row = conn.execute(
            "SELECT name, server_type, version, started_at FROM server_instance "
            "WHERE public_token = ?",
            (token,),
        ).fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404

    server_name = row["name"]
    is_running = server_manager.is_server_running(server_name)

    if not is_running:
        return jsonify(
            {
                "server_name": server_name,
                "status": "stopped",
                "version": row["version"],
                "players_online": None,
                "players_max": None,
                "uptime_seconds": None,
                "health_score": None,
                "tps": None,
            }
        )

    players_online = len(server_manager.online_players.get(server_name, set()))
    players_max = _read_max_players(server_name)

    uptime_seconds = None
    if row["started_at"]:
        try:
            started_dt = datetime.fromisoformat(row["started_at"])
            if started_dt.tzinfo is None:
                started_dt = started_dt.replace(tzinfo=timezone.utc)
            uptime_seconds = int(
                (datetime.now(timezone.utc) - started_dt).total_seconds()
            )
        except Exception:
            logger.warning("Failed to calculate uptime for %s: %s", server_name, row["started_at"])

    health_score = None
    try:
        with _get_db() as conn:
            snap = conn.execute(
                "SELECT score FROM health_snapshots "
                "WHERE server_name = ? ORDER BY timestamp DESC LIMIT 1",
                (server_name,),
            ).fetchone()
        if snap:
            health_score = snap["score"]
    except Exception:
        logger.warning("Failed to read health snapshot for %s", server_name, exc_info=True)

    tps = None
    monitor = get_monitor(server_name)
    if monitor:
        tps = getattr(monitor, "current_tps", None)

    return jsonify(
        {
            "server_name": server_name,
            "status": "running",
            "version": row["version"],
            "players_online": players_online,
            "players_max": players_max,
            "uptime_seconds": uptime_seconds,
            "health_score": health_score,
            "tps": tps,
        }
    )


def _read_max_players(server_name: str):
    """Read max-players from server.properties. Returns None on failure."""
    props_path = config.get_server_dir(server_name) / "server.properties"
    try:
        with open(str(props_path), "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("max-players="):
                    return int(line.split("=", 1)[1])
    except Exception:
        pass
    return None
