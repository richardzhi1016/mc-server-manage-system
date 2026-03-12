# Mod Installation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mod search (Modrinth), installation, and management (enable/disable/delete) to the Minecraft server management system.

**Architecture:** Backend proxy model — Flask proxies all Modrinth API calls, handles downloads, JAR metadata parsing, and dependency resolution. Frontend adds a new Mods page with two-column layout (installed mods + online search). Communication via existing REST pattern (Axios client).

**Tech Stack:** Python (Flask, requests, zipfile), React 19, TypeScript, Zustand, Tailwind CSS, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-13-mod-installation-design.md`

---

## Chunk 0: Prerequisites

### Task 0: Test Infrastructure and Dependencies

**Files:**
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Add `requests` to requirements.txt**

Append to `requirements.txt`:
```
requests>=2.31.0
```

- [ ] **Step 2: Install updated dependencies**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pip install -r requirements.txt
```

- [ ] **Step 3: Create test infrastructure**

```python
# tests/__init__.py
# (empty file — marks directory as Python package)
```

```python
# tests/conftest.py
import sys
from pathlib import Path

# Ensure the project root is on sys.path so `from app.xxx import` works
PROJECT_ROOT = str(Path(__file__).parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
```

- [ ] **Step 4: Commit**

```bash
git add tests/__init__.py tests/conftest.py requirements.txt
git commit -m "chore: add test infrastructure and requests dependency"
```

---

## Chunk 1: Backend Services

### Task 1: Modrinth API Client

**Files:**
- Create: `app/services/modrinth_client.py`
- Test: `tests/test_modrinth_client.py`

- [ ] **Step 1: Write failing tests for cache and search**

```python
# tests/test_modrinth_client.py
import time
import pytest
from unittest.mock import patch, MagicMock
from app.services.modrinth_client import ModrinthClient


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

        assert client._session.get.call_count == 1  # second call uses cache


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

        # Mock the version endpoint to return a version with a required dependency
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

        # Mock the project endpoint for the required dependency
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pytest tests/test_modrinth_client.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.modrinth_client'`

- [ ] **Step 3: Implement ModrinthClient**

```python
# app/services/modrinth_client.py
import json
import logging
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)

MODRINTH_BASE_URL = "https://api.modrinth.com/v2"
USER_AGENT = "mc-server-manager/1.0"
CACHE_TTL_SECONDS = 300  # 5 minutes
REQUEST_TIMEOUT = 15  # seconds for API calls


class ModrinthRateLimitError(Exception):
    """Raised when Modrinth returns 429 Too Many Requests."""

    def __init__(self, retry_after: int | None = None):
        self.retry_after = retry_after
        super().__init__(f"Rate limited. Retry after {retry_after}s" if retry_after else "Rate limited")


class ModrinthClient:
    """Proxies Modrinth API v2 with in-memory caching."""

    def __init__(self) -> None:
        self._cache: dict[str, dict[str, Any]] = {}
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": USER_AGENT})

    # -- Cache helpers --

    def _get_cached(self, key: str) -> Any | None:
        entry = self._cache.get(key)
        if entry is None:
            return None
        if time.time() - entry["timestamp"] > CACHE_TTL_SECONDS:
            del self._cache[key]
            return None
        return entry["data"]

    def _set_cached(self, key: str, data: Any) -> None:
        self._cache[key] = {"data": data, "timestamp": time.time()}

    # -- HTTP helper --

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{MODRINTH_BASE_URL}{path}"
        resp = self._session.get(url, params=params, timeout=REQUEST_TIMEOUT)

        # Rate limiting
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            raise ModrinthRateLimitError(int(retry_after) if retry_after else None)

        resp.raise_for_status()
        return resp.json()

    # -- Public API --

    def search_mods(
        self,
        query: str,
        loader: str,
        game_version: str,
        page: int = 0,
        limit: int = 20,
    ) -> dict[str, Any]:
        cache_key = f"search:{query}:{loader}:{game_version}:{page}:{limit}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        facets = json.dumps([
            [f"categories:{loader}"],
            [f"versions:{game_version}"],
            ["project_type:mod"],
        ])
        params = {
            "query": query,
            "facets": facets,
            "limit": limit,
            "offset": page * limit,
        }
        result = self._get("/search", params=params)
        self._set_cached(cache_key, result)
        return result

    def get_project(self, project_id: str) -> dict[str, Any]:
        cache_key = f"project:{project_id}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        result = self._get(f"/project/{project_id}")
        self._set_cached(cache_key, result)
        return result

    def get_project_versions(
        self,
        project_id: str,
        game_version: str | None = None,
        loader: str | None = None,
    ) -> list[dict[str, Any]]:
        cache_key = f"versions:{project_id}:{game_version}:{loader}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        params: dict[str, Any] = {}
        if game_version:
            params["game_versions"] = json.dumps([game_version])
        if loader:
            params["loaders"] = json.dumps([loader])

        result = self._get(f"/project/{project_id}/version", params=params)
        self._set_cached(cache_key, result)
        return result

    def get_version(self, version_id: str) -> dict[str, Any]:
        cache_key = f"version:{version_id}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        result = self._get(f"/version/{version_id}")
        self._set_cached(cache_key, result)
        return result

    def check_dependencies(
        self,
        version_id: str,
        installed_project_ids: set[str],
    ) -> dict[str, Any]:
        version_data = self._get(f"/version/{version_id}")
        deps = version_data.get("dependencies", [])

        missing = []
        satisfied = []

        for dep in deps:
            if dep.get("dependency_type") != "required":
                continue
            pid = dep.get("project_id")
            if not pid:
                continue

            if pid in installed_project_ids:
                satisfied.append(pid)
            else:
                # Resolve name from project endpoint
                try:
                    project = self.get_project(pid)
                    dep_name = project.get("title", pid)
                except Exception:
                    dep_name = pid

                missing.append({
                    "project_id": pid,
                    "version_id": dep.get("version_id"),
                    "dependency_type": "required",
                    "name": dep_name,
                })

        return {"missing": missing, "satisfied": satisfied}

    def get_download_url(self, version_id: str) -> tuple[str, str, int]:
        """Returns (download_url, filename, file_size) for the primary file of a version."""
        version_data = self.get_version(version_id)
        files = version_data.get("files", [])
        if not files:
            raise ValueError(f"No files found for version {version_id}")

        # Prefer the primary file
        primary = next((f for f in files if f.get("primary")), files[0])
        return primary["url"], primary["filename"], primary.get("size", 0)


# Module-level singleton
modrinth_client = ModrinthClient()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pytest tests/test_modrinth_client.py -v
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/modrinth_client.py tests/test_modrinth_client.py
git commit -m "feat(mods): add Modrinth API client with caching and rate limiting"
```

---

### Task 2: Mod File Manager

**Files:**
- Create: `app/services/mod_manager.py`
- Test: `tests/test_mod_manager.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_mod_manager.py
import json
import os
import tempfile
import zipfile
import pytest
from app.services.mod_manager import ModManager


@pytest.fixture
def temp_server_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        mods_dir = os.path.join(tmpdir, "mods")
        os.makedirs(mods_dir)
        yield tmpdir


def _create_fake_mod_jar(mods_dir: str, filename: str, mod_json: dict | None = None) -> str:
    """Create a fake JAR (zip) with optional fabric.mod.json."""
    jar_path = os.path.join(mods_dir, filename)
    with zipfile.ZipFile(jar_path, "w") as zf:
        if mod_json:
            zf.writestr("fabric.mod.json", json.dumps(mod_json))
    return jar_path


class TestScanInstalledMods:
    def test_scan_empty_mods_dir(self, temp_server_dir):
        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)
        assert result == []

    def test_scan_fabric_mod_jar(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium-1.0.jar", {
            "id": "sodium",
            "name": "Sodium",
            "version": "1.0.0",
            "description": "Rendering engine",
            "authors": ["JellySquid"],
        })
        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)

        assert len(result) == 1
        mod = result[0]
        assert mod["filename"] == "sodium-1.0.jar"
        assert mod["mod_id"] == "sodium"
        assert mod["name"] == "Sodium"
        assert mod["enabled"] is True

    def test_scan_disabled_mod(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium-1.0.jar.disabled", {
            "id": "sodium",
            "name": "Sodium",
            "version": "1.0.0",
        })
        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)

        assert len(result) == 1
        assert result[0]["enabled"] is False
        assert result[0]["filename"] == "sodium-1.0.jar.disabled"

    def test_scan_non_fabric_jar(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "unknown-mod.jar")  # no fabric.mod.json
        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)

        assert len(result) == 1
        mod = result[0]
        assert mod["mod_id"] is None
        assert mod["name"] == "unknown-mod.jar"  # fallback to filename

    def test_scan_includes_metadata_project_id(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium-1.0.jar", {"id": "sodium", "name": "Sodium", "version": "1.0.0"})
        # Write mods_metadata.json
        metadata = {"sodium-1.0.jar": {"modrinth_project_id": "AANobbMI", "modrinth_version_id": "v1"}}
        with open(os.path.join(mods_dir, "mods_metadata.json"), "w") as f:
            json.dump(metadata, f)

        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)
        assert result[0]["modrinth_project_id"] == "AANobbMI"


class TestToggleMod:
    def test_disable_mod(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium.jar", {"id": "sodium", "name": "Sodium", "version": "1.0"})

        mgr = ModManager()
        new_name = mgr.toggle_mod(temp_server_dir, "sodium.jar")

        assert new_name == "sodium.jar.disabled"
        assert os.path.exists(os.path.join(mods_dir, "sodium.jar.disabled"))
        assert not os.path.exists(os.path.join(mods_dir, "sodium.jar"))

    def test_enable_mod(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium.jar.disabled", {"id": "sodium", "name": "Sodium", "version": "1.0"})

        mgr = ModManager()
        new_name = mgr.toggle_mod(temp_server_dir, "sodium.jar.disabled")

        assert new_name == "sodium.jar"
        assert os.path.exists(os.path.join(mods_dir, "sodium.jar"))

    def test_toggle_updates_metadata(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium.jar")
        metadata = {"sodium.jar": {"modrinth_project_id": "AANobbMI"}}
        meta_path = os.path.join(mods_dir, "mods_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(metadata, f)

        mgr = ModManager()
        mgr.toggle_mod(temp_server_dir, "sodium.jar")

        with open(meta_path) as f:
            updated = json.load(f)
        assert "sodium.jar.disabled" in updated
        assert "sodium.jar" not in updated


class TestDeleteMod:
    def test_delete_removes_file(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        jar_path = _create_fake_mod_jar(mods_dir, "sodium.jar")

        mgr = ModManager()
        mgr.delete_mod(temp_server_dir, "sodium.jar")

        assert not os.path.exists(jar_path)

    def test_delete_removes_metadata_entry(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium.jar")
        metadata = {"sodium.jar": {"modrinth_project_id": "AANobbMI"}, "other.jar": {"modrinth_project_id": "XYZ"}}
        meta_path = os.path.join(mods_dir, "mods_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(metadata, f)

        mgr = ModManager()
        mgr.delete_mod(temp_server_dir, "sodium.jar")

        with open(meta_path) as f:
            updated = json.load(f)
        assert "sodium.jar" not in updated
        assert "other.jar" in updated

    def test_delete_nonexistent_raises(self, temp_server_dir):
        mgr = ModManager()
        with pytest.raises(FileNotFoundError):
            mgr.delete_mod(temp_server_dir, "nofile.jar")


class TestInstallMod:
    def test_install_saves_file_and_metadata(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        # Create a fake jar as bytes
        import io
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("fabric.mod.json", '{"id":"test","name":"Test","version":"1.0"}')
        jar_bytes = buf.getvalue()

        mgr = ModManager()
        mgr.install_mod_from_bytes(
            server_dir=temp_server_dir,
            filename="test-mod.jar",
            data=jar_bytes,
            modrinth_project_id="PROJ1",
            modrinth_version_id="VER1",
        )

        assert os.path.exists(os.path.join(mods_dir, "test-mod.jar"))
        meta_path = os.path.join(mods_dir, "mods_metadata.json")
        with open(meta_path) as f:
            meta = json.load(f)
        assert meta["test-mod.jar"]["modrinth_project_id"] == "PROJ1"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pytest tests/test_mod_manager.py -v
```
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement ModManager**

```python
# app/services/mod_manager.py
import json
import logging
import os
import threading
import zipfile
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class ModManager:
    """Manages mod files in server mods/ directories."""

    def __init__(self) -> None:
        self._locks: dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()

    def _get_lock(self, server_dir: str) -> threading.Lock:
        with self._global_lock:
            if server_dir not in self._locks:
                self._locks[server_dir] = threading.Lock()
            return self._locks[server_dir]

    def _mods_dir(self, server_dir: str) -> str:
        return os.path.join(server_dir, "mods")

    def _metadata_path(self, server_dir: str) -> str:
        return os.path.join(self._mods_dir(server_dir), "mods_metadata.json")

    def _read_metadata(self, server_dir: str) -> dict[str, Any]:
        path = self._metadata_path(server_dir)
        if not os.path.exists(path):
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            logger.warning("Failed to read mods_metadata.json, starting fresh")
            return {}

    def _write_metadata(self, server_dir: str, metadata: dict[str, Any]) -> None:
        path = self._metadata_path(server_dir)
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
        os.replace(tmp_path, path)

    def _parse_fabric_mod_json(self, jar_path: str) -> dict[str, Any] | None:
        try:
            with zipfile.ZipFile(jar_path, "r") as zf:
                if "fabric.mod.json" not in zf.namelist():
                    return None
                raw = zf.read("fabric.mod.json")
                return json.loads(raw)
        except (zipfile.BadZipFile, json.JSONDecodeError, OSError):
            return None

    def scan_installed_mods(self, server_dir: str) -> list[dict[str, Any]]:
        mods_dir = self._mods_dir(server_dir)
        if not os.path.exists(mods_dir):
            return []

        metadata = self._read_metadata(server_dir)
        result = []

        for filename in sorted(os.listdir(mods_dir)):
            if not (filename.endswith(".jar") or filename.endswith(".jar.disabled")):
                continue

            filepath = os.path.join(mods_dir, filename)
            if not os.path.isfile(filepath):
                continue

            stat = os.stat(filepath)
            enabled = not filename.endswith(".jar.disabled")

            # Parse fabric.mod.json
            mod_json = self._parse_fabric_mod_json(filepath)

            # Get metadata entry
            meta_entry = metadata.get(filename, {})

            mod_info: dict[str, Any] = {
                "filename": filename,
                "enabled": enabled,
                "mod_id": mod_json.get("id") if mod_json else None,
                "name": (mod_json.get("name") if mod_json else None) or filename,
                "version": mod_json.get("version") if mod_json else None,
                "description": mod_json.get("description") if mod_json else None,
                "authors": mod_json.get("authors", []) if mod_json else [],
                "file_size": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "modrinth_project_id": meta_entry.get("modrinth_project_id"),
            }
            result.append(mod_info)

        return result

    def toggle_mod(self, server_dir: str, filename: str) -> str:
        """Toggle mod enabled/disabled. Returns new filename."""
        with self._get_lock(server_dir):
            mods_dir = self._mods_dir(server_dir)
            filepath = os.path.join(mods_dir, filename)

            if not os.path.exists(filepath):
                raise FileNotFoundError(f"Mod file not found: {filename}")

            if filename.endswith(".jar.disabled"):
                new_filename = filename[: -len(".disabled")]
            elif filename.endswith(".jar"):
                new_filename = filename + ".disabled"
            else:
                raise ValueError(f"Invalid mod filename: {filename}")

            new_filepath = os.path.join(mods_dir, new_filename)
            os.rename(filepath, new_filepath)

            # Update metadata keys
            metadata = self._read_metadata(server_dir)
            if filename in metadata:
                metadata[new_filename] = metadata.pop(filename)
                self._write_metadata(server_dir, metadata)

            return new_filename

    def delete_mod(self, server_dir: str, filename: str) -> None:
        """Delete a mod file and its metadata entry."""
        with self._get_lock(server_dir):
            mods_dir = self._mods_dir(server_dir)
            filepath = os.path.join(mods_dir, filename)

            if not os.path.exists(filepath):
                raise FileNotFoundError(f"Mod file not found: {filename}")

            os.remove(filepath)

            # Remove from metadata
            metadata = self._read_metadata(server_dir)
            if filename in metadata:
                del metadata[filename]
                self._write_metadata(server_dir, metadata)

    def install_mod_from_bytes(
        self,
        server_dir: str,
        filename: str,
        data: bytes,
        modrinth_project_id: str,
        modrinth_version_id: str,
    ) -> None:
        """Install a mod by writing bytes to mods/ and updating metadata."""
        with self._get_lock(server_dir):
            mods_dir = self._mods_dir(server_dir)
            os.makedirs(mods_dir, exist_ok=True)

            filepath = os.path.join(mods_dir, filename)
            tmp_path = filepath + ".downloading"

            try:
                with open(tmp_path, "wb") as f:
                    f.write(data)
                os.replace(tmp_path, filepath)
            except Exception:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                raise

            # Update metadata
            metadata = self._read_metadata(server_dir)
            metadata[filename] = {
                "modrinth_project_id": modrinth_project_id,
                "modrinth_version_id": modrinth_version_id,
                "installed_at": datetime.now(tz=timezone.utc).isoformat(),
            }
            self._write_metadata(server_dir, metadata)

    def get_installed_project_ids(self, server_dir: str) -> set[str]:
        """Return set of Modrinth project IDs for installed mods."""
        metadata = self._read_metadata(server_dir)
        return {
            entry["modrinth_project_id"]
            for entry in metadata.values()
            if entry.get("modrinth_project_id")
        }


# Module-level singleton
mod_manager = ModManager()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pytest tests/test_mod_manager.py -v
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/mod_manager.py tests/test_mod_manager.py
git commit -m "feat(mods): add mod file manager with scan, toggle, delete, install"
```

---

## Chunk 2: Backend Routes

### Task 3: Mod Routes Blueprint

**Files:**
- Create: `app/routes/mod_routes.py`
- Modify: `app/app.py:16-17,81-86` (add import + blueprint registration)
- Test: `tests/test_mod_routes.py`

- [ ] **Step 1: Write failing tests for routes**

```python
# tests/test_mod_routes.py
import json
import pytest
from unittest.mock import patch, MagicMock

# We need a test client
@pytest.fixture
def app():
    """Create a test Flask app with mod routes."""
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from app.app import app as flask_app
    flask_app.config["TESTING"] = True
    yield flask_app


@pytest.fixture
def client(app):
    return app.test_client()


class TestSearchMods:
    @patch("app.routes.mod_routes.modrinth_client")
    def test_search_returns_results(self, mock_client, client):
        mock_client.search_mods.return_value = {
            "hits": [{"project_id": "abc", "title": "Test"}],
            "total_hits": 1,
            "limit": 20,
            "offset": 0,
        }
        resp = client.get("/api/mods/search?query=test&version=1.20.1&loader=fabric")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total_hits"] == 1

    def test_search_missing_params(self, client):
        resp = client.get("/api/mods/search")
        assert resp.status_code == 400


class TestGetProject:
    @patch("app.routes.mod_routes.modrinth_client")
    def test_get_project_success(self, mock_client, client):
        mock_client.get_project.return_value = {"id": "abc", "title": "Sodium"}
        resp = client.get("/api/mods/abc")
        assert resp.status_code == 200
        assert resp.get_json()["title"] == "Sodium"


class TestListInstalledMods:
    @patch("app.routes.mod_routes.mod_manager")
    def test_list_mods_for_vanilla_returns_400(self, mock_mgr, client):
        # The route should check server_type; vanilla = not supported
        with patch("app.routes.mod_routes._get_server_info") as mock_info:
            mock_info.return_value = {"name": "test", "server_type": "vanilla", "version": "1.20.1"}
            resp = client.get("/api/servers/test/mods")
            assert resp.status_code == 400


class TestToggleMod:
    @patch("app.routes.mod_routes.mod_manager")
    def test_toggle_rejects_path_traversal(self, mock_mgr, client):
        resp = client.post("/api/servers/test/mods/..%2F..%2Fserver.jar/toggle")
        assert resp.status_code == 400


class TestDeleteMod:
    @patch("app.routes.mod_routes.mod_manager")
    def test_delete_rejects_invalid_extension(self, mock_mgr, client):
        resp = client.delete("/api/servers/test/mods/readme.txt")
        assert resp.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pytest tests/test_mod_routes.py -v
```
Expected: FAIL — `ImportError` (mod_routes doesn't exist yet)

- [ ] **Step 3: Implement mod_routes.py**

```python
# app/routes/mod_routes.py
import logging
import os
import re
import sqlite3

import requests
from flask import Blueprint, request, jsonify

from app.config import config
from app.services.modrinth_client import modrinth_client, ModrinthRateLimitError
from app.services.mod_manager import mod_manager
from app.services.server_manager import server_manager

logger = logging.getLogger(__name__)

mods_bp = Blueprint("mods", __name__, url_prefix="/api")

MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024  # 50MB
DOWNLOAD_TIMEOUT = 60  # seconds

_VALID_MOD_FILENAME = re.compile(r"^[\w\-\.\+\[\] ]+\.(jar|jar\.disabled)$")


def _validate_server_name(name: str) -> bool:
    return ".." not in name and "/" not in name and "\\" not in name


def _get_server_info(server_name: str) -> dict | None:
    with sqlite3.connect(str(config.database_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM server_instance WHERE name = ?", (server_name,)
        ).fetchone()
    return dict(row) if row else None


def _validate_mod_filename(filename: str) -> bool:
    if not _VALID_MOD_FILENAME.match(filename):
        return False
    if ".." in filename or "/" in filename or "\\" in filename:
        return False
    return True


def _require_modded_server(server_info: dict) -> tuple | None:
    """Return error response tuple if server is vanilla, else None."""
    server_type = (server_info.get("server_type") or "").lower()
    if server_type in ("vanilla", "", None):
        return jsonify({"error": "Mods are not supported for vanilla servers"}), 400
    return None


# -- Search & Browse --

@mods_bp.route("/mods/search", methods=["GET"])
def search_mods():
    query = request.args.get("query", "")
    version = request.args.get("version")
    loader = request.args.get("loader")
    page = request.args.get("page", 0, type=int)
    limit = request.args.get("limit", 20, type=int)

    if not version or not loader:
        return jsonify({"error": "Missing required params: version, loader"}), 400

    try:
        result = modrinth_client.search_mods(
            query=query, loader=loader, game_version=version, page=page, limit=limit
        )
        return jsonify(result), 200
    except ModrinthRateLimitError as e:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth search error: %s", e)
        return jsonify({"error": f"Search failed: {str(e)}"}), 500


@mods_bp.route("/mods/<project_id>", methods=["GET"])
def get_mod_details(project_id: str):
    try:
        result = modrinth_client.get_project(project_id)
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth project error: %s", e)
        return jsonify({"error": f"Failed to get mod details: {str(e)}"}), 500


@mods_bp.route("/mods/<project_id>/versions", methods=["GET"])
def get_mod_versions(project_id: str):
    game_version = request.args.get("game_version")
    loader = request.args.get("loader")

    try:
        result = modrinth_client.get_project_versions(
            project_id, game_version=game_version, loader=loader
        )
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Modrinth versions error: %s", e)
        return jsonify({"error": f"Failed to get versions: {str(e)}"}), 500


# -- Per-server mod management --

@mods_bp.route("/servers/<name>/mods", methods=["GET"])
def list_installed_mods(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_modded_server(server_info)
    if err:
        return err

    server_dir = str(config.get_server_dir(name))
    mods = mod_manager.scan_installed_mods(server_dir)
    return jsonify({"mods": mods, "server_name": name}), 200


@mods_bp.route("/servers/<name>/mods/install", methods=["POST"])
def install_mod(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_modded_server(server_info)
    if err:
        return err

    data = request.get_json()
    if not data or "project_id" not in data or "version_id" not in data:
        return jsonify({"error": "Missing project_id or version_id"}), 400

    project_id = data["project_id"]
    version_id = data["version_id"]

    try:
        download_url, filename, file_size = modrinth_client.get_download_url(version_id)

        if file_size > MAX_DOWNLOAD_SIZE:
            return jsonify({"error": f"File too large ({file_size} bytes, max {MAX_DOWNLOAD_SIZE})"}), 400

        # Download the file
        resp = requests.get(download_url, timeout=DOWNLOAD_TIMEOUT, stream=True)
        resp.raise_for_status()

        # Stream with size check
        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=8192):
            total += len(chunk)
            if total > MAX_DOWNLOAD_SIZE:
                return jsonify({"error": "Download exceeded maximum file size"}), 400
            chunks.append(chunk)

        file_data = b"".join(chunks)

        server_dir = str(config.get_server_dir(name))
        mod_manager.install_mod_from_bytes(
            server_dir=server_dir,
            filename=filename,
            data=file_data,
            modrinth_project_id=project_id,
            modrinth_version_id=version_id,
        )

        restart_required = server_manager.is_server_running(name)

        return jsonify({
            "success": True,
            "filename": filename,
            "restart_required": restart_required,
        }), 200

    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Mod install error: %s", e)
        return jsonify({"error": f"Installation failed: {str(e)}"}), 500


@mods_bp.route("/servers/<name>/mods/<path:filename>/toggle", methods=["POST"])
def toggle_mod(name: str, filename: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    if not _validate_mod_filename(filename):
        return jsonify({"error": "Invalid mod filename"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_modded_server(server_info)
    if err:
        return err

    # Validate path stays within mods/
    server_dir = str(config.get_server_dir(name))
    mods_dir = os.path.realpath(os.path.join(server_dir, "mods"))
    target = os.path.realpath(os.path.join(mods_dir, filename))
    if not target.startswith(mods_dir + os.sep):
        return jsonify({"error": "Access denied: path outside mods directory"}), 400

    try:
        new_filename = mod_manager.toggle_mod(server_dir, filename)
        restart_required = server_manager.is_server_running(name)
        return jsonify({
            "success": True,
            "filename": new_filename,
            "enabled": not filename.endswith(".jar.disabled"),
            "restart_required": restart_required,
        }), 200
    except FileNotFoundError:
        return jsonify({"error": "Mod not found"}), 404
    except Exception as e:
        logger.error("Toggle mod error: %s", e)
        return jsonify({"error": f"Toggle failed: {str(e)}"}), 500


@mods_bp.route("/servers/<name>/mods/<path:filename>", methods=["DELETE"])
def delete_mod(name: str, filename: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    if not _validate_mod_filename(filename):
        return jsonify({"error": "Invalid mod filename"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_modded_server(server_info)
    if err:
        return err

    # Validate path stays within mods/
    server_dir = str(config.get_server_dir(name))
    mods_dir = os.path.realpath(os.path.join(server_dir, "mods"))
    target = os.path.realpath(os.path.join(mods_dir, filename))
    if not target.startswith(mods_dir + os.sep):
        return jsonify({"error": "Access denied: path outside mods directory"}), 400

    try:
        mod_manager.delete_mod(server_dir, filename)
        restart_required = server_manager.is_server_running(name)
        return jsonify({
            "success": True,
            "restart_required": restart_required,
        }), 200
    except FileNotFoundError:
        return jsonify({"error": "Mod not found"}), 404
    except Exception as e:
        logger.error("Delete mod error: %s", e)
        return jsonify({"error": f"Delete failed: {str(e)}"}), 500


@mods_bp.route("/servers/<name>/mods/check-deps", methods=["POST"])
def check_dependencies(name: str):
    if not _validate_server_name(name):
        return jsonify({"error": "Invalid server name"}), 400

    server_info = _get_server_info(name)
    if not server_info:
        return jsonify({"error": "Server not found"}), 404

    err = _require_modded_server(server_info)
    if err:
        return err

    data = request.get_json()
    if not data or "version_id" not in data:
        return jsonify({"error": "Missing version_id"}), 400

    version_id = data["version_id"]
    server_dir = str(config.get_server_dir(name))

    try:
        installed_ids = mod_manager.get_installed_project_ids(server_dir)
        result = modrinth_client.check_dependencies(version_id, installed_ids)
        return jsonify(result), 200
    except ModrinthRateLimitError:
        return jsonify({"error": "Modrinth rate limit exceeded, try again later"}), 429
    except Exception as e:
        logger.error("Dependency check error: %s", e)
        return jsonify({"error": f"Dependency check failed: {str(e)}"}), 500
```

- [ ] **Step 4: Register blueprint in app.py**

Add import and registration in `app/app.py`:

```python
# Add to imports (after line 21):
from app.routes.mod_routes import mods_bp

# Add to blueprint registrations (after line 86):
app.register_blueprint(mods_bp)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pytest tests/test_mod_routes.py -v
```
Expected: All PASS

- [ ] **Step 6: Run all backend tests**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pytest -v
```
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add app/routes/mod_routes.py app/app.py tests/test_mod_routes.py
git commit -m "feat(mods): add mod routes blueprint with search, install, toggle, delete"
```

---

## Chunk 3: Frontend Types, API Client, and Store

### Task 4: TypeScript Interfaces

**Files:**
- Modify: `web-ui/src/types/api.ts:308` (append new interfaces)

- [ ] **Step 1: Add mod-related interfaces to api.ts**

Append after line 308:

```typescript
// -- Mod Management --

export interface InstalledMod {
  filename: string
  enabled: boolean
  mod_id: string | null
  name: string
  version: string | null
  description: string | null
  authors: string[]
  file_size: number
  modified_at: string
  modrinth_project_id: string | null
}

export interface InstalledModsResponse {
  mods: InstalledMod[]
  server_name: string
}

export interface ModSearchResult {
  project_id: string
  slug: string
  title: string
  description: string
  icon_url: string | null
  downloads: number
  date_modified: string
  categories: string[]
}

export interface ModSearchResponse {
  hits: ModSearchResult[]
  total_hits: number
  limit: number
  offset: number
}

export interface ModVersion {
  id: string
  name: string
  version_number: string
  game_versions: string[]
  loaders: string[]
  files: Array<{
    filename: string
    size: number
    url: string
    primary: boolean
  }>
  dependencies: ModDependency[]
}

export interface ModDependency {
  project_id: string
  version_id: string | null
  dependency_type: "required" | "optional"
  name: string
}

export interface DependencyCheckRequest {
  version_id: string
}

export interface DependencyCheckResult {
  missing: ModDependency[]
  satisfied: string[]
}

export interface ModInstallRequest {
  project_id: string
  version_id: string
}

export interface ModInstallResponse {
  success: boolean
  filename: string
  restart_required: boolean
}

export interface ModToggleResponse {
  success: boolean
  filename: string
  enabled: boolean
  restart_required: boolean
}

export interface ModDeleteResponse {
  success: boolean
  restart_required: boolean
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system/web-ui
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/types/api.ts
git commit -m "feat(mods): add TypeScript interfaces for mod management"
```

---

### Task 5: API Client Functions

**Files:**
- Modify: `web-ui/src/api/client.ts` (add imports + ~8 functions)

- [ ] **Step 1: Add import types**

Add to the import block at top of `web-ui/src/api/client.ts`:

```typescript
// Add these to the existing import:
  ModSearchResponse,
  InstalledModsResponse,
  ModVersion,
  DependencyCheckResult,
  ModInstallRequest,
  ModInstallResponse,
  ModToggleResponse,
  ModDeleteResponse,
```

- [ ] **Step 2: Add API functions**

Append to end of `web-ui/src/api/client.ts`:

```typescript
// -- Mod Management --

export async function searchMods(
  query: string,
  version: string,
  loader: string,
  page: number = 0,
  limit: number = 20
): Promise<ModSearchResponse> {
  const response = await apiClient.get<ModSearchResponse>("/api/mods/search", {
    params: { query, version, loader, page, limit },
  })
  return response.data
}

export async function getModDetails(projectId: string): Promise<Record<string, unknown>> {
  const response = await apiClient.get(`/api/mods/${encodeURIComponent(projectId)}`)
  return response.data
}

export async function getModVersions(
  projectId: string,
  gameVersion?: string,
  loader?: string
): Promise<ModVersion[]> {
  const response = await apiClient.get<ModVersion[]>(
    `/api/mods/${encodeURIComponent(projectId)}/versions`,
    { params: { game_version: gameVersion, loader } }
  )
  return response.data
}

export async function getInstalledMods(serverName: string): Promise<InstalledModsResponse> {
  const response = await apiClient.get<InstalledModsResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/mods`
  )
  return response.data
}

export async function installMod(
  serverName: string,
  data: ModInstallRequest
): Promise<ModInstallResponse> {
  const response = await apiClient.post<ModInstallResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/mods/install`,
    data
  )
  return response.data
}

export async function toggleMod(
  serverName: string,
  filename: string
): Promise<ModToggleResponse> {
  const response = await apiClient.post<ModToggleResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/mods/${encodeURIComponent(filename)}/toggle`
  )
  return response.data
}

export async function deleteMod(
  serverName: string,
  filename: string
): Promise<ModDeleteResponse> {
  const response = await apiClient.delete<ModDeleteResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/mods/${encodeURIComponent(filename)}`
  )
  return response.data
}

export async function checkModDependencies(
  serverName: string,
  versionId: string
): Promise<DependencyCheckResult> {
  const response = await apiClient.post<DependencyCheckResult>(
    `/api/servers/${encodeURIComponent(serverName)}/mods/check-deps`,
    { version_id: versionId }
  )
  return response.data
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system/web-ui
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/api/client.ts
git commit -m "feat(mods): add API client functions for mod management"
```

---

### Task 6: Zustand Mod Store

**Files:**
- Create: `web-ui/src/store/useModStore.ts`

- [ ] **Step 1: Create the mod store**

```typescript
// web-ui/src/store/useModStore.ts
import { create } from "zustand"
import type { InstalledMod, ModSearchResult } from "@/types/api"

interface ModState {
  installedMods: InstalledMod[]
  searchResults: ModSearchResult[]
  searchQuery: string
  searchTotalHits: number
  searchPage: number
  installedFilter: "all" | "enabled" | "disabled"
  loading: boolean
  searchLoading: boolean
  installing: Set<string>  // project_ids currently being installed
  restartRequired: boolean
}

interface ModActions {
  setInstalledMods: (mods: InstalledMod[]) => void
  setSearchResults: (results: ModSearchResult[], totalHits: number) => void
  appendSearchResults: (results: ModSearchResult[], totalHits: number) => void
  setSearchQuery: (query: string) => void
  setSearchPage: (page: number) => void
  setInstalledFilter: (filter: ModState["installedFilter"]) => void
  setLoading: (loading: boolean) => void
  setSearchLoading: (loading: boolean) => void
  addInstalling: (projectId: string) => void
  removeInstalling: (projectId: string) => void
  setRestartRequired: (required: boolean) => void
  clearSearch: () => void
}

export const useModStore = create<ModState & ModActions>()((set) => ({
  installedMods: [],
  searchResults: [],
  searchQuery: "",
  searchTotalHits: 0,
  searchPage: 0,
  installedFilter: "all",
  loading: false,
  searchLoading: false,
  installing: new Set<string>(),
  restartRequired: false,

  setInstalledMods: (mods) => set({ installedMods: mods }),

  setSearchResults: (results, totalHits) =>
    set({ searchResults: results, searchTotalHits: totalHits }),

  appendSearchResults: (results, totalHits) =>
    set((state) => ({
      searchResults: [...state.searchResults, ...results],
      searchTotalHits: totalHits,
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSearchPage: (page) => set({ searchPage: page }),

  setInstalledFilter: (filter) => set({ installedFilter: filter }),

  setLoading: (loading) => set({ loading }),

  setSearchLoading: (loading) => set({ searchLoading: loading }),

  addInstalling: (projectId) =>
    set((state) => ({
      installing: new Set([...state.installing, projectId]),
    })),

  removeInstalling: (projectId) =>
    set((state) => {
      const next = new Set(state.installing)
      next.delete(projectId)
      return { installing: next }
    }),

  setRestartRequired: (required) => set({ restartRequired: required }),

  clearSearch: () =>
    set({
      searchResults: [],
      searchQuery: "",
      searchTotalHits: 0,
      searchPage: 0,
    }),
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system/web-ui
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/store/useModStore.ts
git commit -m "feat(mods): add Zustand store for mod management state"
```

---

## Chunk 4: Frontend Components and Page

### Task 7: ModCard Component

**Files:**
- Create: `web-ui/src/components/mods/ModCard.tsx`

- [ ] **Step 1: Create ModCard component**

```tsx
// web-ui/src/components/mods/ModCard.tsx
import { Trash2, Power, PowerOff } from "lucide-react"
import type { InstalledMod } from "@/types/api"

interface ModCardProps {
  mod: InstalledMod
  onToggle: (filename: string) => void
  onDelete: (filename: string) => void
}

export function ModCard({ mod, onToggle, onDelete }: ModCardProps) {
  const sizeKB = Math.round(mod.file_size / 1024)
  const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
      mod.enabled
        ? "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
        : "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-700 dark:bg-zinc-800/50"
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {mod.name}
          </span>
          {mod.version && (
            <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
              v{mod.version}
            </span>
          )}
        </div>
        {mod.description && (
          <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
            {mod.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span>{sizeLabel}</span>
          {mod.authors.length > 0 && <span>{mod.authors.join(", ")}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onToggle(mod.filename)}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          title={mod.enabled ? "Disable" : "Enable"}
        >
          {mod.enabled ? <Power size={16} /> : <PowerOff size={16} />}
        </button>
        <button
          onClick={() => onDelete(mod.filename)}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-ui/src/components/mods/ModCard.tsx
git commit -m "feat(mods): add ModCard component for installed mod display"
```

---

### Task 8: ModSearchResult Component

**Files:**
- Create: `web-ui/src/components/mods/ModSearchResult.tsx`

- [ ] **Step 1: Create ModSearchResult component**

```tsx
// web-ui/src/components/mods/ModSearchResult.tsx
import { Download, Check, Loader2 } from "lucide-react"
import type { ModSearchResult as ModSearchResultType } from "@/types/api"

interface ModSearchResultProps {
  mod: ModSearchResultType
  isInstalled: boolean
  isInstalling: boolean
  onSelect: (projectId: string) => void
}

export function ModSearchResult({ mod, isInstalled, isInstalling, onSelect }: ModSearchResultProps) {
  const downloads = mod.downloads > 1_000_000
    ? `${(mod.downloads / 1_000_000).toFixed(1)}M`
    : mod.downloads > 1_000
    ? `${(mod.downloads / 1_000).toFixed(1)}K`
    : `${mod.downloads}`

  return (
    <div
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
      onClick={() => !isInstalled && !isInstalling && onSelect(mod.project_id)}
    >
      {mod.icon_url ? (
        <img
          src={mod.icon_url}
          alt={mod.title}
          className="h-10 w-10 shrink-0 rounded"
          loading="lazy"
        />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded bg-zinc-200 dark:bg-zinc-700" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {mod.title}
          </span>
          {isInstalled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Check size={12} />
              Installed
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
          {mod.description}
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <Download size={12} />
            {downloads}
          </span>
        </div>
      </div>

      {!isInstalled && (
        <button
          disabled={isInstalling}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(mod.project_id)
          }}
        >
          {isInstalling ? <Loader2 size={16} className="animate-spin" /> : "Install"}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-ui/src/components/mods/ModSearchResult.tsx
git commit -m "feat(mods): add ModSearchResult component for search results"
```

---

### Task 9: DependencyModal Component

**Files:**
- Create: `web-ui/src/components/mods/DependencyModal.tsx`

- [ ] **Step 1: Create DependencyModal component**

```tsx
// web-ui/src/components/mods/DependencyModal.tsx
import { AlertTriangle } from "lucide-react"
import type { ModDependency } from "@/types/api"

interface DependencyModalProps {
  modName: string
  missing: ModDependency[]
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export function DependencyModal({ modName, missing, onConfirm, onCancel, loading }: DependencyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Missing Dependencies</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {modName} requires the following mods:
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {missing.map((dep) => (
            <li
              key={dep.project_id}
              className="rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              {dep.name}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Installing..." : "Install All"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-ui/src/components/mods/DependencyModal.tsx
git commit -m "feat(mods): add DependencyModal for missing dependency confirmation"
```

---

### Task 10: ModDetailPanel Component

**Files:**
- Create: `web-ui/src/components/mods/ModDetailPanel.tsx`

- [ ] **Step 1: Create ModDetailPanel component**

```tsx
// web-ui/src/components/mods/ModDetailPanel.tsx
import { useState, useEffect } from "react"
import { X, Loader2, Download } from "lucide-react"
import { getModVersions } from "@/api/client"
import type { ModVersion } from "@/types/api"

interface ModDetailPanelProps {
  projectId: string
  title: string
  description: string
  iconUrl: string | null
  serverVersion: string
  serverLoader: string
  onInstall: (versionId: string) => void
  onClose: () => void
  installing: boolean
}

export function ModDetailPanel({
  projectId,
  title,
  description,
  iconUrl,
  serverVersion,
  serverLoader,
  onInstall,
  onClose,
  installing,
}: ModDetailPanelProps) {
  const [versions, setVersions] = useState<ModVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getModVersions(projectId, serverVersion, serverLoader)
      .then((data) => {
        if (!cancelled) {
          setVersions(data)
          if (data.length > 0) {
            setSelectedVersion(data[0].id)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [projectId, serverVersion, serverLoader])

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {iconUrl ? (
            <img src={iconUrl} alt={title} className="h-12 w-12 rounded" />
          ) : (
            <div className="h-12 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
          )}
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={20} className="animate-spin text-zinc-400" />
          </div>
        ) : versions.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-500">
            No compatible versions found for {serverVersion} ({serverLoader})
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Version
              </label>
              <select
                value={selectedVersion || ""}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_number} — {v.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => selectedVersion && onInstall(selectedVersion)}
              disabled={!selectedVersion || installing}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {installing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {installing ? "Installing..." : "Install"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-ui/src/components/mods/ModDetailPanel.tsx
git commit -m "feat(mods): add ModDetailPanel with version selector"
```

---

### Task 11: Mods Page

**Files:**
- Create: `web-ui/src/pages/Mods.tsx`

- [ ] **Step 1: Create the Mods page**

```tsx
// web-ui/src/pages/Mods.tsx
import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import { Package, Search, AlertTriangle, RotateCcw, Loader2 } from "lucide-react"
import { useModStore } from "@/store/useModStore"
import { useServerStore } from "@/store/useServerStore"
import {
  getInstalledMods,
  searchMods,
  installMod,
  toggleMod,
  deleteMod,
  checkModDependencies,
  stopServer,
  startServer,
} from "@/api/client"
import { ModCard } from "@/components/mods/ModCard"
import { ModSearchResult } from "@/components/mods/ModSearchResult"
import { ModDetailPanel } from "@/components/mods/ModDetailPanel"
import { DependencyModal } from "@/components/mods/DependencyModal"
import type { ModDependency } from "@/types/api"

export default function Mods() {
  const { serverName } = useParams<{ serverName: string }>()
  const servers = useServerStore((s) => s.servers)
  const server = servers.find((s) => s.name === serverName)

  const {
    installedMods, searchResults, searchQuery, searchTotalHits,
    searchPage, installedFilter, loading, searchLoading,
    installing, restartRequired,
    setInstalledMods, setSearchResults, appendSearchResults,
    setSearchQuery, setSearchPage, setInstalledFilter, setLoading,
    setSearchLoading, addInstalling, removeInstalling,
    setRestartRequired, clearSearch,
  } = useModStore()

  const [selectedProject, setSelectedProject] = useState<{
    projectId: string; title: string; description: string; iconUrl: string | null
  } | null>(null)

  const [depsModal, setDepsModal] = useState<{
    modName: string; missing: ModDependency[]; versionId: string; projectId: string
  } | null>(null)
  const [depsInstalling, setDepsInstalling] = useState(false)

  const serverVersion = server?.version || ""
  const serverLoader = server?.server_type || ""

  // Load installed mods
  const loadInstalled = useCallback(async () => {
    if (!serverName) return
    setLoading(true)
    try {
      const data = await getInstalledMods(serverName)
      setInstalledMods(data.mods)
    } catch {
      // handled by error state
    } finally {
      setLoading(false)
    }
  }, [serverName, setInstalledMods, setLoading])

  useEffect(() => { loadInstalled() }, [loadInstalled])

  // Search mods
  const handleSearch = useCallback(async (query: string, page: number = 0) => {
    if (!query.trim() || !serverVersion || !serverLoader) return
    setSearchLoading(true)
    try {
      const data = await searchMods(query, serverVersion, serverLoader, page)
      if (page === 0) {
        setSearchResults(data.hits, data.total_hits)
      } else {
        appendSearchResults(data.hits, data.total_hits)
      }
      setSearchPage(page)
    } catch {
      if (page === 0) setSearchResults([], 0)
    } finally {
      setSearchLoading(false)
    }
  }, [serverVersion, serverLoader, setSearchResults, appendSearchResults, setSearchPage, setSearchLoading])

  // Install flow
  const handleInstallClick = async (projectId: string, versionId: string) => {
    if (!serverName) return

    // Check dependencies first
    try {
      const deps = await checkModDependencies(serverName, versionId)
      if (deps.missing.length > 0) {
        const mod = searchResults.find((m) => m.project_id === projectId)
        setDepsModal({
          modName: mod?.title || projectId,
          missing: deps.missing,
          versionId,
          projectId,
        })
        return
      }
    } catch {
      // Proceed without dep check if it fails
    }

    await doInstall(projectId, versionId)
  }

  const doInstall = async (projectId: string, versionId: string) => {
    if (!serverName) return
    addInstalling(projectId)
    try {
      const result = await installMod(serverName, { project_id: projectId, version_id: versionId })
      if (result.restart_required) {
        setRestartRequired(true)
      }
      await loadInstalled()
    } finally {
      removeInstalling(projectId)
    }
  }

  const handleDepsConfirm = async () => {
    if (!depsModal || !serverName) return
    setDepsInstalling(true)
    try {
      // Install dependencies first
      for (const dep of depsModal.missing) {
        if (dep.version_id) {
          await doInstall(dep.project_id, dep.version_id)
        }
      }
      // Install the main mod
      await doInstall(depsModal.projectId, depsModal.versionId)
    } finally {
      setDepsInstalling(false)
      setDepsModal(null)
    }
  }

  // Toggle & Delete
  const handleToggle = async (filename: string) => {
    if (!serverName) return
    try {
      const result = await toggleMod(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error toast */ }
  }

  const handleDelete = async (filename: string) => {
    if (!serverName || !confirm(`Delete ${filename}?`)) return
    try {
      const result = await deleteMod(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error toast */ }
  }

  // Restart server
  const handleRestart = async () => {
    if (!serverName) return
    try {
      await stopServer({ server_name: serverName })
      // Wait briefly for clean shutdown
      await new Promise((r) => setTimeout(r, 2000))
      await startServer({ server_name: serverName })
      setRestartRequired(false)
    } catch { /* error toast */ }
  }

  // Filter installed mods
  const filteredMods = installedMods.filter((mod) => {
    if (installedFilter === "enabled") return mod.enabled
    if (installedFilter === "disabled") return !mod.enabled
    return true
  })

  const installedProjectIds = new Set(
    installedMods
      .map((m) => m.modrinth_project_id)
      .filter((id): id is string => id !== null)
  )

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package size={24} className="text-blue-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Mods</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage mods for {serverName}
          </p>
        </div>
      </div>

      {/* Restart warning */}
      {restartRequired && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle size={16} />
            Mods have changed. Restart the server to apply.
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            <RotateCcw size={14} />
            Restart
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Installed */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Installed ({installedMods.length})
            </h2>
            <div className="flex gap-1">
              {(["all", "enabled", "disabled"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setInstalledFilter(f)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    installedFilter === f
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
            </div>
          ) : filteredMods.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
              <Package size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" />
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No mods installed
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMods.map((mod) => (
                <ModCard
                  key={mod.filename}
                  mod={mod}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Search & Install */}
        <div>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">
            Browse Modrinth
          </h2>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search mods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchQuery)
              }}
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Detail panel (shown when a mod is selected) */}
          {selectedProject && (
            <div className="mb-4">
              <ModDetailPanel
                projectId={selectedProject.projectId}
                title={selectedProject.title}
                description={selectedProject.description}
                iconUrl={selectedProject.iconUrl}
                serverVersion={serverVersion}
                serverLoader={serverLoader}
                onInstall={(versionId) =>
                  handleInstallClick(selectedProject.projectId, versionId)
                }
                onClose={() => setSelectedProject(null)}
                installing={installing.has(selectedProject.projectId)}
              />
            </div>
          )}

          {/* Search results */}
          {searchLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((mod) => (
                <ModSearchResult
                  key={mod.project_id}
                  mod={mod}
                  isInstalled={installedProjectIds.has(mod.project_id)}
                  isInstalling={installing.has(mod.project_id)}
                  onSelect={(projectId) => {
                    setSelectedProject({
                      projectId,
                      title: mod.title,
                      description: mod.description,
                      iconUrl: mod.icon_url,
                    })
                  }}
                />
              ))}
              {searchTotalHits > (searchPage + 1) * 20 && (
                <button
                  onClick={() => handleSearch(searchQuery, searchPage + 1)}
                  className="w-full rounded-md border border-zinc-300 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Load More
                </button>
              )}
            </div>
          ) : searchQuery ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No results found
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Search Modrinth for mods to install
            </p>
          )}
        </div>
      </div>

      {/* Dependency modal */}
      {depsModal && (
        <DependencyModal
          modName={depsModal.modName}
          missing={depsModal.missing}
          onConfirm={handleDepsConfirm}
          onCancel={() => setDepsModal(null)}
          loading={depsInstalling}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system/web-ui
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/pages/Mods.tsx
git commit -m "feat(mods): add Mods page with search, install, and management"
```

---

### Task 12: Router and Sidebar Integration

**Files:**
- Modify: `web-ui/src/lib/router.tsx:10-14,48-96` (add lazy import + route)
- Modify: `web-ui/src/components/layout/Sidebar.tsx` (add Mods nav item, hide for vanilla)

- [ ] **Step 1: Add route to router.tsx**

In `web-ui/src/lib/router.tsx`:

1. Add lazy import after line 14:
```typescript
const Mods = lazy(() => import("@/pages/Mods"))
```

2. Add route as a child of `/:serverName/panel` (after the settings route, before the closing `]`):
```typescript
        {
          path: "mods",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Mods />
            </Suspense>
          ),
        },
```

- [ ] **Step 2: Add Mods to Sidebar**

In `web-ui/src/components/layout/Sidebar.tsx`:

1. Add `Package` to the Lucide imports
2. Add `useServerStore` import
3. Read server list from store to determine `server_type`
4. Add Mods `SidebarItem` (conditionally rendered — hidden when `server_type` is `vanilla`):

```tsx
// After the 文件 (Files) sidebar item, before 备份 (Backups):
{serverType !== "vanilla" && (
  <SidebarItem
    to={`${basePath}/mods`}
    icon={<Package className="w-5 h-5" />}
    label="模组"
    collapsed={collapsed}
  />
)}
```

Where `serverType` is derived:
```tsx
const servers = useServerStore((s) => s.servers)
const currentServer = servers.find((s) => s.name === serverName)
const serverType = currentServer?.server_type?.toLowerCase() || ""
```

- [ ] **Step 3: Verify the app builds**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system/web-ui
npm run build
```
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/lib/router.tsx web-ui/src/components/layout/Sidebar.tsx
git commit -m "feat(mods): integrate Mods page into router and sidebar navigation"
```

---

## Chunk 5: Integration Testing and Final Verification

### Task 13: End-to-End Smoke Test

- [ ] **Step 1: Start both frontend and backend**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
python start.py
```

- [ ] **Step 2: Manual verification checklist**

1. Navigate to a Fabric server panel
2. Verify "Mods" appears in sidebar
3. Navigate to Mods page — should show empty installed list
4. Search "sodium" — should return results from Modrinth
5. Click a result — version selector should appear
6. Install a mod — file should appear in `mods/` directory
7. Toggle mod (disable/enable) — filename changes
8. Delete mod — file removed
9. Navigate to a vanilla server — verify "Mods" is NOT in sidebar

- [ ] **Step 3: Run all backend tests**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system
pytest -v
```
Expected: All PASS

- [ ] **Step 4: Run frontend lint**

```bash
cd E:/Joshua/Code/Python/mc-server-manage-system/web-ui
npm run lint
```
Expected: No errors

- [ ] **Step 5: Final commit (if any lint/type fixes needed)**

Stage only the specific files that needed fixes:

```bash
git add <specific-files-that-were-fixed>
git commit -m "fix(mods): address lint and type issues from integration"
```
