from unittest.mock import patch, MagicMock
from app.services.alert_service import AlertEvent, AlertColor, build_discord_payload


class TestAlertEvent:
    def test_server_crashed_event(self):
        event = AlertEvent.server_crashed("MySky")
        assert event.server_name == "MySky"
        assert event.color == AlertColor.RED
        assert "崩溃" in event.title

    def test_auto_restart_pending_event(self):
        event = AlertEvent.auto_restart_pending("MySky", reason="tps_below")
        assert event.color == AlertColor.YELLOW
        assert event.server_name == "MySky"

    def test_auto_restart_executed_event(self):
        event = AlertEvent.auto_restart_executed("MySky", reason="memory_above")
        assert event.color == AlertColor.BLUE

    def test_health_critical_event(self):
        event = AlertEvent.health_critical("MySky", score=35)
        assert event.color == AlertColor.RED

    def test_health_recovered_event(self):
        event = AlertEvent.health_recovered("MySky", score=85)
        assert event.color == AlertColor.GREEN


class TestBuildDiscordPayload:
    def test_payload_has_embed(self):
        event = AlertEvent.server_crashed("MySky")
        payload = build_discord_payload(event)
        assert "embeds" in payload
        assert len(payload["embeds"]) == 1

    def test_embed_has_required_fields(self):
        event = AlertEvent.server_crashed("MySky")
        embed = build_discord_payload(event)["embeds"][0]
        assert "title" in embed
        assert "color" in embed
        assert "timestamp" in embed

    def test_embed_color_is_integer(self):
        event = AlertEvent.server_crashed("MySky")
        embed = build_discord_payload(event)["embeds"][0]
        assert isinstance(embed["color"], int)
