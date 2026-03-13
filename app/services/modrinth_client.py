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
