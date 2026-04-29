import json
import os
import shutil
import tarfile
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from app.config import config


# Custom exceptions for backup operations
class BackupError(Exception):
    """Base exception for backup-related errors."""
    pass


class BackupInProgressError(BackupError):
    """Raised when a backup is already in progress for a server."""
    def __init__(self, server_name: str):
        self.server_name = server_name
        super().__init__(f"Backup already in progress for server: {server_name}")


# World folder patterns to backup (only backup existing ones)
WORLD_PATTERNS = ["world", "world_nether", "world_the_end"]


def get_backups_dir() -> str:
    """Get the absolute path to the backups directory."""
    return str(config.get_backup_dir())


def get_server_backup_dir(server_name: str) -> str:
    """Get the backup directory for a specific server."""
    return str(config.get_server_backup_dir(server_name))


def get_backup_path(server_name: str, backup_id: str) -> str | None:
    """Get the path to a specific backup directory by searching for the backup ID."""
    server_backup_dir = config.get_server_backup_dir(server_name)
    if not os.path.exists(server_backup_dir):
        return None
    
    # Search for a folder that matches the backup-ID prefix
    prefix = f"backup-{backup_id}"
    try:
        for folder_name in os.listdir(server_backup_dir):
            if folder_name.startswith(prefix):
                folder_path = os.path.join(server_backup_dir, folder_name)
                if os.path.isdir(folder_path):
                    return folder_path
    except Exception:
        pass
    return None


def get_backup_info_path(server_name: str, backup_id: str, backup_type: str | None = None) -> str | None:
    """Get the path to a backup info JSON file."""
    if backup_type:
        folder_name = f"backup-{backup_id}_{backup_type}"
        backup_folder = config.get_server_backup_dir(server_name) / folder_name
        info_path = backup_folder / f"{folder_name}.json"
        if os.path.exists(info_path):
            return str(info_path)
    
    # Fallback: search for any JSON in the backup folder
    backup_folder = get_backup_path(server_name, backup_id)
    if not backup_folder:
        return None
    
    try:
        for filename in os.listdir(backup_folder):
            if filename.endswith(".json"):
                return os.path.join(backup_folder, filename)
    except Exception:
        pass
    return None


class BackupService:
    """Service class for managing server backups."""

    BACKUP_RETENTION = 10

    def __init__(self):
        """Initialize backup service with concurrency control."""
        # Lock for each server to prevent concurrent backups
        self._backup_locks: dict[str, threading.RLock] = {}
        # Track active backups for crash recovery
        self._active_backups: dict[str, dict] = {}

    def get_server_retention(self, server_name: str) -> int:
        """Get the backup retention count for a server."""
        settings_path = config.get_server_dir(server_name) / "backup_retention.json"
        if os.path.exists(settings_path):
            try:
                with open(settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    val = data.get("retention")
                    if isinstance(val, int) and 5 <= val <= 50:
                        return val
            except Exception:
                pass
        return self.BACKUP_RETENTION

    def set_server_retention(self, server_name: str, retention: int) -> bool:
        """Set the backup retention count for a server."""
        if not isinstance(retention, int) or not (5 <= retention <= 50):
            return False
        settings_path = config.get_server_dir(server_name) / "backup_retention.json"
        try:
            with open(settings_path, "w", encoding="utf-8") as f:
                json.dump({"retention": retention}, f)
            return True
        except Exception:
            return False

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

        backups.sort(key=lambda x: (x.get("is_locked", False), x.get("created_at", "")), reverse=True)
        return backups

    def toggle_backup_lock(self, server_name: str, backup_id: str) -> bool:
        """Toggle the lock state of a backup."""
        # Try all possible backup types to find the info file
        backup_types = ["manual", "startup", "periodic", "scheduled"]
        info_path = None
        for backup_type in backup_types:
            path = get_backup_info_path(server_name, backup_id, backup_type)
            if path and os.path.exists(path):
                info_path = path
                break
        
        if not info_path:
            return False
            
        try:
            with open(info_path, "r", encoding="utf-8") as f:
                info = json.load(f)
            
            # Toggle is_locked
            current_state = info.get("is_locked", False)
            info["is_locked"] = not current_state
            
            with open(info_path, "w", encoding="utf-8") as f:
                json.dump(info, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"[Backup] ERROR: Failed to toggle lock for {backup_id}: {e}")
            return False

    def _get_backup_lock(self, server_name: str) -> threading.RLock:
        """Get or create a backup lock for the specified server."""
        if server_name not in self._backup_locks:
            self._backup_locks[server_name] = threading.RLock()
        return self._backup_locks[server_name]

    def create_backup(self, server_name: str, backup_type: str = "manual", custom_name: str | None = None, is_locked: bool = False) -> dict[str, Any] | None:
        """Create a backup of a server (world data only) with concurrency protection.
        
        Args:
            server_name: Name of the server to backup
            backup_type: Type of backup (manual, startup, periodic)
            custom_name: Optional user-defined name
            is_locked: Whether to lock the backup immediately after creation
            
        Returns:
            Backup info dict if successful, None if backup already in progress or failed
        """
        lock = self._get_backup_lock(server_name)
        
        # Try to acquire lock non-blocking
        if not lock.acquire(blocking=False):
            raise BackupInProgressError(server_name)
        
        try:
            return self._create_backup_internal(server_name, backup_type, custom_name, is_locked)
        except BackupInProgressError:
            return None
        finally:
            lock.release()

    def _create_backup_internal(self, server_name: str, backup_type: str, custom_name: str | None = None, is_locked: bool = False) -> dict[str, Any] | None:
        """Internal backup logic - assumes lock is already held."""
        from app.services.server_manager import server_manager
        
        server_backup_dir = get_server_backup_dir(server_name)
        server_dir = str(config.get_server_dir(server_name))
        
        if not os.path.exists(server_dir):
            print(f"[Backup] ERROR: Server directory not found: {server_dir}")
            return None
        
        # Check if server is running
        is_running = server_manager.is_server_running(server_name)
        watcher = None
        save_was_disabled = False
        
        # Register active backup for crash recovery
        self._active_backups[server_name] = {
            'start_time': datetime.now().isoformat(),
            'save_disabled': False
        }
        
        try:
            if is_running:
                watcher = server_manager.running_servers.get(server_name)
                if watcher:
                    # Step 1: Force save and wait for completion
                    watcher.write_input("save-all\r\n")
                    if not self._wait_for_save_complete(server_dir, timeout=90):
                        pass  # Continue even if timeout
                    
                    # Step 2: Disable auto-save
                    watcher.write_input("save-off\r\n")
                    self._active_backups[server_name]['save_disabled'] = True
                    save_was_disabled = True
                    time.sleep(0.5)
                    
                    # Verify server still running
                    if not server_manager.is_server_running(server_name):
                        raise Exception("Server stopped during backup preparation")
            
            # Step 3: Perform actual backup
            result = self._perform_backup(server_name, server_dir, server_backup_dir, backup_type, custom_name, is_locked)
            return result
            
        except Exception as e:
            # 添加详细错误日志，帮助诊断备份失败原因
            import traceback
            print(f"[Backup] ERROR: Backup failed for server '{server_name}': {e}")
            print(f"[Backup] Traceback: {traceback.format_exc()}")
            return None
        finally:
            # Step 4: Ensure save-on is executed
            if is_running and save_was_disabled:
                self._ensure_save_on(server_name, watcher)
            
            # Cleanup active backup tracking
            if server_name in self._active_backups:
                del self._active_backups[server_name]

    def _wait_for_save_complete(self, server_dir: str, timeout: int = 90) -> bool:
        """Wait for save-all to complete by monitoring region file timestamps.
        
        Args:
            server_dir: Path to the server directory
            timeout: Maximum time to wait in seconds (default 90)
            
        Returns:
            True if save completed, False if timeout
        """
        world_dir = Path(server_dir) / "world"
        region_dir = world_dir / "region"
        
        if not region_dir.exists():
            return True
        
        start_time = time.time()
        
        # Find all .mca files
        try:
            mca_files = [f for f in region_dir.iterdir() if f.suffix == '.mca']
        except OSError:
            return True
        
        if not mca_files:
            return True
        
        # Phase 1: Wait for save to start (detect file modification)
        save_started = False
        max_start_wait = min(timeout, 5)
        latest_mtime = 0  # 初始化变量，避免未绑定错误
        
        while time.time() - start_time < max_start_wait:
            latest_mtime = 0
            for mca_file in mca_files:
                try:
                    mtime = mca_file.stat().st_mtime
                    latest_mtime = max(latest_mtime, mtime)
                except OSError:
                    continue
            
            if latest_mtime > start_time - 1:
                save_started = True
                break
            
            time.sleep(0.2)
        
        if not save_started:
            return True
        
        # Phase 2: Wait for save to complete (file timestamps stable)
        stable_count = 0
        required_stable = 3  # 3 consecutive checks
        last_mtime = latest_mtime
        
        while time.time() - start_time < timeout:
            time.sleep(1)  # Check every 1 second
            
            current_latest = 0
            for mca_file in mca_files:
                try:
                    mtime = mca_file.stat().st_mtime
                    current_latest = max(current_latest, mtime)
                except OSError:
                    continue
            
            if current_latest == last_mtime:
                stable_count += 1
                if stable_count >= required_stable:
                    return True
            else:
                stable_count = 0
                last_mtime = current_latest
        
        return False

    def _ensure_save_on(self, server_name: str, watcher) -> None:
        """Ensure save-on command is sent with retry logic."""
        if not watcher:
            return
        
        max_retries = 3
        for i in range(max_retries):
            try:
                if hasattr(watcher, 'write_input'):
                    watcher.write_input("save-on\r\n")
                    return
            except Exception:
                if i < max_retries - 1:
                    time.sleep(0.5)
        
        # All retries failed
        pass  # Log error if needed

    def _perform_backup(self, server_name: str, server_dir: str, 
                       server_backup_dir: str, backup_type: str,
                       custom_name: str | None = None, is_locked: bool = False) -> dict[str, Any] | None:
        """Perform the actual backup operation."""
        # Find existing world folders
        world_folders = []
        for pattern in WORLD_PATTERNS:
            world_path = os.path.join(server_dir, pattern)
            if os.path.exists(world_path) and os.path.isdir(world_path):
                world_folders.append(pattern)
        
        if not world_folders:
            print(f"[Backup] ERROR: No world folders found in server directory: {server_dir}")
            return None

        backup_id = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_filename_base = f"backup-{backup_id}_{backup_type}"
        backup_folder = os.path.join(server_backup_dir, backup_filename_base)
        backup_filename = f"{backup_filename_base}.tar.gz"
        
        os.makedirs(backup_folder, exist_ok=True)
        backup_path = os.path.join(backup_folder, backup_filename)
        info_path = os.path.join(backup_folder, f"{backup_filename_base}.json")

        try:
            # Archive world folders
            with tarfile.open(backup_path, "w:gz") as tar:
                for world_folder in world_folders:
                    world_path = os.path.join(server_dir, world_folder)
                    if not os.path.exists(world_path):
                        continue
                    
                    # Add directory itself first (non-recursive)
                    tar.add(world_path, arcname=world_folder, recursive=False)
                    
                    # Walk through all children
                    for root, dirs, files in os.walk(world_path):
                        for d in dirs:
                            dir_path = os.path.join(root, d)
                            rel_path = os.path.relpath(dir_path, server_dir)
                            tar.add(dir_path, arcname=rel_path, recursive=False)
                            
                        for f in files:
                            # Explicitly skip session.lock (primary source of Errno 13)
                            if f == "session.lock":
                                continue
                                
                            file_path = os.path.join(root, f)
                            rel_path = os.path.relpath(file_path, server_dir)
                            try:
                                tar.add(file_path, arcname=rel_path, recursive=False)
                            except (PermissionError, IOError) as e:
                                print(f"[Backup] WARNING: Skipping locked file {rel_path}: {e}")
                            except Exception as e:
                                print(f"[Backup] WARNING: Error adding {rel_path}: {e}")

            file_size = os.path.getsize(backup_path)

            info = {
                "id": backup_id, 
                "server_name": server_name,
                "created_at": datetime.now().isoformat(),
                "size": file_size,
                "filename": backup_filename,
                "type": backup_type,
                "world_folders": world_folders,
                "name": custom_name or "",
                "is_locked": is_locked,
            }

            with open(info_path, "w", encoding="utf-8") as f:
                json.dump(info, f, indent=2)

            self._enforce_retention_policy(server_name)

            return info
        except Exception as e:
            # 添加详细错误日志
            import traceback
            print(f"[Backup] ERROR: Failed to create backup archive for '{server_name}': {e}")
            print(f"[Backup] Traceback: {traceback.format_exc()}")
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
        
        backup_folder = get_backup_path(server_name, backup_id)
        if not backup_folder:
            return False
            
        backup_filename = backup_info.get("filename", "")
        if not backup_filename:
            return False
            
        backup_path = os.path.join(backup_folder, backup_filename)
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

            return True
        except Exception:
            return False

    def delete_backup(self, server_name: str, backup_id: str) -> bool:
        """Delete a backup."""
        backup_path = get_backup_path(server_name, backup_id)
        if not backup_path:
            logger.warning("Could not find backup path for %s / %s", server_name, backup_id)
            return False
            
        try:
            if os.path.exists(backup_path):
                # Check if locked before deletion
                info = self.get_backup_info(server_name, backup_id)
                if info and info.get("is_locked", False):
                    print(f"[Backup] DENIED: Attempted to delete locked backup {backup_id}")
                    return False
                
                shutil.rmtree(backup_path)
                return True
            return False
        except Exception as e:
            logger.error("Failed to delete backup: %s", e)
            return False

    def _enforce_retention_policy(self, server_name: str | None = None) -> int:
        """Delete old backups based on smart retention policy (Ported from openmc.py)."""
        if server_name:
            backups = self.list_backups(server_name)
            keep_count = self.get_server_retention(server_name)
        else:
            backups = self.list_backups()
            keep_count = self.BACKUP_RETENTION

        # Validate retention count
        if keep_count < 5:
            # Fallback to safe minimum if configured too low (though currently hardcoded)
            keep_count = 5

        # Exclude locked backups from retention policy
        backups = [b for b in backups if not b.get("is_locked", False)]
        
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
            scheduled_backups = [b for b in candidates if b.get('type') == 'scheduled']

            counts = {
                'startup': len(startup_backups),
                'manual': len(manual_backups),
                'scheduled': len(scheduled_backups)
            }

            # Find types that exceed minimum requirement
            deletable_types = [(t, c) for t, c in counts.items() if c > min_per_type]
            
            if not deletable_types:
                # Fallback: if all categorized types are at minimum, but total still exceeds keep_count,
                # delete the absolute oldest backup from candidates to strictly enforce the limit.
                to_delete = candidates[-1]
                if self.delete_backup_by_info(to_delete):
                    deleted_count += 1
                    backups.remove(to_delete)
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
                else: to_delete = scheduled_backups[-1]

            elif len(max_types) == 2:
                # Case 2: Two-way tie
                if latest_type in max_types:
                    # Latest type is in tie -> pick that type to create churn
                    target_type = latest_type
                    if target_type == 'startup': to_delete = startup_backups[-1]
                    elif target_type == 'manual': to_delete = manual_backups[-1]
                    else: to_delete = scheduled_backups[-1]
                else:
                    # Latest type NOT in tie -> Delete absolute oldest among the two types
                    candidates_in_tie = []
                    if 'startup' in max_types: candidates_in_tie.extend(startup_backups)
                    if 'manual' in max_types: candidates_in_tie.extend(manual_backups)
                    if 'scheduled' in max_types: candidates_in_tie.extend(scheduled_backups)
                    
                    # Sort by created_at desc (newest first), so last is oldest
                    candidates_in_tie.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                    if candidates_in_tie:
                        to_delete = candidates_in_tie[-1]

            elif len(max_types) == 3:
                # Case 3: Three-way tie -> Pick latest backup type
                target_type = latest_type
                if target_type == 'startup': to_delete = startup_backups[-1]
                elif target_type == 'manual': to_delete = manual_backups[-1]
                else: to_delete = scheduled_backups[-1]

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
                # Check if locked
                if info.get("is_locked", False):
                    return False
                shutil.rmtree(backup_folder)
            return True
        except Exception:
            return False

    def get_backup_info(
        self, server_name: str, backup_id: str
    ) -> dict[str, Any] | None:
        """Get information about a specific backup."""
        # Try all possible backup types
        backup_types = ["manual", "startup", "periodic", "scheduled"]
        for backup_type in backup_types:
            info_path = get_backup_info_path(server_name, backup_id, backup_type)
            if os.path.exists(info_path):
                try:
                    with open(info_path, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception:
                    continue
        return None

    def rename_backup(self, server_name: str, backup_id: str, new_name: str) -> bool:
        info_path = get_backup_info_path(server_name, backup_id)
        if info_path and os.path.exists(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    info = json.load(f)
                info["name"] = new_name
                with open(info_path, "w", encoding="utf-8") as f:
                    json.dump(info, f, indent=2, ensure_ascii=False)
                return True
            except Exception as e:
                logger.error("Failed to rename backup %s: %s", backup_id, e)
                return False
        return False


backup_service = BackupService()
