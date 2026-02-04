from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from app.services.server_manager import server_manager

files_bp = Blueprint("files", __name__, url_prefix="/api/servers")

@files_bp.route("/<server_name>/files", methods=["GET"])
def list_server_files(server_name: str):
    path = request.args.get("path", "")
    is_valid, error, items = server_manager.list_server_files(server_name, path)
    if not is_valid: return jsonify({"error": error}), 403
    return jsonify({"path": path, "items": items}), 200

@files_bp.route("/<server_name>/files/*path", methods=["GET"])
def read_server_file(server_name: str, path: str):
    import os
    is_valid, error, abs_path = server_manager.validate_server_path(server_name, path)
    if not is_valid: return jsonify({"error": error}), 403
    if not os.path.exists(abs_path): return jsonify({"error": "File not found"}), 404
    if os.path.isdir(abs_path): return jsonify({"error": "Path is a directory"}), 400
    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return jsonify({"content": content, "file": server_manager.get_file_info(abs_path)}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@files_bp.route("/<server_name>/files/*path", methods=["PUT"])
def write_server_file(server_name: str, path: str):
    import os
    is_valid, error, abs_path = server_manager.validate_server_path(server_name, path)
    if not is_valid: return jsonify({"error": error}), 403
    data = request.get_json()
    if not data or "content" not in data: return jsonify({"error": "Missing content"}), 400
    try:
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f: f.write(data["content"])
        return jsonify({"message": "File saved"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@files_bp.route("/<server_name>/files/*path", methods=["POST"])
def create_server_folder(server_name: str, path: str):
    import os
    is_valid, error, abs_path = server_manager.validate_server_path(server_name, path)
    if not is_valid: return jsonify({"error": error}), 403
    try:
        os.makedirs(abs_path, exist_ok=True)
        return jsonify({"message": "Folder created"}), 201
    except Exception as e: return jsonify({"error": str(e)}), 500

@files_bp.route("/<server_name>/files/*path", methods=["DELETE"])
def delete_server_file(server_name: str, path: str):
    import os, shutil
    is_valid, error, abs_path = server_manager.validate_server_path(server_name, path)
    if not is_valid: return jsonify({"error": error}), 403
    if not os.path.exists(abs_path): return jsonify({"error": "Path not found"}), 404
    try:
        if os.path.isdir(abs_path): shutil.rmtree(abs_path)
        else: os.remove(abs_path)
        return jsonify({"message": "Deleted"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@files_bp.route("/<server_name>/upload", methods=["POST"])
def upload_server_file(server_name: str):
    import os
    path = request.form.get("path", "")
    is_valid, error, abs_base_path = server_manager.validate_server_path(server_name, path)
    if not is_valid: return jsonify({"error": error}), 403
    if "file" not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    if file.filename == "": return jsonify({"error": "No file selected"}), 400
    try:
        filename = secure_filename(file.filename) if file.filename else "uploaded_file"
        file_path = os.path.join(abs_base_path, filename)
        os.makedirs(abs_base_path, exist_ok=True)
        file.save(file_path)
        return jsonify({"message": "File uploaded", "filename": filename}), 201
    except Exception as e: return jsonify({"error": str(e)}), 500

@files_bp.route("/<server_name>/rename", methods=["POST"])
def rename_server_file(server_name: str):
    """Rename a file or folder."""
    import os
    data = request.get_json()
    if not data or "path" not in data or "new_name" not in data:
        return jsonify({"error": "Missing path or new_name"}), 400

    path = data["path"]
    new_name = data["new_name"]

    is_valid, error, abs_path = server_manager.validate_server_path(server_name, path)
    if not is_valid:
        return jsonify({"error": error}), 403

    if not os.path.exists(abs_path):
        return jsonify({"error": "File not found"}), 404

    # Sanitize new name and build new path
    safe_name = secure_filename(new_name) if new_name else ""
    if not safe_name:
        return jsonify({"error": "Invalid file name"}), 400

    new_path = os.path.join(os.path.dirname(abs_path), safe_name)

    if os.path.exists(new_path):
        return jsonify({"error": "A file with that name already exists"}), 409

    try:
        os.rename(abs_path, new_path)
        return jsonify({"message": "Renamed successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@files_bp.route("/<server_name>/download/*path", methods=["GET"])
def download_server_file(server_name: str, path: str):
    import os
    is_valid, error, abs_path = server_manager.validate_server_path(server_name, path)
    if not is_valid: return jsonify({"error": error}), 403
    if not os.path.exists(abs_path): return jsonify({"error": "File not found"}), 404
    if os.path.isdir(abs_path): return jsonify({"error": "Cannot download directory"}), 400
    try:
        return send_file(abs_path, as_attachment=True, download_name=os.path.basename(abs_path))
    except Exception as e: return jsonify({"error": str(e)}), 500
