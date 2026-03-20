import logging
import os
import platform
import subprocess
import sys
import threading
import time

import requests

from app.config import config

logger = logging.getLogger(__name__)

PID_FILE = str(config.database_dir.parent / "discord_bot.pid")
_RESTART_COOLDOWN = 60   # seconds alive before resetting restart_count
_MAX_RESTARTS = 3
_WATCHDOG_INTERVAL = 5   # seconds between watchdog checks


class DiscordBotManager:
    def __init__(self):
        self._process: subprocess.Popen | None = None
        self._restart_count: int = 0
        self._state: str = "stopped"
        self._watchdog_thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._bot_event_port: int = int(os.environ.get("BOT_EVENT_PORT", "5050"))
        self._internal_secret: str = ""
        self._last_restart_time: float = 0.0
        self._lock = threading.Lock()
        # Stored so watchdog can respawn on exit
        self._token: str = ""
        self._channel_id: str = ""
        self._flask_url: str = ""

    def get_state(self) -> str:
        return self._state

    def is_running(self) -> bool:
        return self._state == "running"

    def start(self, token: str, channel_id: str, internal_secret: str, flask_url: str) -> None:
        with self._lock:
            self._kill_orphan()
            self._token = token
            self._channel_id = channel_id
            self._internal_secret = internal_secret
            self._flask_url = flask_url
            self._restart_count = 0
            self._stop_event.clear()
            self._spawn(token, channel_id, internal_secret, flask_url)
            self._state = "running"
            self._start_watchdog()

    def stop(self) -> None:
        with self._lock:
            self._stop_event.set()
            self._terminate_process()
            self._state = "stopped"
            _delete_pid_file()

    def send_event(self, event) -> None:
        """Non-blocking: fire event to bot subprocess in daemon thread."""
        def _fire():
            try:
                url = f"http://127.0.0.1:{self._bot_event_port}/event"
                requests.post(
                    url,
                    json=event.to_dict(),
                    headers={"X-Internal-Secret": self._internal_secret},
                    timeout=2,
                )
            except Exception:
                pass  # Bot unavailable — silently ignore
        threading.Thread(target=_fire, daemon=True).start()

    def _spawn(self, token: str, channel_id: str, internal_secret: str, flask_url: str) -> None:
        bot_script = os.path.join(os.path.dirname(__file__), "discord_bot_process.py")
        env = {
            **os.environ,
            "DISCORD_BOT_TOKEN": token,
            "DISCORD_CHANNEL_ID": channel_id,
            "INTERNAL_SECRET": internal_secret,
            "FLASK_INTERNAL_URL": flask_url,
            "BOT_EVENT_PORT": str(self._bot_event_port),
        }
        preexec = None
        if platform.system() == "Linux":
            import ctypes
            import signal as _signal
            def _set_pdeathsig():
                ctypes.CDLL("libc.so.6").prctl(1, _signal.SIGTERM)
            preexec = _set_pdeathsig

        self._process = subprocess.Popen(
            [sys.executable, bot_script],
            env=env,
            preexec_fn=preexec,
        )
        _write_pid_file(self._process.pid)
        self._last_restart_time = time.time()
        logger.info("Discord bot subprocess started, PID=%d", self._process.pid)

    def _terminate_process(self) -> None:
        if not self._process:
            return
        try:
            if platform.system() == "Windows":
                self._process.terminate()
                try:
                    self._process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self._process.kill()
            else:
                import signal
                os.kill(self._process.pid, signal.SIGTERM)
                try:
                    self._process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.kill(self._process.pid, signal.SIGKILL)
        except OSError:
            pass
        self._process = None

    def _kill_orphan(self) -> None:
        """Kill leftover bot process from previous Flask run using PID file."""
        if not os.path.exists(PID_FILE):
            return
        try:
            with open(PID_FILE, "r") as f:
                old_pid = int(f.read().strip())
            if platform.system() == "Windows":
                import ctypes
                PROCESS_TERMINATE = 1
                handle = ctypes.windll.kernel32.OpenProcess(PROCESS_TERMINATE, False, old_pid)
                if handle:
                    ctypes.windll.kernel32.TerminateProcess(handle, -1)
                    ctypes.windll.kernel32.CloseHandle(handle)
            else:
                import signal
                os.kill(old_pid, signal.SIGTERM)
        except (OSError, ValueError):
            pass
        _delete_pid_file()

    def _start_watchdog(self) -> None:
        self._watchdog_thread = threading.Thread(target=self._watchdog, daemon=True)
        self._watchdog_thread.start()

    def _watchdog(self) -> None:
        while not self._stop_event.is_set():
            time.sleep(_WATCHDOG_INTERVAL)
            if self._stop_event.is_set():
                break
            with self._lock:
                if self._state != "running" or not self._process:
                    break
                if self._process.poll() is None:
                    # Process alive — check if cooldown passed
                    if time.time() - self._last_restart_time > _RESTART_COOLDOWN:
                        self._restart_count = 0
                    continue
                # Process exited
                if self._restart_count >= _MAX_RESTARTS:
                    self._state = "crashed"
                    logger.error("Discord bot crashed after %d retries", _MAX_RESTARTS)
                    break
                self._restart_count += 1
                self._state = "retrying"
                logger.warning("Discord bot exited, retrying (%d/%d)", self._restart_count, _MAX_RESTARTS)
                self._spawn(self._token, self._channel_id, self._internal_secret, self._flask_url)
                self._state = "running"


def _write_pid_file(pid: int) -> None:
    try:
        os.makedirs(os.path.dirname(PID_FILE), exist_ok=True)
        with open(PID_FILE, "w") as f:
            f.write(str(pid))
    except Exception as e:
        logger.warning("Failed to write PID file: %s", e)


def _delete_pid_file() -> None:
    try:
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)
    except Exception as e:
        logger.warning("Failed to delete PID file: %s", e)


discord_bot_manager = DiscordBotManager()
