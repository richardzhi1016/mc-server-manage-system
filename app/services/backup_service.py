import json
import os
import shutil
import tarfile
from datetime import datetime
from typing import Any
from app.config import config


def get_backups_dir() -> str:
    """Get the absolute path to the backups directory."""
    return str(config.get_backup_dir())


def get_backup_path(server_name: str, backup_id: str) -> str:
    """Get the path to a specific backup file."""
    return str(config.get_backup_dir() / f"{server_name}_{backup_id}.tar.gz")


def get_backup_info_path(server_name: str, backup_id: str) -> str:
    """Get the path to a backup info JSON file."""
    return str(config.get_backup_dir() / f"{server_name}_{backup_id}.json")


class BackupService:
    """Service class for managing server backups."""

    BACKUP_RETENTION = 10
    SCHEDULER_FILE = "scheduler.json"

    def list_backups(self, server_name: str | None = None) -> list[dict[str, Any]]:
        """List all backups, optionally filtered by server name."""
        import os

        backups_dir = get_backups_dir()

        if not os.path.exists(backups_dir):
            return []

        backups = []
        for filename in os.listdir(backups_dir):
            if filename.endswith(".json"):
                try:
                    filepath = os.path.join(backups_dir, filename)
                    with open(filepath, "r", encoding="utf-8") as f:
                        info = json.load(f)
                    if server_name is None or info.get("server_name") == server_name:
                        backups.append(info)
                except Exception:
                    continue

        backups.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return backups

    def create_backup(self, server_name: str) -> dict[str, Any] | None:
        """Create a backup of a server."""
        import os
        import shutil

        backups_dir = get_backups_dir()
        os.makedirs(backups_dir, exist_ok=True)

        server_dir = str(config.get_server_dir(server_name))
        if not os.path.exists(server_dir):
            return None

        backup_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = get_backup_path(server_name, backup_id)
        info_path = get_backup_info_path(server_name, backup_id)

        try:
            props_src = os.path.join(server_dir, "server.properties")
            props_bak = os.path.join(backups_dir, f"properties_{backup_id}.bak")
            if os.path.exists(props_src):
                shutil.copy(props_src, props_bak)

            with tarfile.open(backup_path, "w:gz") as tar:
                tar.add(server_dir, arcname=os.path.basename(server_dir))

            file_size = os.path.getsize(backup_path)

            info = {
                "id": backup_id,
                "server_name": server_name,
                "created_at": datetime.now().isoformat(),
                "size": file_size,
                "filename": os.path.basename(backup_path),
            }

            with open(info_path, "w", encoding="utf-8") as f:
                json.dump(info, f, indent=2)

            self._enforce_retention_policy(server_name)

            return info
        except Exception:
            return None

    def restore_backup(self, server_name: str, backup_id: str) -> bool:
        """Restore a server from a backup."""
        import os

        os.makedirs(str(config.get_server_dir(server_name)), exist_ok=True)

        backup_path = get_backup_path(server_name, backup_id)
        server_dir = str(config.get_server_dir(server_name))
        backups_dir = get_backups_dir()

        if not os.path.exists(backup_path):
            return False

        try:
            if os.path.exists(server_dir):
                shutil.rmtree(server_dir)

            os.makedirs(server_dir, exist_ok=True)

            with tarfile.open(backup_path, "r:gz") as tar:
                tar.extractall(os.path.dirname(server_dir))

            for item in os.listdir(os.path.dirname(server_dir)):
                if item.startswith(server_name) and item != server_name and "_" in item:
                    full_path = os.path.join(os.path.dirname(server_dir), item)
                    if os.path.isdir(full_path):
                        contents = os.listdir(full_path)
                        for c in contents:
                            shutil.move(
                                os.path.join(full_path, c), os.path.dirname(server_dir)
                            )
                        shutil.rmtree(full_path)
                        break

            props_bak = os.path.join(backups_dir, f"properties_{backup_id}.bak")
            if os.path.exists(props_bak):
                shutil.copy(props_bak, os.path.join(server_dir, "server.properties"))
                os.remove(props_bak)

            return True
        except Exception:
            return False

    def delete_backup(self, server_name: str, backup_id: str) -> bool:
        """Delete a backup."""
        import os

        backup_path = get_backup_path(server_name, backup_id)
        info_path = get_backup_info_path(server_name, backup_id)

        try:
            if os.path.exists(backup_path):
                os.remove(backup_path)
            if os.path.exists(info_path):
                os.remove(info_path)
            return True
        except Exception:
            return False

    def _enforce_retention_policy(self, server_name: str | None = None) -> int:
        """Delete old backups exceeding retention limit."""
        if server_name:
            backups = self.list_backups(server_name)
        else:
            backups = self.list_backups()

        deleted = 0
        for backup in backups[self.BACKUP_RETENTION :]:
            if self.delete_backup(backup["server_name"], backup["id"]):
                deleted += 1

        return deleted

    def get_backup_info(
        self, server_name: str, backup_id: str
    ) -> dict[str, Any] | None:
        """Get information about a specific backup."""

        info_path = get_backup_info_path(server_name, backup_id)

        if not os.path.exists(info_path):
            return None

        try:
            with open(info_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None


backup_service = BackupService()
