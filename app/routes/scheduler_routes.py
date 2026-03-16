import sqlite3
import logging

from flask import Blueprint, request, jsonify

from app.config import config
from app.services.scheduler_service import scheduler_service

logger = logging.getLogger(__name__)

scheduler_bp = Blueprint("scheduler", __name__, url_prefix="/api")


def _server_exists(server_name: str) -> bool:
    """Check if a server exists in the database."""
    with sqlite3.connect(str(config.database_path)) as conn:
        row = conn.execute(
            "SELECT id FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()
    return row is not None


@scheduler_bp.route("/scheduled-tasks", methods=["GET"])
def list_scheduled_tasks():
    server_name = request.args.get("server_name")
    tasks = scheduler_service.list_tasks(server_name=server_name or None)
    return jsonify({"tasks": tasks}), 200


@scheduler_bp.route("/scheduled-tasks", methods=["POST"])
def create_scheduled_task():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    server_name = data.get("server_name", "").strip()
    if not server_name:
        return jsonify({"error": "server_name is required"}), 400
    if not _server_exists(server_name):
        return jsonify({"error": f"Server '{server_name}' not found"}), 404

    success, error, task = scheduler_service.create_task(data)
    if not success:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Task created", "task": task}), 201


@scheduler_bp.route("/scheduled-tasks/<task_id>", methods=["PUT"])
def update_scheduled_task(task_id: str):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    success, error, task = scheduler_service.update_task(task_id, data)
    if not success:
        if error == "Task not found":
            return jsonify({"error": error}), 404
        return jsonify({"error": error}), 400

    return jsonify({"message": "Task updated", "task": task}), 200


@scheduler_bp.route("/scheduled-tasks/<task_id>", methods=["DELETE"])
def delete_scheduled_task(task_id: str):
    deleted = scheduler_service.delete_task(task_id)
    if not deleted:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"message": "Task deleted"}), 200
