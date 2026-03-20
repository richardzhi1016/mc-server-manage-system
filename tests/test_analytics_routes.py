from unittest.mock import patch
import pytest
from app.app import app as flask_app


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as c:
        yield c


class TestPlaytimeEndpoint:
    def test_returns_200_with_playtime_key(self, client):
        with patch("app.routes.analytics_routes.player_analytics_service") as mock:
            mock.get_playtime.return_value = [{"username": "Steve", "total_seconds": 600}]
            resp = client.get("/api/servers/testserver/analytics/playtime")
        assert resp.status_code == 200
        assert "playtime" in resp.get_json()

    def test_default_range_is_30_days(self, client):
        from datetime import timedelta
        with patch("app.routes.analytics_routes.player_analytics_service") as mock:
            mock.get_playtime.return_value = []
            client.get("/api/servers/testserver/analytics/playtime")
            args = mock.get_playtime.call_args[0]
        from_dt, to_dt = args[1], args[2]
        delta = to_dt - from_dt
        assert 29 <= delta.days <= 31


class TestHeatmapEndpoint:
    def test_returns_heatmap_key(self, client):
        with patch("app.routes.analytics_routes.player_analytics_service") as mock:
            mock.get_heatmap.return_value = [{"dow": d, "hour": h, "avg": 0.0}
                                              for d in range(7) for h in range(24)]
            resp = client.get("/api/servers/testserver/analytics/heatmap")
        assert resp.status_code == 200
        assert "heatmap" in resp.get_json()


class TestRetentionEndpoint:
    def test_returns_retention_fields(self, client):
        with patch("app.routes.analytics_routes.player_analytics_service") as mock:
            mock.get_retention.return_value = {"retention_pct": 50.0, "sample_size": 10}
            resp = client.get("/api/servers/testserver/analytics/retention")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "retention_pct" in data
        assert "sample_size" in data
