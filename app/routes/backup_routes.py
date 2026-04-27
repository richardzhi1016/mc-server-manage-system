from flask import Blueprint, request, jsonify
from app.services.backup_service import backup_service

backup_bp = Blueprint("backup", __name__, url_prefix="/api")

@backup_bp.route("/backups", methods=["GET"])
def list_backups():
    server_name = request.args.get("server_name")
    backups = backup_service.list_backups(server_name)
    return jsonify({"backups": backups}), 200

@backup_bp.route("/backups", methods=["POST"])
def create_backup():
    data = request.get_json()
    if not data or "server_name" not in data:
        return jsonify({"error": "Missing 'server_name'"}), 400
    custom_name = data.get("name")  # Optional custom alias
    is_locked = bool(data.get("is_locked", False))
    backup = backup_service.create_backup(data["server_name"], custom_name=custom_name, is_locked=is_locked)
    if backup:
        return jsonify({"message": "Backup created", "backup": backup}), 201
    return jsonify({"error": "Failed to create backup"}), 500

@backup_bp.route("/backups/<server_name>/<backup_id>/restore", methods=["POST"])
def restore_backup(server_name: str, backup_id: str):
    success = backup_service.restore_backup(server_name, backup_id)
    if success: return jsonify({"message": "Backup restored"}), 200
    return jsonify({"error": "Failed to restore backup"}), 500

@backup_bp.route("/backups/<server_name>/<backup_id>", methods=["DELETE"])
def delete_backup(server_name: str, backup_id: str):
    success = backup_service.delete_backup(server_name, backup_id)
    if success: return jsonify({"message": "Backup deleted"}), 200
    return jsonify({"error": "Failed to delete backup"}), 500

@backup_bp.route("/backups/<server_name>/<backup_id>", methods=["GET"])
def get_backup_info(server_name: str, backup_id: str):
    info = backup_service.get_backup_info(server_name, backup_id)
    if info: return jsonify({"backup": info}), 200
    return jsonify({"error": "Backup not found"}), 404

@backup_bp.route("/backups/<server_name>/<backup_id>", methods=["PATCH"])
def rename_backup(server_name: str, backup_id: str):
    """Rename (update the alias/name of) a backup entry."""
    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"error": "Missing 'name' field"}), 400
    new_name = str(data.get("name", "")).strip()
    # Allow empty names (clears the custom name)
    success = backup_service.rename_backup(server_name, backup_id, new_name)
    if success:
        return jsonify({"message": "Backup renamed"}), 200
    return jsonify({"error": "Failed to rename backup"}), 500

@backup_bp.route("/backups/<server_name>/<backup_id>/lock", methods=["PATCH"])
def toggle_backup_lock(server_name: str, backup_id: str):
    """Toggle the lock state of a backup."""
    success = backup_service.toggle_backup_lock(server_name, backup_id)
    if success:
        return jsonify({"message": "Backup lock toggled"}), 200
    return jsonify({"error": "Failed to toggle backup lock"}), 500

@backup_bp.route("/backups/<server_name>/retention", methods=["GET"])
def get_retention(server_name: str):
    retention = backup_service.get_server_retention(server_name)
    return jsonify({"retention": retention}), 200

@backup_bp.route("/backups/<server_name>/retention", methods=["PUT"])
def set_retention(server_name: str):
    data = request.get_json()
    if not data or "retention" not in data:
        return jsonify({"error": "Missing 'retention' field"}), 400
    try:
        retention = int(data.get("retention"))
        if not (5 <= retention <= 50):
            return jsonify({"error": "Retention must be between 5 and 50"}), 400
        success = backup_service.set_server_retention(server_name, retention)
        if success:
            return jsonify({"message": "Retention updated", "retention": retention}), 200
        return jsonify({"error": "Failed to update retention"}), 500
    except ValueError:
        return jsonify({"error": "Invalid retention value"}), 400
