import logging
import os
import sqlite3

from flask import Blueprint, request, jsonify

from app.config import config
from app.services.discord_bot import discord_bot_manager

logger = logging.getLogger(__name__)

discord_bot_bp = Blueprint("discord_bot", __name__, url_prefix="/api/discord-bot")


def _get_db():
    conn = sqlite3.connect(str(config.database_path))
    conn.row_factory = sqlite3.Row
    return conn


@discord_bot_bp.route("/config", methods=["GET"])
def get_config():
    with _get_db() as conn:
        row = conn.execute("SELECT * FROM discord_bot_config WHERE id=1").fetchone()
    if not row:
        return jsonify({"config": None})
    return jsonify({"config": {
        "token": "***",  # masked
        "channel_id": row["channel_id"],
        "enabled": bool(row["enabled"]),
    }})


@discord_bot_bp.route("/config", methods=["POST"])
def save_config():
    data = request.get_json()
    if not data or "token" not in data or "channel_id" not in data:
        return jsonify({"error": "Missing token or channel_id"}), 400
    with _get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO discord_bot_config(id, token, channel_id, enabled)
               VALUES(1, ?, ?, ?)""",
            (data["token"], str(data["channel_id"]), 1)
        )
    return jsonify({"message": "Config saved"})


@discord_bot_bp.route("/start", methods=["POST"])
def start_bot():
    with _get_db() as conn:
        row = conn.execute("SELECT * FROM discord_bot_config WHERE id=1").fetchone()
    if not row or not row["token"]:
        return jsonify({"error": "Bot token not configured"}), 400

    internal_secret = os.environ.get("INTERNAL_SECRET", "")
    flask_url = os.environ.get("FLASK_INTERNAL_URL", "http://127.0.0.1:5000")
    try:
        discord_bot_manager.start(row["token"], row["channel_id"], internal_secret, flask_url)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"message": "Bot starting", "state": discord_bot_manager.get_state()})


@discord_bot_bp.route("/stop", methods=["POST"])
def stop_bot():
    discord_bot_manager.stop()
    return jsonify({"message": "Bot stopped"})


@discord_bot_bp.route("/status", methods=["GET"])
def bot_status():
    return jsonify({"state": discord_bot_manager.get_state()})
