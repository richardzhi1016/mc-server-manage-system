import json
import logging
import os
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import config

logger = logging.getLogger(__name__)

VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


def _validate_task_data(data: dict) -> tuple[bool, str]:
    """Validate task creation/update data. Returns (valid, error_message)."""
    task_type = data.get("type")
    if task_type not in ("restart", "backup"):
        return False, "type must be 'restart' or 'backup'"

    schedule = data.get("schedule")
    if not isinstance(schedule, dict):
        return False, "schedule is required"

    frequency = schedule.get("frequency")
    if frequency not in ("daily", "weekly", "interval"):
        return False, "schedule.frequency must be 'daily', 'weekly', or 'interval'"

    if frequency in ("daily", "weekly"):
        hour = schedule.get("hour")
        minute = schedule.get("minute")
        if not isinstance(hour, int) or not (0 <= hour <= 23):
            return False, "schedule.hour must be an integer 0-23"
        if not isinstance(minute, int) or not (0 <= minute <= 59):
            return False, "schedule.minute must be an integer 0-59"

    if frequency == "weekly":
        days = schedule.get("days")
        if not days or not isinstance(days, list) or len(days) == 0:
            return False, "schedule.days must be a non-empty list for weekly frequency"
        invalid = [d for d in days if d not in VALID_DAYS]
        if invalid:
            return False, f"Invalid day(s): {invalid}. Must be mon/tue/wed/thu/fri/sat/sun"

    if frequency == "interval":
        interval_value = schedule.get("interval_value")
        interval_unit = schedule.get("interval_unit")
        if not isinstance(interval_value, int) or interval_value < 1:
            return False, "schedule.interval_value must be a positive integer"
        if interval_unit not in ("minutes", "hours"):
            return False, "schedule.interval_unit must be 'minutes' or 'hours'"
        if interval_unit == "minutes" and interval_value > 1440:
            return False, "interval_value for minutes must be <= 1440"
        if interval_unit == "hours" and interval_value > 168:
            return False, "interval_value for hours must be <= 168"

    return True, ""


class SchedulerService:
    """Manages scheduled tasks (restart/backup) for Minecraft servers."""

    def __init__(self) -> None:
        self._scheduler = BackgroundScheduler(timezone="UTC")
        self._tasks: list[dict] = []
        self._lock = threading.Lock()
        self._execution_locks: dict[str, threading.Lock] = {}
        self._app: Any = None
        self._socketio: Any = None
        self._tasks_file: Path = config.database_dir / "scheduled_tasks.json"

    def init_app(self, app: Any, socketio: Any) -> None:
        """Initialize with Flask app and SocketIO. Loads persisted tasks and starts scheduler."""
        self._app = app
        self._socketio = socketio

        with self._lock:
            self._tasks = self._load_tasks()
            for task in self._tasks:
                if task.get("enabled"):
                    try:
                        self._register_job(task)
                    except Exception as e:
                        logger.error("Failed to register job for task %s: %s", task["id"], e)

        self._scheduler.start()
        logger.info("SchedulerService started with %d task(s)", len(self._tasks))

    def shutdown(self) -> None:
        """Gracefully shut down APScheduler."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load_tasks(self) -> list[dict]:
        if not self._tasks_file.exists():
            return []
        try:
            with open(self._tasks_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.error("Failed to load scheduled tasks: %s", e)
            return []

    def _save_tasks(self) -> None:
        """Atomic write to tasks JSON file."""
        tmp_path = Path(str(self._tasks_file) + ".tmp")
        try:
            os.makedirs(self._tasks_file.parent, exist_ok=True)
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(self._tasks, f, indent=2, ensure_ascii=False)
            os.replace(tmp_path, self._tasks_file)
        except Exception as e:
            logger.error("Failed to save scheduled tasks: %s", e)
            if tmp_path.exists():
                tmp_path.unlink()

    # ------------------------------------------------------------------
    # APScheduler job management
    # ------------------------------------------------------------------

    def _register_job(self, task: dict) -> None:
        """Register an APScheduler job for the given task."""
        task_id = task["id"]
        schedule = task["schedule"]
        frequency = schedule["frequency"]
        server_name = task["server_name"]
        task_type = task["type"]

        job_kwargs: dict[str, Any] = {
            "id": task_id,
            "replace_existing": True,
            "max_instances": 1,
            "misfire_grace_time": 60,
        }

        if frequency == "daily":
            trigger = CronTrigger(
                hour=schedule["hour"],
                minute=schedule["minute"],
                timezone="UTC",
            )
        elif frequency == "weekly":
            days_str = ",".join(schedule["days"])
            trigger = CronTrigger(
                day_of_week=days_str,
                hour=schedule["hour"],
                minute=schedule["minute"],
                timezone="UTC",
            )
        else:  # interval
            unit = schedule["interval_unit"]
            value = schedule["interval_value"]
            if unit == "minutes":
                trigger = IntervalTrigger(minutes=value)
            else:
                trigger = IntervalTrigger(hours=value)

        if task_type == "restart":
            self._scheduler.add_job(
                self._execute_restart,
                trigger,
                args=[task_id, server_name],
                **job_kwargs,
            )
        else:
            self._scheduler.add_job(
                self._execute_backup,
                trigger,
                args=[task_id, server_name],
                **job_kwargs,
            )

    def _unregister_job(self, task_id: str) -> None:
        try:
            self._scheduler.remove_job(task_id)
        except Exception:
            pass  # Job may not exist

    def _get_next_run(self, task_id: str) -> str | None:
        """Return ISO string of next scheduled fire time, or None."""
        try:
            job = self._scheduler.get_job(task_id)
            if job and job.next_run_time:
                return job.next_run_time.isoformat()
        except Exception:
            pass
        return None

    def _refresh_next_run(self, task: dict) -> None:
        """Update task's next_run field from APScheduler."""
        task["next_run"] = self._get_next_run(task["id"])

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def list_tasks(self, server_name: str | None = None) -> list[dict]:
        with self._lock:
            tasks = [
                t for t in self._tasks
                if server_name is None or t.get("server_name") == server_name
            ]
            result = []
            for task in tasks:
                t = dict(task)
                t["next_run"] = self._get_next_run(task["id"])
                result.append(t)
            return result

    def get_task(self, task_id: str) -> dict | None:
        with self._lock:
            for task in self._tasks:
                if task["id"] == task_id:
                    t = dict(task)
                    t["next_run"] = self._get_next_run(task_id)
                    return t
        return None

    def create_task(self, data: dict) -> tuple[bool, str, dict | None]:
        """Create and persist a new task. Returns (success, error, task_dict)."""
        valid, error = _validate_task_data(data)
        if not valid:
            return False, error, None

        task: dict = {
            "id": str(uuid.uuid4()),
            "server_name": data["server_name"],
            "type": data["type"],
            "schedule": data["schedule"],
            "enabled": data.get("enabled", True),
            "next_run": None,
            "last_run": None,
            "created_at": datetime.utcnow().isoformat(),
        }

        with self._lock:
            self._tasks.append(task)
            if task["enabled"]:
                try:
                    self._register_job(task)
                    task["next_run"] = self._get_next_run(task["id"])
                except Exception as e:
                    self._tasks.remove(task)
                    return False, f"Failed to schedule task: {e}", None
            self._save_tasks()

        return True, "", dict(task)

    def update_task(self, task_id: str, data: dict) -> tuple[bool, str, dict | None]:
        """Update an existing task. Returns (success, error, updated_task)."""
        with self._lock:
            task = next((t for t in self._tasks if t["id"] == task_id), None)
            if task is None:
                return False, "Task not found", None

            if "enabled" in data:
                task["enabled"] = bool(data["enabled"])

            if "schedule" in data:
                new_schedule = data["schedule"]
                # Merge schedule fields
                task["schedule"] = {**task["schedule"], **new_schedule}
                # Re-validate after merge
                valid, error = _validate_task_data(task)
                if not valid:
                    return False, error, None

            # Re-register job based on new enabled/schedule state
            self._unregister_job(task_id)
            if task["enabled"]:
                try:
                    self._register_job(task)
                    task["next_run"] = self._get_next_run(task_id)
                except Exception as e:
                    return False, f"Failed to reschedule task: {e}", None
            else:
                task["next_run"] = None

            self._save_tasks()
            return True, "", dict(task)

    def delete_task(self, task_id: str) -> bool:
        with self._lock:
            task = next((t for t in self._tasks if t["id"] == task_id), None)
            if task is None:
                return False
            self._unregister_job(task_id)
            self._tasks.remove(task)
            self._save_tasks()
        return True

    # ------------------------------------------------------------------
    # Execution helpers
    # ------------------------------------------------------------------

    def _get_execution_lock(self, server_name: str) -> threading.Lock:
        with self._lock:
            if server_name not in self._execution_locks:
                self._execution_locks[server_name] = threading.Lock()
            return self._execution_locks[server_name]

    def _update_last_run(self, task_id: str) -> None:
        with self._lock:
            task = next((t for t in self._tasks if t["id"] == task_id), None)
            if task:
                task["last_run"] = datetime.utcnow().isoformat()
                self._save_tasks()

    def _emit_task_event(self, task_id: str, server_name: str, task_type: str,
                         success: bool, message: str) -> None:
        if self._socketio:
            try:
                self._socketio.emit(
                    "scheduled_task_executed",
                    {
                        "task_id": task_id,
                        "server_name": server_name,
                        "type": task_type,
                        "success": success,
                        "message": message,
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                    namespace="/",
                )
            except Exception as e:
                logger.error("Failed to emit task event: %s", e)

    def _execute_restart(self, task_id: str, server_name: str) -> None:
        """Execute a restart task: stop then start the server."""
        lock = self._get_execution_lock(server_name)
        if not lock.acquire(blocking=False):
            logger.warning("Skipping restart task %s — server %s is locked", task_id, server_name)
            return

        try:
            logger.info("Scheduled restart: %s (task %s)", server_name, task_id)
            from app.routes.server_routes import _stop_server_internal, _start_server_internal

            server_dir = str(config.get_server_dir(server_name))
            if not os.path.exists(server_dir):
                msg = f"Server directory '{server_name}' not found"
                logger.error(msg)
                self._emit_task_event(task_id, server_name, "restart", False, msg)
                return

            # Stop (only if running)
            from app.services.server_manager import server_manager
            if server_manager.is_server_running(server_name):
                stop_ok, stop_msg = _stop_server_internal(server_name)
                if not stop_ok:
                    logger.error("Scheduled restart stop failed: %s", stop_msg)
                    self._emit_task_event(task_id, server_name, "restart", False, stop_msg)
                    return
                import time
                time.sleep(2)

            # Start
            start_ok, start_msg = _start_server_internal(server_name)
            if not start_ok:
                logger.error("Scheduled restart start failed: %s", start_msg)
                self._emit_task_event(task_id, server_name, "restart", False, start_msg)
                return

            self._update_last_run(task_id)
            self._emit_task_event(task_id, server_name, "restart", True, "Server restarted successfully")
        except Exception as e:
            logger.exception("Scheduled restart error for %s: %s", server_name, e)
            self._emit_task_event(task_id, server_name, "restart", False, str(e))
        finally:
            lock.release()

    def _execute_backup(self, task_id: str, server_name: str) -> None:
        """Execute a backup task."""
        lock = self._get_execution_lock(server_name)
        if not lock.acquire(blocking=False):
            logger.warning("Skipping backup task %s — server %s is locked", task_id, server_name)
            return

        try:
            logger.info("Scheduled backup: %s (task %s)", server_name, task_id)
            server_dir = str(config.get_server_dir(server_name))
            if not os.path.exists(server_dir):
                msg = f"Server directory '{server_name}' not found"
                logger.error(msg)
                self._emit_task_event(task_id, server_name, "backup", False, msg)
                return

            from app.services.backup_service import backup_service
            result = backup_service.create_backup(server_name, backup_type="scheduled")
            if result is None:
                msg = "Backup failed (create_backup returned None)"
                logger.error(msg)
                self._emit_task_event(task_id, server_name, "backup", False, msg)
                return

            self._update_last_run(task_id)
            self._emit_task_event(task_id, server_name, "backup", True, "Backup created successfully")
        except Exception as e:
            logger.exception("Scheduled backup error for %s: %s", server_name, e)
            self._emit_task_event(task_id, server_name, "backup", False, str(e))
        finally:
            lock.release()


scheduler_service = SchedulerService()
