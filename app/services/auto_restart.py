import logging
import sqlite3
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from app.config import config

logger = logging.getLogger(__name__)

_DEFAULT_CANCEL_WINDOW = 60   # seconds
_MAX_RESTARTS_PER_HOUR = 3


class TriggerType(str, Enum):
    TPS_BELOW = "tps_below"
    MEMORY_ABOVE = "memory_above"
    EMPTY_SERVER = "empty_server"


@dataclass
class RestartRule:
    id: int
    trigger_type: TriggerType
    threshold: float
    duration_seconds: int
    cooldown_minutes: int
    enabled: bool = True
    cancel_window_seconds: int = _DEFAULT_CANCEL_WINDOW


class RuleEngine:
    def __init__(self, server_name: str, socketio, server_manager, alert_service):
        self.server_name = server_name
        self.socketio = socketio
        self.server_manager = server_manager
        self.alert_service = alert_service

        # Tracks when each rule first started being continuously violated
        self._violation_start: dict = {}
        # Pending cancel timers: rule_id -> threading.Timer
        self._pending_timers: dict = {}
        # Cooldown timestamps
        self._last_restart: dict = {}
        # Hourly restart counter
        self._restart_count = 0
        self._restart_hour_start = datetime.now(timezone.utc)
        self._lock = threading.Lock()

    def evaluate(self, rule: RestartRule, current_value: float) -> None:
        """Call with the latest metric value. Triggers restart if rule conditions are met."""
        if not rule.enabled:
            return
        if not self.server_manager.is_server_running(self.server_name):
            return

        triggered = self._is_condition_met(rule, current_value)

        with self._lock:
            if triggered:
                if rule.id not in self._violation_start:
                    self._violation_start[rule.id] = datetime.now(timezone.utc)

                elapsed = (datetime.now(timezone.utc) - self._violation_start[rule.id]).total_seconds()
                if elapsed >= rule.duration_seconds and rule.id not in self._pending_timers:
                    self._schedule_restart(rule)
            else:
                # Condition cleared: reset violation tracking
                self._violation_start.pop(rule.id, None)

    def _is_condition_met(self, rule: RestartRule, value: float) -> bool:
        if rule.trigger_type == TriggerType.TPS_BELOW:
            return value < rule.threshold
        if rule.trigger_type == TriggerType.MEMORY_ABOVE:
            return value > rule.threshold
        if rule.trigger_type == TriggerType.EMPTY_SERVER:
            return value == 0
        return False

    def _in_cooldown(self, rule: RestartRule) -> bool:
        last = self._last_restart.get(rule.id)
        if last is None:
            return False
        return (datetime.now(timezone.utc) - last).total_seconds() < rule.cooldown_minutes * 60

    def _hourly_limit_reached(self) -> bool:
        now = datetime.now(timezone.utc)
        if (now - self._restart_hour_start).total_seconds() >= 3600:
            self._restart_count = 0
            self._restart_hour_start = now
        return self._restart_count >= _MAX_RESTARTS_PER_HOUR

    def _schedule_restart(self, rule: RestartRule) -> None:
        if self._in_cooldown(rule):
            logger.info("Auto-restart rule %d in cooldown, skipping", rule.id)
            return
        if self._hourly_limit_reached():
            logger.warning("Hourly restart limit reached for %s", self.server_name)
            return

        deadline = (datetime.now(timezone.utc) + timedelta(seconds=rule.cancel_window_seconds)).isoformat()
        self.socketio.emit("pending_restart", {
            "server_name": self.server_name,
            "reason": rule.trigger_type,
            "cancel_deadline": deadline,
        })

        from app.services import alert_service as _alert
        _alert.send(self.server_name, _alert.AlertEvent.auto_restart_pending(
            self.server_name, reason=rule.trigger_type
        ))

        timer = threading.Timer(
            rule.cancel_window_seconds,
            self._do_restart,
            args=(rule,),
        )
        self._pending_timers[rule.id] = timer
        timer.start()
        logger.info("Pending restart scheduled for %s (rule %d)", self.server_name, rule.id)

    def _do_restart(self, rule: RestartRule) -> None:
        with self._lock:
            self._pending_timers.pop(rule.id, None)
            self._last_restart[rule.id] = datetime.now(timezone.utc)
            self._restart_count += 1
            self._violation_start.pop(rule.id, None)

        logger.info("Executing auto-restart for %s (rule %d)", self.server_name, rule.id)
        try:
            self.server_manager.stop_server(self.server_name)
            self.server_manager.start_server(self.server_name)
        except Exception as e:
            logger.error("Auto-restart failed for %s: %s", self.server_name, e)
            return

        from app.services import alert_service as _alert
        _alert.send(self.server_name, _alert.AlertEvent.auto_restart_executed(
            self.server_name, reason=rule.trigger_type
        ))

    def cancel(self, server_name: str) -> bool:
        """Cancel all pending restarts for this server. Returns True if any were cancelled."""
        cancelled = False
        with self._lock:
            for rule_id, timer in list(self._pending_timers.items()):
                timer.cancel()
                del self._pending_timers[rule_id]
                cancelled = True
        if cancelled:
            self.socketio.emit("pending_restart_cancelled", {"server_name": server_name})
        return cancelled


# Registry: server_name -> RuleEngine
_engines: dict = {}


def get_or_create_engine(server_name: str, socketio, server_manager, alert_service) -> RuleEngine:
    if server_name not in _engines:
        _engines[server_name] = RuleEngine(server_name, socketio, server_manager, alert_service)
    return _engines[server_name]


def get_engine(server_name: str) -> Optional[RuleEngine]:
    """Public getter for routes — avoids accessing _engines directly."""
    return _engines.get(server_name)


def remove_engine(server_name: str) -> None:
    _engines.pop(server_name, None)


def load_rules(server_name: str) -> list:
    """Load enabled auto-restart rules from DB for a server."""
    with sqlite3.connect(str(config.database_path)) as conn:
        rows = conn.execute(
            """SELECT id, trigger_type, threshold, duration_seconds, cooldown_minutes
               FROM auto_restart_rules
               WHERE server_name = ? AND enabled = 1""",
            (server_name,),
        ).fetchall()
    return [
        RestartRule(
            id=r[0],
            trigger_type=TriggerType(r[1]),
            threshold=r[2],
            duration_seconds=r[3],
            cooldown_minutes=r[4],
        )
        for r in rows
    ]
