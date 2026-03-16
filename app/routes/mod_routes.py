import logging
import os
import re
import sqlite3

import requests
from flask import Blueprint, request, jsonify

from app.config import config
from app.services.modrinth_client import modrinth_client, ModrinthRateLimitError
from app.services.mod_manager import mod_manager
from app.services.server_manager import server_manager

logger = logging.getLogger(__name__)

mods_bp = Blueprint("mods", __name__, url_prefix="/api")

MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024  # 50MB
DOWNLOAD_TIMEOUT = 60  # seconds

_VALID_MOD_FILENAME = re.compile(r"^[\w\-\.\+\[\] ]+\.(jar|jar\.disabled)$")


def _validate_server_name(name: str) -> bool:
    return ".." not in name and "/" not in name and "\\" not in name


def _get_server_info(server_name: str) -> dict | None:
    with sqlite3.connect(str(config.database_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()
    return dict(row) if row else None


def _validate_mod_filename(filename: str) -> bool:
    if not _VALID_MOD_FILENAME.match(filename):
        return False
    if ".." in filename or "/" in filename or "\\" in filename:
        return False
    return True


_ALLOWED_MOD_LOADERS = {"fabric", "forge"}


def _require_mod_loader_server(server_info: dict) -> tuple | None:
    """Return error response tuple if server type doesn't support mods (fabric/forge only)."""
    server_type = (server_info.get("server_type") or "").lower()
    if server_type not in _ALLOWED_MOD_LOADERS:
        return jsonify({"error": "Mods are only supported for Fabric/Forge servers"}), 400
    return None


# -- Search & Browse --

@mods_bp.route("/mods/search", methods=["GET"])
def search_mods():
    query = request.args.get("query", "")
    version = request.args.get("version")
    loader = request.args.get("loader")
    page = request.args.get("page", 0, type=int)
    limit = request.args.get("limit", 20, type=int)
    categories = request.args.getlist("categories[]") or None
    index = request.args.get("index") or None

    if not version or not loader:
        return jsonify({"error": "Missing required params: version, loader"}), 400

    try:
        result = modrinth_client.search_mods(
            query=query, loader=loader, game_version=version,
            page=page, limit=limit, categories=categories, index=index,
        )
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth search error: %s", e)
        return jsonify({"error": f"Search failed: {str(e)}"}), 500


@mods_bp.route("/mods/categories", methods=["GET"])
def get_mod_categories():
    try:
        categories = modrinth_client.get_categories("mod")
        return jsonify(categories), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Categories error: %s", e)
        return jsonify({"error": f"Failed to get categories: {str(e)}"}), 500


@mods_bp.route("/mods/<project_id>", methods=["GET"])
def get_mod_details(project_id: str):
    try:
        result = modrinth_client.get_project(project_id)
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth project error: %s", e)
        return jsonify({"error": f"Failed to get mod details: {str(e)}"}), 500


@mods_bp.route("/mods/<project_id>/versions", methods=["GET"])
def get_mod_versions(project_id: str):
    game_version = request.args.get("game_version")
    loader = request.args.get("loader")

    try:
        result = modrinth_client.get_project_versions(
            project_id, game_version=game_version, loader=loader
        )
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth versions error: %s", e)
        return jsonify({"error": f"Failed to get versions: {str(e)}"}), 500


# -- Per-server mod management --

@mods_bp.route("/servers/<name>/mods", methods=["GET"])
def list_installed_mods(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_mod_loader_server(server_info)
    if err:
        return err

    server_dir = str(config.get_server_dir(name))
    mods = mod_manager.scan_installed_mods(server_dir)
    return jsonify({"mods": mods, "server_name": name}), 200


@mods_bp.route("/servers/<name>/mods/install", methods=["POST"])
def install_mod(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_mod_loader_server(server_info)
    if err:
        return err

    data = request.get_json()
    if not data or "project_id" not in data or "version_id" not in data:
        return jsonify({"error": "Missing project_id or version_id"}), 400

    project_id = data["project_id"]
    version_id = data["version_id"]

    try:
        download_url, filename, file_size = modrinth_client.get_download_url(version_id)

        if file_size > MAX_DOWNLOAD_SIZE:
            return jsonify({"error": f"File too large ({file_size} bytes, max {MAX_DOWNLOAD_SIZE})"}), 400

        # Download the file
        resp = requests.get(download_url, timeout=DOWNLOAD_TIMEOUT, stream=True)
        resp.raise_for_status()

        # Stream with size check
        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=8192):
            total += len(chunk)
            if total > MAX_DOWNLOAD_SIZE:
                return jsonify({"error": "Download exceeded maximum file size"}), 400
            chunks.append(chunk)

        file_data = b"".join(chunks)

        server_dir = str(config.get_server_dir(name))
        mod_manager.install_mod_from_bytes(
            server_dir=server_dir,
            filename=filename,
            data=file_data,
            modrinth_project_id=project_id,
            modrinth_version_id=version_id,
        )

        restart_required = server_manager.is_server_running(name)

        return jsonify({
            "success": True,
            "filename": filename,
            "restart_required": restart_required,
        }), 200

    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Mod install error: %s", e)
        return jsonify({"error": f"Installation failed: {str(e)}"}), 500


@mods_bp.route("/servers/<name>/mods/<path:filename>/toggle", methods=["POST"])
def toggle_mod(name: str, filename: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    if not _validate_mod_filename(filename):
        return jsonify({"error": "Invalid mod filename"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_mod_loader_server(server_info)
    if err:
        return err

    # Validate path stays within mods/
    server_dir = str(config.get_server_dir(name))
    mods_dir = os.path.realpath(os.path.join(server_dir, "mods"))
    target = os.path.realpath(os.path.join(mods_dir, filename))
    if not target.startswith(mods_dir + os.sep):
        return jsonify({"error": "Access denied: path outside mods directory"}), 400

    try:
        new_filename = mod_manager.toggle_mod(server_dir, filename)
        restart_required = server_manager.is_server_running(name)
        return jsonify({
            "success": True,
            "filename": new_filename,
            "enabled": not filename.endswith(".jar.disabled"),
            "restart_required": restart_required,
        }), 200
    except FileNotFoundError:
        return jsonify({"error": "Mod not found"}), 404
    except Exception as e:
        logger.error("Toggle mod error: %s", e)
        return jsonify({"error": f"Toggle failed: {str(e)}"}), 500


@mods_bp.route("/servers/<name>/mods/<path:filename>", methods=["DELETE"])
def delete_mod(name: str, filename: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    if not _validate_mod_filename(filename):
        return jsonify({"error": "Invalid mod filename"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_mod_loader_server(server_info)
    if err:
        return err

    # Validate path stays within mods/
    server_dir = str(config.get_server_dir(name))
    mods_dir = os.path.realpath(os.path.join(server_dir, "mods"))
    target = os.path.realpath(os.path.join(mods_dir, filename))
    if not target.startswith(mods_dir + os.sep):
        return jsonify({"error": "Access denied: path outside mods directory"}), 400

    try:
        mod_manager.delete_mod(server_dir, filename)
        restart_required = server_manager.is_server_running(name)
        return jsonify({
            "success": True,
            "restart_required": restart_required,
        }), 200
    except FileNotFoundError:
        return jsonify({"error": "Mod not found"}), 404
    except Exception as e:
        logger.error("Delete mod error: %s", e)
        return jsonify({"error": f"Delete failed: {str(e)}"}), 500


@mods_bp.route("/servers/<name>/mods/check-deps", methods=["POST"])
def check_dependencies(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_mod_loader_server(server_info)
    if err:
        return err

    data = request.get_json()
    if not data or "version_id" not in data:
        return jsonify({"error": "Missing version_id"}), 400

    version_id = data["version_id"]
    server_dir = str(config.get_server_dir(name))

    try:
        installed_ids = mod_manager.get_installed_project_ids(server_dir)
        result = modrinth_client.check_dependencies(version_id, installed_ids)
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Dependency check error: %s", e)
        return jsonify({"error": f"Dependency check failed: {str(e)}"}), 500
