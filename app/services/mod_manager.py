import json
import logging
import os
import threading
import zipfile
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class ModManager:
    """Manages mod files in server mods/ directories."""

    def __init__(self) -> None:
        self._locks: dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()

    def _get_lock(self, server_dir: str) -> threading.Lock:
        with self._global_lock:
            if server_dir not in self._locks:
                self._locks[server_dir] = threading.Lock()
            return self._locks[server_dir]

    def _mods_dir(self, server_dir: str) -> str:
        return os.path.join(server_dir, "mods")

    def _metadata_path(self, server_dir: str) -> str:
        return os.path.join(self._mods_dir(server_dir), "mods_metadata.json")

    def _read_metadata(self, server_dir: str) -> dict[str, Any]:
        path = self._metadata_path(server_dir)
        if not os.path.exists(path):
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            logger.warning("Failed to read mods_metadata.json, starting fresh")
            return {}

    def _write_metadata(self, server_dir: str, metadata: dict[str, Any]) -> None:
        path = self._metadata_path(server_dir)
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
        os.replace(tmp_path, path)

    def _parse_fabric_mod_json(self, jar_path: str) -> dict[str, Any] | None:
        try:
            with zipfile.ZipFile(jar_path, "r") as zf:
                if "fabric.mod.json" not in zf.namelist():
                    return None
                raw = zf.read("fabric.mod.json")
                return json.loads(raw)
        except (zipfile.BadZipFile, json.JSONDecodeError, OSError):
            return None

    def scan_installed_mods(self, server_dir: str) -> list[dict[str, Any]]:
        mods_dir = self._mods_dir(server_dir)
        if not os.path.exists(mods_dir):
            return []

        metadata = self._read_metadata(server_dir)
        result = []

        for filename in sorted(os.listdir(mods_dir)):
            if not (filename.endswith(".jar") or filename.endswith(".jar.disabled")):
                continue

            filepath = os.path.join(mods_dir, filename)
            if not os.path.isfile(filepath):
                continue

            stat = os.stat(filepath)
            enabled = not filename.endswith(".jar.disabled")

            # Parse fabric.mod.json
            mod_json = self._parse_fabric_mod_json(filepath)

            # Get metadata entry
            meta_entry = metadata.get(filename, {})

            mod_info: dict[str, Any] = {
                "filename": filename,
                "enabled": enabled,
                "mod_id": mod_json.get("id") if mod_json else None,
                "name": (mod_json.get("name") if mod_json else None) or filename,
                "version": mod_json.get("version") if mod_json else None,
                "description": mod_json.get("description") if mod_json else None,
                "authors": mod_json.get("authors", []) if mod_json else [],
                "file_size": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "modrinth_project_id": meta_entry.get("modrinth_project_id"),
            }
            result.append(mod_info)

        return result

    def toggle_mod(self, server_dir: str, filename: str) -> str:
        """Toggle mod enabled/disabled. Returns new filename."""
        with self._get_lock(server_dir):
            mods_dir = self._mods_dir(server_dir)
            filepath = os.path.join(mods_dir, filename)

            if not os.path.exists(filepath):
                raise FileNotFoundError(f"Mod file not found: {filename}")

            if filename.endswith(".jar.disabled"):
                new_filename = filename[: -len(".disabled")]
            elif filename.endswith(".jar"):
                new_filename = filename + ".disabled"
            else:
                raise ValueError(f"Invalid mod filename: {filename}")

            new_filepath = os.path.join(mods_dir, new_filename)
            os.rename(filepath, new_filepath)

            # Update metadata keys
            metadata = self._read_metadata(server_dir)
            if filename in metadata:
                metadata[new_filename] = metadata.pop(filename)
                self._write_metadata(server_dir, metadata)

            return new_filename

    def delete_mod(self, server_dir: str, filename: str) -> None:
        """Delete a mod file and its metadata entry."""
        with self._get_lock(server_dir):
            mods_dir = self._mods_dir(server_dir)
            filepath = os.path.join(mods_dir, filename)

            if not os.path.exists(filepath):
                raise FileNotFoundError(f"Mod file not found: {filename}")

            os.remove(filepath)

            # Remove from metadata
            metadata = self._read_metadata(server_dir)
            if filename in metadata:
                del metadata[filename]
                self._write_metadata(server_dir, metadata)

    def install_mod_from_bytes(
        self,
        server_dir: str,
        filename: str,
        data: bytes,
        modrinth_project_id: str,
        modrinth_version_id: str,
    ) -> None:
        """Install a mod by writing bytes to mods/ and updating metadata."""
        with self._get_lock(server_dir):
            mods_dir = self._mods_dir(server_dir)
            os.makedirs(mods_dir, exist_ok=True)

            filepath = os.path.join(mods_dir, filename)
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
        """Return set of Modrinth project IDs for installed mods."""
        metadata = self._read_metadata(server_dir)
        return {
            entry["modrinth_project_id"]
            for entry in metadata.values()
            if entry.get("modrinth_project_id")
        }


# Module-level singleton
mod_manager = ModManager()
