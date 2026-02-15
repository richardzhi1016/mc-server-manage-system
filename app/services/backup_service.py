import json
import os
import shutil
import tarfile
from datetime import datetime
from typing import Any
from app.config import config


# World folder patterns to backup (only backup existing ones)
WORLD_PATTERNS = ["world", "world_nether", "world_the_end"]


def get_backups_dir() -> str:
    """Get the absolute path to the backups directory."""
    return str(config.get_backup_dir())


def get_server_backup_dir(server_name: str) -> str:
    """Get the backup directory for a specific server."""
    return str(config.get_server_backup_dir(server_name))


def get_backup_path(server_name: str, backup_filename_base: str) -> str:
    """Get the path to a specific backup directory."""
    return str(config.get_server_backup_dir(server_name) / backup_filename_base)


def get_backup_info_path(server_name: str, backup_filename_base: str, backup_type: str = "manual") -> str:
    """Get the path to a backup info JSON file."""
    backup_folder = config.get_server_backup_dir(server_name) / f"backup-{backup_filename_base}_{backup_type}"
    return str(backup_folder / f"{backup_filename_base}.json")


class BackupService:
    """Service class for managing server backups."""

    BACKUP_RETENTION = 10

    def list_backups(self, server_name: str | None = None) -> list[dict[str, Any]]:
        """List all backups, optionally filtered by server name."""
        backups_dir = get_backups_dir()

        if not os.path.exists(backups_dir):
            return []

        backups = []
        
        # If server_name is specified, only search that server's directory
        if server_name:
            server_dirs = [server_name] if os.path.exists(os.path.join(backups_dir, server_name)) else []
        else:
            # List all server backup directories
            try:
                server_dirs = [d for d in os.listdir(backups_dir) 
                              if os.path.isdir(os.path.join(backups_dir, d))]
            except Exception:
                server_dirs = []
        
        for server_dir_name in server_dirs:
            server_backup_path = os.path.join(backups_dir, server_dir_name)
            try:
                # Look for backup folders (format: backup-YYYYMMDD-HHMMSS_type)
                for folder_name in os.listdir(server_backup_path):
                    folder_path = os.path.join(server_backup_path, folder_name)
                    if os.path.isdir(folder_path) and folder_name.startswith("backup-"):
                        # Look for json file inside the backup folder
                        for filename in os.listdir(folder_path):
                            if filename.endswith(".json"):
                                try:
                                    filepath = os.path.join(folder_path, filename)
                                    with open(filepath, "r", encoding="utf-8") as f:
                                        info = json.load(f)
                                    backups.append(info)
                                except Exception:
                                    continue
            except Exception:
                continue

        backups.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return backups

    def create_backup(self, server_name: str, backup_type: str = "manual") -> dict[str, Any] | None:
        """Create a backup of a server (world data only)."""
        # Get server-specific backup directory
        server_backup_dir = get_server_backup_dir(server_name)

        server_dir = str(config.get_server_dir(server_name))
        if not os.path.exists(server_dir):
            return None

        # Find existing world folders to backup
        world_folders = []
        for pattern in WORLD_PATTERNS:
            world_path = os.path.join(server_dir, pattern)
            if os.path.exists(world_path) and os.path.isdir(world_path):
                world_folders.append(pattern)
        
        if not world_folders:
            # No world folders found, nothing to backup
            return None

        # Filename format: backup-YYYYMMDD-HHMMSS_type/
        backup_id = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_filename_base = f"backup-{backup_id}_{backup_type}"
        backup_folder = os.path.join(server_backup_dir, backup_filename_base)
        backup_filename = f"{backup_filename_base}.tar.gz"
        
        os.makedirs(backup_folder, exist_ok=True)
        backup_path = os.path.join(backup_folder, backup_filename)
        info_path = os.path.join(backup_folder, f"{backup_filename_base}.json")

        try:
            # Backup server.properties as well (useful for restore)
            props_src = os.path.join(server_dir, "server.properties")
            props_bak = os.path.join(backup_folder, f"properties_{backup_id}.bak")
            if os.path.exists(props_src):
                shutil.copy(props_src, props_bak)

            # Only archive world folders (not the entire server directory)
            with tarfile.open(backup_path, "w:gz") as tar:
                for world_folder in world_folders:
                    world_path = os.path.join(server_dir, world_folder)
                    tar.add(world_path, arcname=world_folder)

            file_size = os.path.getsize(backup_path)

            info = {
                "id": backup_id, 
                "server_name": server_name,
                "created_at": datetime.now().isoformat(),
                "size": file_size,
                "filename": backup_filename,
                "type": backup_type,
                "world_folders": world_folders  # Track which worlds were backed up
            }

            with open(info_path, "w", encoding="utf-8") as f:
                json.dump(info, f, indent=2)

            self._enforce_retention_policy(server_name)

            return info
        except Exception:
            return None

    def restore_backup(self, server_name: str, backup_id: str) -> bool:
        """Restore a server from a backup (world data only)."""
        os.makedirs(str(config.get_server_dir(server_name)), exist_ok=True)

        # First, find the backup file by backup_id
        backups = self.list_backups(server_name)
        backup_info = None
        for b in backups:
            if b.get("id") == backup_id:
                backup_info = b
                break
        
        if not backup_info:
            return False
        
        server_backup_dir = get_server_backup_dir(server_name)
        backup_filename = backup_info.get("filename", "")
        backup_filename_base = backup_info.get("id", "")
        backup_type = backup_info.get("type", "manual") or "manual"
        if not backup_filename or not backup_filename_base:
            return False
        backup_folder_name = f"backup-{backup_filename_base}_{backup_type}"
        backup_path = os.path.join(server_backup_dir, backup_folder_name, backup_filename)
        server_dir = str(config.get_server_dir(server_name))

        if not os.path.exists(backup_path):
            return False

        try:
            # Get list of world folders that were backed up
            world_folders = backup_info.get("world_folders", WORLD_PATTERNS)
            
            # Remove existing world folders before restore
            for world_folder in world_folders:
                world_path = os.path.join(server_dir, world_folder)
                if os.path.exists(world_path):
                    shutil.rmtree(world_path)

            # Extract world folders to server directory
            with tarfile.open(backup_path, "r:gz") as tar:
                tar.extractall(server_dir)

            # Restore server.properties if backup exists
            props_bak = os.path.join(server_backup_dir, backup_folder_name, f"properties_{backup_id}.bak")
            if os.path.exists(props_bak):
                shutil.copy(props_bak, os.path.join(server_dir, "server.properties"))

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
        # Use filename and server_name from info to locate backup folder in server subdirectory
        server_name_val: str | None = info.get("server_name")
        backup_id_val: str | None = info.get("id")
        backup_type: str = info.get("type", "manual") or "manual"
        
        if not server_name_val or not backup_id_val:
            # Fallback to old method if info is incomplete
            if server_name_val and backup_id_val:
                return self.delete_backup(server_name_val, backup_id_val)
            return False
        
        server_name: str = server_name_val
        backup_id: str = backup_id_val
        server_backup_dir = get_server_backup_dir(server_name)
        backup_folder_name = f"backup-{backup_id}_{backup_type}"
        backup_folder = os.path.join(server_backup_dir, backup_folder_name)

        try:
            if os.path.exists(backup_folder):
                shutil.rmtree(backup_folder)
            return True
        except Exception:
            return False

    def get_backup_info(
        self, server_name: str, backup_id: str
    ) -> dict[str, Any] | None:
        """Get information about a specific backup."""
        # Try all possible backup types
        backup_types = ["manual", "startup", "periodic"]
        for backup_type in backup_types:
            info_path = get_backup_info_path(server_name, backup_id, backup_type)
            if os.path.exists(info_path):
                try:
                    with open(info_path, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception:
                    continue
        return None


backup_service = BackupService()
