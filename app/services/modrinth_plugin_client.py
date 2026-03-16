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
        categories: list[str] | None = None,
        index: str | None = None,
    ) -> dict[str, Any]:
        cats_key = ",".join(sorted(categories)) if categories else ""
        cache_key = f"plugin_search:{query}:{game_version}:{page}:{limit}:{cats_key}:{index}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        facets_list: list[list[str]] = [
            ["categories:paper"],
            [f"versions:{game_version}"],
            ["project_type:plugin"],
        ]
        if categories:
            for cat in categories:
                facets_list.append([f"categories:{cat}"])

        params: dict[str, Any] = {
            "query": query,
            "facets": json.dumps(facets_list),
            "limit": limit,
            "offset": page * limit,
        }
        if index:
            params["index"] = index

        result = self._get("/search", params=params)
        self._set_cached(cache_key, result)
        return result


# Module-level singleton
modrinth_plugin_client = ModrinthPluginClient()
