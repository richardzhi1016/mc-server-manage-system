import time
import pytest
from unittest.mock import MagicMock
from app.services.modrinth_client import ModrinthClient, ModrinthRateLimitError


class TestModrinthClientCache:
    def test_cache_returns_cached_value_within_ttl(self):
        client = ModrinthClient()
        client._cache["test_key"] = {
            "data": {"result": "cached"},
            "timestamp": time.time(),
        }
        assert client._get_cached("test_key") == {"result": "cached"}

    def test_cache_returns_none_after_ttl(self):
        client = ModrinthClient()
        client._cache["test_key"] = {
            "data": {"result": "old"},
            "timestamp": time.time() - 400,  # expired (TTL = 300s)
        }
        assert client._get_cached("test_key") is None

    def test_set_cache_stores_value(self):
        client = ModrinthClient()
        client._set_cached("my_key", {"foo": "bar"})
        assert client._get_cached("my_key") == {"foo": "bar"}


class TestModrinthClientSearch:
    def test_search_mods_returns_results(self):
        client = ModrinthClient()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "hits": [{"project_id": "abc", "title": "Test Mod"}],
            "total_hits": 1,
            "limit": 20,
            "offset": 0,
        }
        mock_response.headers = {}
        client._session.get = MagicMock(return_value=mock_response)

        result = client.search_mods(query="test", loader="fabric", game_version="1.20.1")

        assert result["total_hits"] == 1
        assert result["hits"][0]["project_id"] == "abc"
        client._session.get.assert_called_once()

    def test_search_mods_uses_cache_on_second_call(self):
        client = ModrinthClient()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "hits": [], "total_hits": 0, "limit": 20, "offset": 0
        }
        mock_response.headers = {}
        client._session.get = MagicMock(return_value=mock_response)

        client.search_mods(query="test", loader="fabric", game_version="1.20.1")
        client.search_mods(query="test", loader="fabric", game_version="1.20.1")

        assert client._session.get.call_count == 1


class TestModrinthClientRateLimit:
    def test_raises_on_429(self):
        client = ModrinthClient()
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "30"}
        client._session.get = MagicMock(return_value=mock_response)

        with pytest.raises(ModrinthRateLimitError):
            client.search_mods(query="test", loader="fabric", game_version="1.20.1")


class TestModrinthClientProject:
    def test_get_project_returns_details(self):
        client = ModrinthClient()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "abc123",
            "title": "Sodium",
            "description": "A mod",
            "icon_url": "https://example.com/icon.png",
        }
        mock_response.headers = {}
        client._session.get = MagicMock(return_value=mock_response)

        result = client.get_project("abc123")
        assert result["title"] == "Sodium"

    def test_get_project_versions_filters_by_loader_and_version(self):
        client = ModrinthClient()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "id": "v1",
                "name": "v1.0",
                "version_number": "1.0.0",
                "game_versions": ["1.20.1"],
                "loaders": ["fabric"],
                "files": [{"filename": "mod.jar", "size": 1024, "url": "https://example.com/mod.jar"}],
                "dependencies": [],
            }
        ]
        mock_response.headers = {}
        client._session.get = MagicMock(return_value=mock_response)

        result = client.get_project_versions("abc123", game_version="1.20.1", loader="fabric")
        assert len(result) == 1
        assert result[0]["id"] == "v1"


class TestModrinthDependencyCheck:
    def test_check_deps_returns_missing(self):
        client = ModrinthClient()

        version_response = MagicMock()
        version_response.status_code = 200
        version_response.json.return_value = {
            "id": "v1",
            "dependencies": [
                {"project_id": "dep1", "version_id": None, "dependency_type": "required"},
                {"project_id": "dep2", "version_id": None, "dependency_type": "optional"},
            ],
        }
        version_response.headers = {}

        dep_project_response = MagicMock()
        dep_project_response.status_code = 200
        dep_project_response.json.return_value = {
            "id": "dep1",
            "title": "Fabric API",
            "slug": "fabric-api",
        }
        dep_project_response.headers = {}

        client._session.get = MagicMock(side_effect=[version_response, dep_project_response])

        result = client.check_dependencies("v1", installed_project_ids=set())

        assert len(result["missing"]) == 1
        assert result["missing"][0]["project_id"] == "dep1"
        assert len(result["satisfied"]) == 0

    def test_check_deps_marks_installed_as_satisfied(self):
        client = ModrinthClient()
        version_response = MagicMock()
        version_response.status_code = 200
        version_response.json.return_value = {
            "id": "v1",
            "dependencies": [
                {"project_id": "dep1", "version_id": None, "dependency_type": "required"},
            ],
        }
        version_response.headers = {}
        client._session.get = MagicMock(return_value=version_response)

        result = client.check_dependencies("v1", installed_project_ids={"dep1"})

        assert len(result["missing"]) == 0
        assert "dep1" in result["satisfied"]
