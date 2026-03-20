import os
import pytest
from unittest.mock import patch
from app.app import app as flask_app


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    os.environ["INTERNAL_SECRET"] = "test-secret-123"
    with flask_app.test_client() as c:
        yield c
    os.environ.pop("INTERNAL_SECRET", None)


def auth_headers():
    return {"X-Internal-Secret": "test-secret-123"}


class TestIPRestriction:
    def test_non_localhost_gets_403(self, client):
        # Flask test client uses 127.0.0.1, so mock remote_addr
        with patch("app.routes.internal_routes._get_remote_addr", return_value="10.0.0.1"):
            resp = client.get("/api/internal/servers", headers=auth_headers())
        assert resp.status_code == 403

    def test_wrong_secret_gets_401(self, client):
        with patch("app.routes.internal_routes._get_remote_addr", return_value="127.0.0.1"):
            resp = client.get("/api/internal/servers", headers={"X-Internal-Secret": "wrong"})
        assert resp.status_code == 401


class TestServersEndpoint:
    def test_returns_running_servers(self, client):
        with patch("app.routes.internal_routes._get_remote_addr", return_value="127.0.0.1"):
            with patch("app.routes.internal_routes.server_manager") as mock_sm:
                mock_sm.running_servers = {"srv1": object(), "srv2": object()}
                resp = client.get("/api/internal/servers", headers=auth_headers())
        assert resp.status_code == 200
        data = resp.get_json()
        assert "servers" in data
        assert len(data["servers"]) == 2
