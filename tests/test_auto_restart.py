import time
import threading
from unittest.mock import MagicMock
from app.services.auto_restart import RuleEngine, RestartRule, TriggerType


class TestRuleEngine:
    def _make_engine(self):
        socketio = MagicMock()
        server_manager = MagicMock()
        server_manager.is_server_running.return_value = True
        alert_service = MagicMock()
        return RuleEngine(
            server_name="test-server",
            socketio=socketio,
            server_manager=server_manager,
            alert_service=alert_service,
        ), socketio, server_manager, alert_service

    def test_tps_below_triggers_when_condition_met(self):
        engine, socketio, sm, alert = self._make_engine()
        rule = RestartRule(
            id=1,
            trigger_type=TriggerType.TPS_BELOW,
            threshold=8.0,
            duration_seconds=1,   # 1 second for test speed
            cooldown_minutes=0,
        )
        engine.evaluate(rule, current_value=5.0)  # below threshold
        time.sleep(1.5)
        engine.evaluate(rule, current_value=5.0)  # still below after duration
        assert socketio.emit.called
        event_name = socketio.emit.call_args[0][0]
        assert event_name == "pending_restart"

    def test_tps_above_threshold_does_not_trigger(self):
        engine, socketio, _, _ = self._make_engine()
        rule = RestartRule(
            id=1,
            trigger_type=TriggerType.TPS_BELOW,
            threshold=8.0,
            duration_seconds=1,
            cooldown_minutes=0,
        )
        engine.evaluate(rule, current_value=18.0)  # above threshold
        time.sleep(1.5)
        engine.evaluate(rule, current_value=18.0)
        assert not socketio.emit.called

    def test_cancel_prevents_restart(self):
        engine, socketio, sm, alert = self._make_engine()
        rule = RestartRule(
            id=1,
            trigger_type=TriggerType.TPS_BELOW,
            threshold=8.0,
            duration_seconds=1,
            cooldown_minutes=0,
            cancel_window_seconds=2,
        )
        engine.evaluate(rule, current_value=5.0)
        time.sleep(1.5)
        engine.evaluate(rule, current_value=5.0)  # triggers pending
        engine.cancel("test-server")              # cancel within window
        time.sleep(2.5)                            # wait past cancel window
        sm.stop_server.assert_not_called()

    def test_cooldown_prevents_double_trigger(self):
        engine, socketio, sm, alert = self._make_engine()
        rule = RestartRule(
            id=1,
            trigger_type=TriggerType.TPS_BELOW,
            threshold=8.0,
            duration_seconds=1,
            cooldown_minutes=60,  # long cooldown
        )
        engine.evaluate(rule, current_value=5.0)
        time.sleep(1.5)
        engine.evaluate(rule, current_value=5.0)  # triggers once
        emit_count_after_first = socketio.emit.call_count
        engine.evaluate(rule, current_value=5.0)  # should be blocked by cooldown
        time.sleep(1.5)
        engine.evaluate(rule, current_value=5.0)
        assert socketio.emit.call_count == emit_count_after_first  # no new emit
