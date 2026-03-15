import json
import logging
import os
import threading
import zipfile
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class PluginManager:
    """Manages plugin files in server plugins/ directories."""

    def __init__(self) -> None:
        self._locks: dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()

    def _get_lock(self, server_dir: str) -> threading.Lock:
        with self._global_lock:
            if server_dir not in self._locks:
                self._locks[server_dir] = threading.Lock()
            return self._locks[server_dir]

    def _plugins_dir(self, server_dir: str) -> str:
        return os.path.join(server_dir, "plugins")

    def _metadata_path(self, server_dir: str) -> str:
        return os.path.join(self._plugins_dir(server_dir), "plugins_metadata.json")

    def _read_metadata(self, server_dir: str) -> dict[str, Any]:
        path = self._metadata_path(server_dir)
        if not os.path.exists(path):
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            logger.warning("Failed to read plugins_metadata.json, starting fresh")
            return {}

    def _write_metadata(self, server_dir: str, metadata: dict[str, Any]) -> None:
        path = self._metadata_path(server_dir)
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
        os.replace(tmp_path, path)

    def _parse_plugin_yml(self, jar_path: str) -> dict[str, Any] | None:
        """Extract basic metadata from plugin.yml inside the JAR without PyYAML."""
        try:
            with zipfile.ZipFile(jar_path, "r") as zf:
                if "plugin.yml" not in zf.namelist():
                    return None
                raw = zf.read("plugin.yml").decode("utf-8", errors="replace")

            result: dict[str, Any] = {}
            for line in raw.splitlines():
                # Skip comments and blank lines
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                # Only parse top-level keys (no leading whitespace = not nested)
                if line[0].isspace():
                    continue
                if ":" not in stripped:
                    continue

                key, _, value = stripped.partition(":")
                key = key.strip()
                value = value.strip().strip('"').strip("'")

                if key in ("name", "version", "description", "author", "main"):
                    result[key] = value
                elif key == "authors":
                    # Handle inline list: authors: [Author1, Author2]
                    if value.startswith("[") and "]" in value:
                        inner = value[1:value.index("]")]
                        result["authors"] = [
                            a.strip().strip('"').strip("'")
                            for a in inner.split(",")
                            if a.strip()
                        ]

            return result if result else None
        except (zipfile.BadZipFile, OSError, UnicodeDecodeError):
            return None

    def scan_installed_plugins(self, server_dir: str) -> list[dict[str, Any]]:
        plugins_dir = self._plugins_dir(server_dir)
        if not os.path.exists(plugins_dir):
            return []

        metadata = self._read_metadata(server_dir)
        result = []

        for filename in sorted(os.listdir(plugins_dir)):
            if not (filename.endswith(".jar") or filename.endswith(".jar.disabled")):
                continue

            filepath = os.path.join(plugins_dir, filename)
            if not os.path.isfile(filepath):
                continue

            stat = os.stat(filepath)
            enabled = not filename.endswith(".jar.disabled")

            plugin_yml = self._parse_plugin_yml(filepath)
            meta_entry = metadata.get(filename, {})

            # Resolve authors list
            authors: list[str] = []
            if plugin_yml:
                authors = plugin_yml.get("authors", [])
                if not authors and plugin_yml.get("author"):
                    authors = [plugin_yml["author"]]

            plugin_info: dict[str, Any] = {
                "filename": filename,
                "enabled": enabled,
                "name": (plugin_yml.get("name") if plugin_yml else None) or filename,
                "version": plugin_yml.get("version") if plugin_yml else None,
                "description": plugin_yml.get("description") if plugin_yml else None,
                "authors": authors,
                "file_size": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "modrinth_project_id": meta_entry.get("modrinth_project_id"),
            }
            result.append(plugin_info)

        return result

    def toggle_plugin(self, server_dir: str, filename: str) -> str:
        """Toggle plugin enabled/disabled. Returns new filename."""
        with self._get_lock(server_dir):
            plugins_dir = self._plugins_dir(server_dir)
            filepath = os.path.join(plugins_dir, filename)

            if not os.path.exists(filepath):
                raise FileNotFoundError(f"Plugin file not found: {filename}")

            if filename.endswith(".jar.disabled"):
                new_filename = filename[: -len(".disabled")]
            elif filename.endswith(".jar"):
                new_filename = filename + ".disabled"
            else:
                raise ValueError(f"Invalid plugin filename: {filename}")

            new_filepath = os.path.join(plugins_dir, new_filename)
            os.rename(filepath, new_filepath)

            # Update metadata keys
            metadata = self._read_metadata(server_dir)
            if filename in metadata:
                metadata[new_filename] = metadata.pop(filename)
                self._write_metadata(server_dir, metadata)

            return new_filename

    def delete_plugin(self, server_dir: str, filename: str) -> None:
        """Delete a plugin file and its metadata entry."""
        with self._get_lock(server_dir):
            plugins_dir = self._plugins_dir(server_dir)
            filepath = os.path.join(plugins_dir, filename)

            if not os.path.exists(filepath):
                raise FileNotFoundError(f"Plugin file not found: {filename}")

            os.remove(filepath)

            # Remove from metadata
            metadata = self._read_metadata(server_dir)
            if filename in metadata:
                del metadata[filename]
                self._write_metadata(server_dir, metadata)

    def install_plugin_from_bytes(
        self,
        server_dir: str,
        filename: str,
        data: bytes,
        modrinth_project_id: str,
        modrinth_version_id: str,
    ) -> None:
        """Install a plugin by writing bytes to plugins/ and updating metadata."""
        with self._get_lock(server_dir):
            plugins_dir = self._plugins_dir(server_dir)
            os.makedirs(plugins_dir, exist_ok=True)

            filepath = os.path.join(plugins_dir, filename)
            tmp_path = filepath + ".downloading"

            try:
                with open(tmp_path, "wb") as f:
                    f.write(data)
                os.replace(tmp_path, filepath)
            except Exception:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                raise

            # Update metadata
            metadata = self._read_metadata(server_dir)
            metadata[filename] = {
                "modrinth_project_id": modrinth_project_id,
                "modrinth_version_id": modrinth_version_id,
                "installed_at": datetime.now(tz=timezone.utc).isoformat(),
            }
            self._write_metadata(server_dir, metadata)

    def get_installed_project_ids(self, server_dir: str) -> set[str]:
        """Return set of Modrinth project IDs for installed plugins."""
        metadata = self._read_metadata(server_dir)
        return {
            entry["modrinth_project_id"]
            for entry in metadata.values()
            if entry.get("modrinth_project_id")
        }


# Module-level singleton
plugin_manager = PluginManager()
