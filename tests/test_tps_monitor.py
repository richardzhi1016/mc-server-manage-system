import pytest
from app.services.tps_monitor import parse_tps_from_line, ServerType


class TestParseTpsFromLine:
    def test_paper_tps_line(self):
        line = "[12:00:00] [Server thread/INFO]: TPS from last 1m, 5m, 15m: 19.97, 19.95, 19.90"
        result = parse_tps_from_line(line, ServerType.PAPER)
        assert result == pytest.approx(19.97, abs=0.01)

    def test_spark_tps_line(self):
        line = "[12:00:00] [Server thread/INFO]: Overall: 19.8 TPS, 50.23 MSPT"
        result = parse_tps_from_line(line, ServerType.SPARK)
        assert result == pytest.approx(19.8, abs=0.01)

    def test_paper_line_not_matched_by_spark(self):
        line = "[12:00:00] [Server thread/INFO]: TPS from last 1m, 5m, 15m: 19.97, 19.95, 19.90"
        result = parse_tps_from_line(line, ServerType.SPARK)
        assert result is None

    def test_unrelated_line_returns_none(self):
        line = "[12:00:00] [Server thread/INFO]: Player joined the game"
        result = parse_tps_from_line(line, ServerType.PAPER)
        assert result is None

    def test_tps_capped_at_20(self):
        # Server can report >20 during catch-up, clamp to 20
        line = "[12:00:00] [Server thread/INFO]: TPS from last 1m, 5m, 15m: 20.5, 20.0, 19.99"
        result = parse_tps_from_line(line, ServerType.PAPER)
        assert result == pytest.approx(20.0, abs=0.01)

    def test_vanilla_cant_keep_up_line(self):
        line = "[12:00:00] [Server thread/WARN]: Can't keep up! Is the server overloaded?"
        from app.services.tps_monitor import is_lag_event
        assert is_lag_event(line) is True

    def test_normal_line_is_not_lag_event(self):
        line = "[12:00:00] [Server thread/INFO]: Player joined the game"
        from app.services.tps_monitor import is_lag_event
        assert is_lag_event(line) is False
