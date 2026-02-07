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

    def list_backups(self, server_name: str | None = None) -> list[dict[str, Any]]:
        """List all backups, optionally filtered by server name."""
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

    def create_backup(self, server_name: str, backup_type: str = "manual") -> dict[str, Any] | None:
        """Create a backup of a server."""
        backups_dir = get_backups_dir()
        os.makedirs(backups_dir, exist_ok=True)

        server_dir = str(config.get_server_dir(server_name))
        if not os.path.exists(server_dir):
            return None

        # Filename format: servername_YYYYMMDD_HHMMSS_type.tar.gz
        backup_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename_base = f"{server_name}_{backup_id}_{backup_type}"
        
        # Override get_backup_path logic locally or update helper? 
        # For now, let's construct path manually here to include type in filename
        # Ideally we update helpers but let's stick to local change for now to see
        # actually, listing relies on filename pattern? 
        # The existing list_backups relies on .json files.
        # Let's keep backup_id simple for the ID itself, but filename can differ.
        
        # Let's stick to the current ID format but append type to filename
        backup_path = str(config.get_backup_dir() / f"{backup_filename_base}.tar.gz")
        info_path = str(config.get_backup_dir() / f"{backup_filename_base}.json")

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
                "type": backup_type
            }

            with open(info_path, "w", encoding="utf-8") as f:
                json.dump(info, f, indent=2)

            self._enforce_retention_policy(server_name)

            return info
        except Exception:
            return None

    def restore_backup(self, server_name: str, backup_id: str) -> bool:
        """Restore a server from a backup."""
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
        """Delete old backups based on smart retention policy (Ported from openmc.py)."""
        if server_name:
            backups = self.list_backups(server_name)
        else:
            backups = self.list_backups()

        # Validate retention count
        keep_count = self.BACKUP_RETENTION
        if keep_count < 5:
            # Fallback to safe minimum if configured too low (though currently hardcoded)
            keep_count = 5

        total_backups = len(backups)
        if total_backups <= keep_count:
            return 0

        # Smart pruning settings
        min_per_type = max(0, (keep_count - 1) // 4)
        deleted_count = 0

        # Backups are sorted by created_at desc (newest first)
        # So backups[0] is the latest one.
        latest_backup = backups[0]
        latest_type = latest_backup.get('type', 'manual')

        # While loop to delete unnecessary backups
        while len(backups) > keep_count:
            # Categorize remaining backups (excluding the absolute latest which is safe)
            candidates = backups[1:] # All except the newest
            
            startup_backups = [b for b in candidates if b.get('type') == 'startup']
            manual_backups = [b for b in candidates if b.get('type', 'manual') == 'manual']
            periodic_backups = [b for b in candidates if b.get('type') == 'periodic']

            counts = {
                'startup': len(startup_backups),
                'manual': len(manual_backups),
                'periodic': len(periodic_backups)
            }

            # Find types that exceed minimum requirement
            deletable_types = [(t, c) for t, c in counts.items() if c > min_per_type]
            
            if not deletable_types:
                # Should not happen given logic, but safety break
                break

            # 1. Find max count
            max_count = max(c for t, c in deletable_types)
            max_types = [t for t, c in deletable_types if c == max_count]
            
            target_type = None
            to_delete = None

            # 2. Tie-breaking logic (Exact match of openmc.py)
            if len(max_types) == 1:
                # Case 1: Single type has max count
                target_type = max_types[0]
                # Delete oldest of this type
                if target_type == 'startup': to_delete = startup_backups[-1]
                elif target_type == 'manual': to_delete = manual_backups[-1]
                else: to_delete = periodic_backups[-1]

            elif len(max_types) == 2:
                # Case 2: Two-way tie
                if latest_type in max_types:
                    # Latest type is in tie -> pick that type to create churn
                    target_type = latest_type
                    if target_type == 'startup': to_delete = startup_backups[-1]
                    elif target_type == 'manual': to_delete = manual_backups[-1]
                    else: to_delete = periodic_backups[-1]
                else:
                    # Latest type NOT in tie -> Delete absolute oldest among the two types
                    candidates_in_tie = []
                    if 'startup' in max_types: candidates_in_tie.extend(startup_backups)
                    if 'manual' in max_types: candidates_in_tie.extend(manual_backups)
                    if 'periodic' in max_types: candidates_in_tie.extend(periodic_backups)
                    
                    # Sort by created_at desc (newest first), so last is oldest
                    # Verify sort order: list_backups returns desc
                    # We need the OLDEST, so we pick the last one.
                    # Wait, we need to sort candidates_in_tie correctly if we merged them.
                    # Since individual lists are sorted desc, merging them needs re-sort.
                    candidates_in_tie.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                    if candidates_in_tie:
                        to_delete = candidates_in_tie[-1]

            elif len(max_types) == 3:
                # Case 3: Three-way tie -> Pick latest backup type
                target_type = latest_type
                if target_type == 'startup': to_delete = startup_backups[-1]
                elif target_type == 'manual': to_delete = manual_backups[-1]
                else: to_delete = periodic_backups[-1]

            # Execute deletion
            if to_delete and self.delete_backup_by_info(to_delete):
                deleted_count += 1
                backups.remove(to_delete)
            else:
                # If deletion fails, break loop to avoid infinite loop
                break

        return deleted_count

    def delete_backup_by_info(self, info: dict[str, Any]) -> bool:
        """Helper to delete backup using info dict."""
        # Use filename from info if available, else standard construction might fail if type is missing
        # Standard delete_backup uses standard path construction which might miss the localized filename
        # So we should implement a robust deletion here.
        backups_dir = get_backups_dir()
        filename = info.get("filename")
        if not filename:
             return self.delete_backup(info.get("server_name"), info.get("id"))

        backup_path = os.path.join(backups_dir, filename)
        # Assuming json config file has same basename but .json
        info_path_name = os.path.splitext(filename)[0] + ".json"
        info_path = os.path.join(backups_dir, info_path_name)

        try:
            if os.path.exists(backup_path):
                os.remove(backup_path)
            if os.path.exists(info_path):
                os.remove(info_path)
            return True
        except Exception:
            return False

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
