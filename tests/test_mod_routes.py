"""Tests for mod_routes blueprint."""
import json
from unittest.mock import patch, MagicMock

import pytest

from app.app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def mock_server_row():
    """Return a dict mimicking a DB row for a Fabric server."""
    return {
        "id": "abc123",
        "name": "test-server",
        "server_type": "fabric",
        "version": "1.20.4",
        "port": 25565,
    }


# ── Search ────────────────────────────────────────────────────────────

class TestSearchMods:
    def test_missing_params(self, client):
        resp = client.get("/api/mods/search?query=sodium")
        assert resp.status_code == 400
        assert b"Missing required params" in resp.data

    @patch("app.routes.mod_routes.modrinth_client")
    def test_success(self, mock_mr, client):
        mock_mr.search_mods.return_value = {"hits": [], "total_hits": 0}
        resp = client.get("/api/mods/search?query=sodium&version=1.20.4&loader=fabric")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["total_hits"] == 0

    @patch("app.routes.mod_routes.modrinth_client")
    def test_rate_limit(self, mock_mr, client):
        from app.services.modrinth_client import ModrinthRateLimitError
        mock_mr.search_mods.side_effect = ModrinthRateLimitError()
        resp = client.get("/api/mods/search?query=test&version=1.20.4&loader=fabric")
        assert resp.status_code == 429


# ── Get project details ───────────────────────────────────────────────

class TestGetModDetails:
    @patch("app.routes.mod_routes.modrinth_client")
    def test_success(self, mock_mr, client):
        mock_mr.get_project.return_value = {"id": "abc", "title": "Sodium"}
        resp = client.get("/api/mods/abc")
        assert resp.status_code == 200
        assert json.loads(resp.data)["title"] == "Sodium"


# ── Get project versions ─────────────────────────────────────────────

class TestGetModVersions:
    @patch("app.routes.mod_routes.modrinth_client")
    def test_success(self, mock_mr, client):
        mock_mr.get_project_versions.return_value = [{"id": "v1"}]
        resp = client.get("/api/mods/abc/versions?game_version=1.20.4&loader=fabric")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert len(data) == 1


# ── List installed mods ───────────────────────────────────────────────

class TestListInstalledMods:
    def test_invalid_server_name(self, client):
        resp = client.get("/api/servers/..evil/mods")
        assert resp.status_code == 400

    @patch("app.routes.mod_routes._get_server_info", return_value=None)
    def test_server_not_found(self, _mock, client):
        resp = client.get("/api/servers/noexist/mods")
        assert resp.status_code == 404

    @patch("app.routes.mod_routes.mod_manager")
    @patch("app.routes.mod_routes._get_server_info")
    def test_vanilla_rejected(self, mock_info, _mock_mm, client):
        mock_info.return_value = {"name": "srv", "server_type": "vanilla"}
        resp = client.get("/api/servers/srv/mods")
        assert resp.status_code == 400
        assert b"fabric" in resp.data.lower()

    @patch("app.routes.mod_routes.mod_manager")
    @patch("app.routes.mod_routes._get_server_info")
    @patch("app.routes.mod_routes.config")
    def test_success(self, mock_cfg, mock_info, mock_mm, client):
        mock_info.return_value = {"name": "srv", "server_type": "fabric"}
        mock_cfg.get_server_dir.return_value = "/tmp/servers/srv"
        mock_mm.scan_installed_mods.return_value = [
            {"filename": "sodium.jar", "enabled": True}
        ]
        resp = client.get("/api/servers/srv/mods")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert len(data["mods"]) == 1


# ── Install mod ───────────────────────────────────────────────────────

class TestInstallMod:
    @patch("app.routes.mod_routes.requests")
    @patch("app.routes.mod_routes.server_manager")
    @patch("app.routes.mod_routes.mod_manager")
    @patch("app.routes.mod_routes.modrinth_client")
    @patch("app.routes.mod_routes._get_server_info")
    @patch("app.routes.mod_routes.config")
    def test_success(self, mock_cfg, mock_info, mock_mr, mock_mm, mock_sm, mock_requests, client):
        mock_info.return_value = {"name": "srv", "server_type": "fabric"}
        mock_cfg.get_server_dir.return_value = "/tmp/servers/srv"
        mock_mr.get_download_url.return_value = ("http://example.com/mod.jar", "mod.jar", 1024)

        mock_resp = MagicMock()
        mock_resp.iter_content.return_value = [b"fake jar data"]
        mock_requests.get.return_value = mock_resp

        mock_sm.is_server_running.return_value = False

        resp = client.post(
            "/api/servers/srv/mods/install",
            json={"project_id": "abc", "version_id": "v1"},
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["success"] is True
        assert data["filename"] == "mod.jar"

    def test_missing_body(self, client):
        with patch("app.routes.mod_routes._get_server_info") as mock_info:
            mock_info.return_value = {"name": "srv", "server_type": "fabric"}
            resp = client.post(
                "/api/servers/srv/mods/install",
                json={"project_id": "abc"},
            )
            assert resp.status_code == 400


# ── Toggle mod ────────────────────────────────────────────────────────

class TestToggleMod:
    def test_invalid_filename(self, client):
        with patch("app.routes.mod_routes._get_server_info") as mock_info:
            mock_info.return_value = {"name": "srv", "server_type": "fabric"}
            resp = client.post("/api/servers/srv/mods/../../etc/passwd/toggle")
            assert resp.status_code == 400

    @patch("app.routes.mod_routes.server_manager")
    @patch("app.routes.mod_routes.mod_manager")
    @patch("app.routes.mod_routes._get_server_info")
    @patch("app.routes.mod_routes.config")
    def test_success(self, mock_cfg, mock_info, mock_mm, mock_sm, client, tmp_path):
        mock_info.return_value = {"name": "srv", "server_type": "fabric"}

        # Create a real mods dir so realpath checks pass
        mods_dir = tmp_path / "mods"
        mods_dir.mkdir()
        (mods_dir / "sodium.jar").touch()
        mock_cfg.get_server_dir.return_value = str(tmp_path)

        mock_mm.toggle_mod.return_value = "sodium.jar.disabled"
        mock_sm.is_server_running.return_value = True

        resp = client.post("/api/servers/srv/mods/sodium.jar/toggle")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["success"] is True
        assert data["restart_required"] is True


# ── Delete mod ────────────────────────────────────────────────────────

class TestDeleteMod:
    @patch("app.routes.mod_routes.server_manager")
    @patch("app.routes.mod_routes.mod_manager")
    @patch("app.routes.mod_routes._get_server_info")
    @patch("app.routes.mod_routes.config")
    def test_success(self, mock_cfg, mock_info, mock_mm, mock_sm, client, tmp_path):
        mock_info.return_value = {"name": "srv", "server_type": "fabric"}

        mods_dir = tmp_path / "mods"
        mods_dir.mkdir()
        (mods_dir / "sodium.jar").touch()
        mock_cfg.get_server_dir.return_value = str(tmp_path)

        mock_sm.is_server_running.return_value = False

        resp = client.delete("/api/servers/srv/mods/sodium.jar")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["success"] is True

    @patch("app.routes.mod_routes.mod_manager")
    @patch("app.routes.mod_routes._get_server_info")
    @patch("app.routes.mod_routes.config")
    def test_not_found(self, mock_cfg, mock_info, mock_mm, client, tmp_path):
        mock_info.return_value = {"name": "srv", "server_type": "fabric"}

        mods_dir = tmp_path / "mods"
        mods_dir.mkdir()
        (mods_dir / "sodium.jar").touch()
        mock_cfg.get_server_dir.return_value = str(tmp_path)

        mock_mm.delete_mod.side_effect = FileNotFoundError()

        resp = client.delete("/api/servers/srv/mods/sodium.jar")
        assert resp.status_code == 404


# ── Check dependencies ────────────────────────────────────────────────

class TestCheckDependencies:
    @patch("app.routes.mod_routes.modrinth_client")
    @patch("app.routes.mod_routes.mod_manager")
    @patch("app.routes.mod_routes._get_server_info")
    @patch("app.routes.mod_routes.config")
    def test_success(self, mock_cfg, mock_info, mock_mm, mock_mr, client):
        mock_info.return_value = {"name": "srv", "server_type": "fabric"}
        mock_cfg.get_server_dir.return_value = "/tmp/servers/srv"
        mock_mm.get_installed_project_ids.return_value = {"existing-mod"}
        mock_mr.check_dependencies.return_value = {"missing": [], "satisfied": []}

        resp = client.post(
            "/api/servers/srv/mods/check-deps",
            json={"version_id": "v1"},
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["missing"] == []

    def test_missing_version_id(self, client):
        with patch("app.routes.mod_routes._get_server_info") as mock_info:
            mock_info.return_value = {"name": "srv", "server_type": "fabric"}
            resp = client.post("/api/servers/srv/mods/check-deps", json={})
            assert resp.status_code == 400
