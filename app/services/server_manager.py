import logging
import os
import re
from typing import Any
from app.config import config

logger = logging.getLogger(__name__)


def parse_log_level(line: str) -> str:
    """Extract log level from a log line."""
    for level, pattern in config.log_level_patterns.items():
        if re.search(pattern, line):
            return level
    return "INFO"


def validate_server_structure(server_dir: str) -> tuple[bool, dict[str, Any]]:
    """Validate if the extracted files contain a valid Minecraft server structure."""
    root_items = os.listdir(server_dir)
    jar_files = [f for f in root_items if f.endswith(".jar")]
    has_jar = len(jar_files) > 0

    if has_jar:
        structure_info = f"[OK] JAR files found: {', '.join(jar_files)}"
    else:
        structure_info = "[MISSING] No JAR files in root directory"

    return has_jar, {
        "jar_files": jar_files,
        "jar_count": len(jar_files),
        "structure_info": structure_info,
    }


def find_server_jar(server_dir: str) -> str | None:
    """Find the server JAR file in the server directory."""
    if not os.path.exists(server_dir):
        return None
    for file in os.listdir(server_dir):
        if file.endswith(".jar"):
            return file
    return None


class ServerManager:
    """Service class for managing Minecraft server operations."""

    def __init__(self):
        self.running_servers: dict[str, Any] = {}

    def is_server_running(self, server_name: str) -> bool:
        """Check if a server is currently running."""
        if server_name not in self.running_servers:
            return False
        return self.running_servers[server_name].is_alive()

    def get_running_servers(self) -> dict[str, dict[str, Any]]:
        """Get status of all running servers."""
        status = {}
        for server_name, watcher in list(self.running_servers.items()):
            if watcher.is_alive():
                status[server_name] = {"running": True, "pid": watcher.pid}
            else:
                status[server_name] = {"running": False, "exit_code": None}
                del self.running_servers[server_name]
        return status

    def validate_server_path(
        self, server_name: str, path: str
    ) -> tuple[bool, str, str]:
        """Validate and sanitize a file path for a server."""
        server_dir = os.path.realpath(str(config.get_server_dir(server_name)))

        if not os.path.exists(server_dir):
            return False, f"Server '{server_name}' not found", ""

        safe_path = os.path.normpath(path) if path else ""

        # Reject any path component that navigates upward
        if ".." in safe_path.split(os.sep):
            return False, "Invalid path: directory traversal not allowed", ""

        if safe_path and safe_path != ".":
            abs_path = os.path.realpath(os.path.join(server_dir, safe_path))
        else:
            abs_path = server_dir

        # Ensure resolved path is within server_dir (with separator boundary)
        if not (abs_path == server_dir or abs_path.startswith(server_dir + os.sep)):
            return False, "Access denied: path outside server directory", ""

        return True, "", abs_path

    def get_file_info(self, file_path: str, server_dir: str = "") -> dict[str, Any]:
        """Get file information for the API response.

        Args:
            file_path: Absolute path to the file.
            server_dir: The server root directory to compute relative paths from.
        """
        is_dir = os.path.isdir(file_path)
        stat = os.stat(file_path)
        if server_dir:
            rel_path = os.path.relpath(file_path, server_dir)
        else:
            rel_path = os.path.basename(file_path)
        # Normalize to forward slashes for consistent API responses
        rel_path = rel_path.replace("\\", "/")
        return {
            "name": os.path.basename(file_path),
            "path": rel_path,
            "is_directory": is_dir,
            "size": stat.st_size if not is_dir else 0,
            "modified": stat.st_mtime,
        }

    def list_server_files(
        self, server_name: str, path: str = ""
    ) -> tuple[bool, str, list[dict[str, Any]]]:
        """List directory contents for a server."""
        is_valid, error, abs_path = self.validate_server_path(server_name, path)
        if not is_valid:
            return False, error, []

        if not os.path.exists(abs_path):
            return False, "Path not found", []

        if not os.path.isdir(abs_path):
            return False, "Path is not a directory", []

        server_dir = os.path.realpath(str(config.get_server_dir(server_name)))

        try:
            items = []
            for item in os.listdir(abs_path):
                item_path = os.path.join(abs_path, item)
                items.append(self.get_file_info(item_path, server_dir))
            items.sort(key=lambda x: (not x["is_directory"], x["name"].lower()))
            return True, "", items
        except PermissionError:
            return False, "Permission denied", []


def update_server_properties_port(server_dir: str, new_port: int) -> bool:
    """Update the server-port value in server.properties.

    Reads the file, replaces the server-port line (or appends it),
    and writes the updated content back.

    Returns True on success, False if the file is missing or on error.
    """
    props_path = os.path.join(server_dir, "server.properties")
    if not os.path.exists(props_path):
        return False

    try:
        with open(props_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        new_lines = []
        port_found = False
        for line in lines:
            if line.strip().startswith("server-port="):
                new_lines.append(f"server-port={new_port}\n")
                port_found = True
            else:
                new_lines.append(line)

        if not port_found:
            new_lines.append(f"server-port={new_port}\n")

        with open(props_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        return True
    except Exception as e:
        logger.error("Failed to update server.properties port: %s", e)
        return False


server_manager = ServerManager()
