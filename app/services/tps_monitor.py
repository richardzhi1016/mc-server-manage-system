import re
import threading
import logging
import sqlite3
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from app.config import config

logger = logging.getLogger(__name__)

# Regex patterns
_PAPER_TPS_RE = re.compile(
    r"TPS from last 1m, 5m, 15m:\s*([\d.]+)"
)
_SPARK_TPS_RE = re.compile(
    r"Overall:\s*([\d.]+)\s*TPS"
)
_LAG_RE = re.compile(r"Can't keep up!", re.IGNORECASE)

# Warming-up grace period (seconds after server start before recording TPS)
_WARMUP_SECONDS = 30
# Poll interval (seconds between /tps commands)
_POLL_INTERVAL = 10


class ServerType(str, Enum):
    PAPER = "paper"
    SPARK = "spark"     # Fabric/Forge + Spark mod
    VANILLA = "vanilla"


def parse_tps_from_line(line: str, server_type: ServerType) -> Optional[float]:
    """Extract TPS from a log line based on server type. Returns None if not a TPS line."""
    if server_type == ServerType.PAPER:
        m = _PAPER_TPS_RE.search(line)
        if m:
            return min(float(m.group(1)), 20.0)
    elif server_type == ServerType.SPARK:
        m = _SPARK_TPS_RE.search(line)
        if m:
            return min(float(m.group(1)), 20.0)
    return None


def is_lag_event(line: str) -> bool:
    """Return True if the log line indicates a server lag event."""
    return bool(_LAG_RE.search(line))


class TpsMonitor:
    """Background thread that periodically queries TPS and emits SocketIO events."""

    def __init__(self, server_name: str, server_type: ServerType, socketio, watcher):
        """
        Args:
            server_name: Name of the server instance.
            server_type: Detected type (PAPER / SPARK / VANILLA).
            socketio: Flask-SocketIO instance (for emit).
            watcher: PTYProcessWatcher with .write_input() and .is_alive().
        """
        self.server_name = server_name
        self.server_type = server_type
        self.socketio = socketio
        self.watcher = watcher
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._start_time = datetime.now(timezone.utc)

    def start(self) -> None:
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run, daemon=True, name=f"tps-{self.server_name}"
        )
        self._thread.start()
        logger.info("TpsMonitor started for %s (%s)", self.server_name, self.server_type)

    def stop(self) -> None:
        self._stop_event.set()

    def _is_warming_up(self) -> bool:
        elapsed = (datetime.now(timezone.utc) - self._start_time).total_seconds()
        return elapsed < _WARMUP_SECONDS

    def _run(self) -> None:
        while not self._stop_event.wait(_POLL_INTERVAL):
            if not self.watcher.is_alive():
                break
            if self._is_warming_up():
                self._emit("warming_up", None)
                continue
            if self.server_type == ServerType.VANILLA:
                # Vanilla: no numeric TPS, emit unknown status
                self._emit("unknown", None)
                continue
            # Send TPS query command
            cmd = "/tps\n" if self.server_type == ServerType.PAPER else "spark tps\n"
            try:
                self.watcher.write_input(cmd)
            except Exception as e:
                logger.warning("TpsMonitor write_input failed: %s", e)

    def handle_log_line(self, line: str) -> None:
        """Called by PTYProcessWatcher for every log line. Extracts TPS if present."""
        if self._is_warming_up():
            return
        tps = parse_tps_from_line(line, self.server_type)
        if tps is not None:
            self._record_and_emit(tps, "lagging" if tps < 15 else "ok")
        elif is_lag_event(line) and self.server_type == ServerType.VANILLA:
            self._emit("lagging", None)

    def _record_and_emit(self, tps: float, status: str) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        try:
            with sqlite3.connect(str(config.database_path)) as conn:
                conn.execute(
                    "INSERT INTO tps_history (server_name, tps, status, timestamp) VALUES (?, ?, ?, ?)",
                    (self.server_name, tps, status, ts),
                )
        except Exception as e:
            logger.error("TpsMonitor DB write failed: %s", e)
        self._emit(status, tps)

    def _emit(self, status: str, tps: Optional[float]) -> None:
        payload = {
            "server_name": self.server_name,
            "tps": tps,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.socketio.emit("tps_update", payload)


# Registry: server_name -> TpsMonitor
_monitors: dict[str, TpsMonitor] = {}


def start_monitor(server_name: str, server_type: ServerType, socketio, watcher) -> None:
    stop_monitor(server_name)
    m = TpsMonitor(server_name, server_type, socketio, watcher)
    _monitors[server_name] = m
    m.start()


def stop_monitor(server_name: str) -> None:
    m = _monitors.pop(server_name, None)
    if m:
        m.stop()


def get_monitor(server_name: str) -> Optional[TpsMonitor]:
    return _monitors.get(server_name)
