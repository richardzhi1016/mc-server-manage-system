import logging
import os
import re
import sqlite3

import requests
from flask import Blueprint, request, jsonify

from app.config import config
from app.services.modrinth_plugin_client import modrinth_plugin_client
from app.services.modrinth_client import ModrinthRateLimitError
from app.services.plugin_manager import plugin_manager
from app.services.server_manager import server_manager

logger = logging.getLogger(__name__)

plugins_bp = Blueprint("plugins", __name__, url_prefix="/api")

MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024  # 50MB
DOWNLOAD_TIMEOUT = 60  # seconds

_VALID_PLUGIN_FILENAME = re.compile(r"^[\w\-\.\+\[\] ]+\.(jar|jar\.disabled)$")


def _validate_server_name(name: str) -> bool:
    return ".." not in name and "/" not in name and "\\" not in name


def _get_server_info(server_name: str) -> dict | None:
    with sqlite3.connect(str(config.database_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()
    return dict(row) if row else None


def _validate_plugin_filename(filename: str) -> bool:
    if not _VALID_PLUGIN_FILENAME.match(filename):
        return False
    if ".." in filename or "/" in filename or "\\" in filename:
        return False
    return True


def _require_paper_server(server_info: dict) -> tuple | None:
    """Return error response tuple if server is not Paper."""
    server_type = (server_info.get("server_type") or "").lower()
    if server_type != "paper":
        return jsonify({"error": "Plugins are only supported for Paper servers"}), 400
    return None


# -- Search & Browse --

@plugins_bp.route("/plugins/search", methods=["GET"])
def search_plugins():
    query = request.args.get("query", "")
    version = request.args.get("version")
    page = request.args.get("page", 0, type=int)
    limit = request.args.get("limit", 20, type=int)

    if not version:
        return jsonify({"error": "Missing required param: version"}), 400

    try:
        result = modrinth_plugin_client.search_plugins(
            query=query, game_version=version, page=page, limit=limit
        )
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth plugin search error: %s", e)
        return jsonify({"error": f"Search failed: {str(e)}"}), 500


@plugins_bp.route("/plugins/<project_id>", methods=["GET"])
def get_plugin_details(project_id: str):
    try:
        result = modrinth_plugin_client.get_project(project_id)
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth plugin project error: %s", e)
        return jsonify({"error": f"Failed to get plugin details: {str(e)}"}), 500


@plugins_bp.route("/plugins/<project_id>/versions", methods=["GET"])
def get_plugin_versions(project_id: str):
    game_version = request.args.get("game_version")
    loader = request.args.get("loader", "paper")

    try:
        result = modrinth_plugin_client.get_project_versions(
            project_id, game_version=game_version, loader=loader
        )
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth plugin versions error: %s", e)
        return jsonify({"error": f"Failed to get versions: {str(e)}"}), 500


# -- Per-server plugin management --

@plugins_bp.route("/servers/<name>/plugins", methods=["GET"])
def list_installed_plugins(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_paper_server(server_info)
    if err:
        return err

    server_dir = str(config.get_server_dir(name))
    plugins = plugin_manager.scan_installed_plugins(server_dir)
    return jsonify({"plugins": plugins, "server_name": name}), 200


@plugins_bp.route("/servers/<name>/plugins/install", methods=["POST"])
def install_plugin(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_paper_server(server_info)
    if err:
        return err

    data = request.get_json()
    if not data or "project_id" not in data or "version_id" not in data:
        return jsonify({"error": "Missing project_id or version_id"}), 400

    project_id = data["project_id"]
    version_id = data["version_id"]

    try:
        download_url, filename, file_size = modrinth_plugin_client.get_download_url(version_id)

        if file_size > MAX_DOWNLOAD_SIZE:
            return jsonify({"error": f"File too large ({file_size} bytes, max {MAX_DOWNLOAD_SIZE})"}), 400

        resp = requests.get(download_url, timeout=DOWNLOAD_TIMEOUT, stream=True)
        resp.raise_for_status()

        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=8192):
            total += len(chunk)
            if total > MAX_DOWNLOAD_SIZE:
                return jsonify({"error": "Download exceeded maximum file size"}), 400
            chunks.append(chunk)

        file_data = b"".join(chunks)

        server_dir = str(config.get_server_dir(name))
        plugin_manager.install_plugin_from_bytes(
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
        logger.error("Plugin install error: %s", e)
        return jsonify({"error": f"Installation failed: {str(e)}"}), 500


@plugins_bp.route("/servers/<name>/plugins/<path:filename>/toggle", methods=["POST"])
def toggle_plugin(name: str, filename: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    if not _validate_plugin_filename(filename):
        return jsonify({"error": "Invalid plugin filename"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_paper_server(server_info)
    if err:
        return err

    # Validate path stays within plugins/
    server_dir = str(config.get_server_dir(name))
    plugins_dir = os.path.realpath(os.path.join(server_dir, "plugins"))
    target = os.path.realpath(os.path.join(plugins_dir, filename))
    if not target.startswith(plugins_dir + os.sep):
        return jsonify({"error": "Access denied: path outside plugins directory"}), 400

    try:
        new_filename = plugin_manager.toggle_plugin(server_dir, filename)
        restart_required = server_manager.is_server_running(name)
        return jsonify({
            "success": True,
            "filename": new_filename,
            "enabled": not filename.endswith(".jar.disabled"),
            "restart_required": restart_required,
        }), 200
    except FileNotFoundError:
        return jsonify({"error": "Plugin not found"}), 404
    except Exception as e:
        logger.error("Toggle plugin error: %s", e)
        return jsonify({"error": f"Toggle failed: {str(e)}"}), 500


@plugins_bp.route("/servers/<name>/plugins/<path:filename>", methods=["DELETE"])
def delete_plugin(name: str, filename: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    if not _validate_plugin_filename(filename):
        return jsonify({"error": "Invalid plugin filename"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_paper_server(server_info)
    if err:
        return err

    # Validate path stays within plugins/
    server_dir = str(config.get_server_dir(name))
    plugins_dir = os.path.realpath(os.path.join(server_dir, "plugins"))
    target = os.path.realpath(os.path.join(plugins_dir, filename))
    if not target.startswith(plugins_dir + os.sep):
        return jsonify({"error": "Access denied: path outside plugins directory"}), 400

    try:
        plugin_manager.delete_plugin(server_dir, filename)
        restart_required = server_manager.is_server_running(name)
        return jsonify({
            "success": True,
            "restart_required": restart_required,
        }), 200
    except FileNotFoundError:
        return jsonify({"error": "Plugin not found"}), 404
    except Exception as e:
        logger.error("Delete plugin error: %s", e)
        return jsonify({"error": f"Delete failed: {str(e)}"}), 500


@plugins_bp.route("/servers/<name>/plugins/check-deps", methods=["POST"])
def check_plugin_dependencies(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_paper_server(server_info)
    if err:
        return err

    data = request.get_json()
    if not data or "version_id" not in data:
        return jsonify({"error": "Missing version_id"}), 400

    version_id = data["version_id"]
    server_dir = str(config.get_server_dir(name))

    try:
        installed_ids = plugin_manager.get_installed_project_ids(server_dir)
        result = modrinth_plugin_client.check_dependencies(version_id, installed_ids)
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Plugin dependency check error: %s", e)
        return jsonify({"error": f"Dependency check failed: {str(e)}"}), 500
