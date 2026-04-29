import os
import tarfile
import json
import shutil
from datetime import datetime
from typing import Any

BACKUPS_DIR = "backups"
SCHEDULER_FILE = "scheduler.json"
BACKUP_RETENTION = 10


def get_backups_dir() -> str:
    """Get the absolute path to the backups directory."""
    return os.path.abspath(BACKUPS_DIR)


def get_backup_path(server_name: str, backup_id: str) -> str:
    """Get the path to a specific backup file."""
    return os.path.join(get_backups_dir(), f"{server_name}_{backup_id}.tar.gz")


def get_backup_info_path(server_name: str, backup_id: str) -> str:
    """Get the path to a backup info JSON file."""
    return os.path.join(get_backups_dir(), f"{server_name}_{backup_id}.json")


def list_backups(server_name: str | None = None) -> list[dict[str, Any]]:
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

    backups.sort(key=lambda x: (x.get("is_locked", False), x.get("created_at", "")), reverse=True)
    return backups


def create_backup(server_name: str) -> dict[str, Any] | None:
    """Create a backup of a server."""
    from config import get_server_dir

    backups_dir = get_backups_dir()
    os.makedirs(backups_dir, exist_ok=True)

    server_dir = get_server_dir(server_name)
    if not os.path.exists(server_dir):
        return None

    backup_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = get_backup_path(server_name, backup_id)
    info_path = get_backup_info_path(server_name, backup_id)

    try:
        shutil.copy(
            os.path.join(server_dir, "server.properties"),
            os.path.join(backups_dir, f"properties_{backup_id}.bak"),
        )

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

        enforce_retention_policy(server_name)

        return info
    except Exception:
        return None


def restore_backup(server_name: str, backup_id: str) -> bool:
    """Restore a server from a backup."""
    from config import get_server_dir

    backup_path = get_backup_path(server_name, backup_id)
    server_dir = get_server_dir(server_name)
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


def delete_backup(server_name: str, backup_id: str) -> bool:
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


def enforce_retention_policy(server_name: str | None = None) -> int:
    """Delete old backups exceeding retention limit. Returns number of deleted backups."""
    if server_name:
        backups = list_backups(server_name)
    else:
        backups = list_backups()

    deleted = 0
    for backup in backups[BACKUP_RETENTION:]:
        if delete_backup(backup["server_name"], backup["id"]):
            deleted += 1

    return deleted


def get_backup_info(server_name: str, backup_id: str) -> dict[str, Any] | None:
    """Get information about a specific backup."""
    info_path = get_backup_info_path(server_name, backup_id)

    if not os.path.exists(info_path):
        return None

    try:
        with open(info_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


SCHEDULER_FILE_PATH = "scheduler.json"


def load_scheduled_tasks() -> list[dict[str, Any]]:
    """Load scheduled tasks from file."""
    if not os.path.exists(SCHEDULER_FILE_PATH):
        return []

    try:
        with open(SCHEDULER_FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_scheduled_tasks(tasks: list[dict[str, Any]]) -> bool:
    """Save scheduled tasks to file."""
    try:
        with open(SCHEDULER_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(tasks, f, indent=2)
        return True
    except Exception:
        return False


def add_scheduled_task(task: dict[str, Any]) -> dict[str, Any]:
    """Add a new scheduled task."""
    import uuid

    tasks = load_scheduled_tasks()
    task["id"] = str(uuid.uuid4())[:8]
    task["enabled"] = True
    tasks.append(task)
    save_scheduled_tasks(tasks)
    return task


def delete_scheduled_task(task_id: str) -> bool:
    """Delete a scheduled task."""
    tasks = load_scheduled_tasks()
    original_count = len(tasks)
    tasks = [t for t in tasks if t.get("id") != task_id]
    if len(tasks) < original_count:
        save_scheduled_tasks(tasks)
        return True
    return False


def update_scheduled_task(task_id: str, updates: dict[str, Any]) -> bool:
    """Update a scheduled task."""
    tasks = load_scheduled_tasks()
    for task in tasks:
        if task.get("id") == task_id:
            task.update(updates)
            save_scheduled_tasks(tasks)
            return True
    return False


TASK_TYPES = {
    "restart": {
        "label": "Server Restart",
        "description": "Restart the Minecraft server",
    },
    "backup": {"label": "Create Backup", "description": "Create a full server backup"},
}


def get_next_run_time(task: dict[str, Any]) -> str | None:
    """Calculate the next run time for a task."""
    if not task.get("enabled", True):
        return None

    task_type = task.get("type")
    schedule = task.get("schedule", {})

    now = datetime.now()

    if task_type == "restart":
        hour = int(schedule.get("hour", 3))
        minute = int(schedule.get("minute", 0))
        days = schedule.get("days", ["*"])

        next_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_time <= now:
            next_time = next_time.replace(day=next_time.day + 1)

        if days != ["*"] and "*" not in days:
            weekday_names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
            target_weekdays = [
                weekday_names.index(d.lower())
                for d in days
                if d.lower() in weekday_names
            ]
            if target_weekdays:
                while next_time.weekday() not in target_weekdays:
                    next_time = next_time.replace(day=next_time.day + 1)

        return next_time.isoformat()

    elif task_type == "backup":
        hour = int(schedule.get("hour", 3))
        minute = int(schedule.get("minute", 0))
        frequency = schedule.get("frequency", "daily")

        next_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_time <= now:
            next_time = next_time.replace(day=next_time.day + 1)

        if frequency == "weekly":
            weekday = int(schedule.get("day", 0))
            while next_time.weekday() != weekday:
                next_time = next_time.replace(day=next_time.day + 1)

        return next_time.isoformat()

    return None
