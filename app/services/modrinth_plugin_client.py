import json
from typing import Any

from app.services.modrinth_client import ModrinthClient


class ModrinthPluginClient(ModrinthClient):
    """Modrinth client pre-configured for Paper plugin searches."""

    def search_plugins(
        self,
        query: str,
        game_version: str,
        page: int = 0,
        limit: int = 20,
    ) -> dict[str, Any]:
        cache_key = f"plugin_search:{query}:{game_version}:{page}:{limit}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        facets = json.dumps([
            ["categories:paper"],
            [f"versions:{game_version}"],
            ["project_type:plugin"],
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


# Module-level singleton
modrinth_plugin_client = ModrinthPluginClient()
