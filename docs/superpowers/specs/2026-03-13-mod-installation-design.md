# Mod Installation Feature Design

**Date:** 2026-03-13
**Status:** Approved

## Overview

Add mod search, installation, and management functionality to the Minecraft server management system. Integrates with Modrinth API (CurseForge planned for later). Supports online search/install, manual management, basic compatibility checking, and dependency resolution.

## Architecture: Backend Proxy Model

All Modrinth API calls are proxied through the Flask backend. This keeps logic centralized (download, dependency resolution, file operations all server-side), enables caching, and makes future CurseForge integration a backend-only change.

## Backend API Design

### New Route Module: `app/routes/mod_routes.py`

Register as `mods_bp` Blueprint in `app/app.py` alongside existing blueprints.

**Search & Browse (proxied Modrinth v2):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mods/search` | Search mods. Query params: `query`, `version`, `loader`, `page`, `limit` |
| GET | `/api/mods/<project_id>` | Get mod details (description, icon, dependencies) |
| GET | `/api/mods/<project_id>/versions` | Get available versions. Query params: `game_version`, `loader` |

**Install & Manage (per-server):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/servers/<name>/mods/install` | Install mod. Body: `{project_id, version_id}` |
| GET | `/api/servers/<name>/mods` | List installed mods (scan `mods/` dir, parse JAR metadata) |
| DELETE | `/api/servers/<name>/mods/<filename>` | Uninstall mod (delete file) |
| POST | `/api/servers/<name>/mods/<filename>/toggle` | Enable/disable (rename `.jar` <-> `.jar.disabled`) |

**Dependency Check:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/servers/<name>/mods/check-deps` | Body: `{project_id, version_id}`. Returns missing required dependencies |

### Security & Validation

All per-server endpoints MUST:
- Validate `<name>` parameter: reject names containing `..`, `/`, or `\` (same pattern as clone endpoint in `server_routes.py`)
- Validate server exists in database before proceeding

For `<filename>` parameter in DELETE and toggle endpoints:
- Use `validate_server_path()` from `server_manager.py` to ensure resolved path stays within the server directory
- Additionally restrict to `mods/` subdirectory only — reject any path that resolves outside `<server_dir>/mods/`
- Validate filename matches `*.jar` or `*.jar.disabled` pattern

### Error Response Format

All endpoints follow the existing codebase convention:

| Status | Response |
|--------|----------|
| 200 | `{"success": true, "data": ...}` or operation-specific payload |
| 400 | `{"error": "Bad request: <details>"}` — invalid input, bad filename, unsupported server type |
| 404 | `{"error": "Server not found"}` or `{"error": "Mod not found"}` |
| 429 | `{"error": "Modrinth rate limit exceeded, try again later"}` |
| 500 | `{"error": "Internal error: <details>"}` — download failure, file I/O error |

### Server Version & Loader Source

Compatibility filtering reads `server_type` and `version` from the `server_instance` database table for the given server name. These values are set during server creation and determine which Modrinth versions are shown.

### Non-Modded Server Handling

For vanilla servers (no loader), the mods endpoints return:
- `GET /api/servers/<name>/mods` returns `{"error": "Mods are not supported for vanilla servers"}` with 400
- Install/toggle/delete also return 400

The frontend hides the "Mods" sidebar entry for vanilla servers.

## Backend Service Layer

### Module Structure

Split into focused modules per coding style guidelines (200-400 lines each):

| Module | Responsibility |
|--------|---------------|
| `app/services/modrinth_client.py` | Modrinth API v2 proxy + in-memory caching |
| `app/services/mod_manager.py` | JAR scanning, install/delete, enable/disable, metadata storage |

Dependency resolution lives in `modrinth_client.py` since it uses the Modrinth API.

### Modrinth API Client (`modrinth_client.py`)

- Base URL: `https://api.modrinth.com/v2/`
- In-memory cache with 5-minute TTL for search results
- User-Agent header: `mc-server-manager/1.0` (per Modrinth guidelines)
- Uses `requests` library (already a project dependency via Flask)
- Respects `X-Ratelimit-Remaining` and `Retry-After` headers from Modrinth; returns 429 to frontend when rate limited
- Download timeout: 60 seconds per file
- Maximum file size: 50MB (reject larger downloads)

### Mod File Manager (`mod_manager.py`)

- `scan_installed_mods(server_name)` — scans `mods/` directory
- Reads `fabric.mod.json` from each JAR using `zipfile` module
- Extracts: mod_id, name, version, description, authors, dependencies
- For non-parseable JARs: returns filename, file size, modified time as basic info
- `.jar.disabled` files are scanned and marked `enabled: false`
- Uses a per-server lock (`threading.Lock`) to serialize install/delete/toggle operations for the same server, preventing concurrent file conflicts
- On download failure: clean up partial files before returning error

### Mod Metadata Storage

At install time, store a `mods_metadata.json` file in the server's `mods/` directory:

```json
{
  "mod-filename.jar": {
    "modrinth_project_id": "XXXXXX",
    "modrinth_version_id": "YYYYYY",
    "installed_at": "2026-03-13T10:00:00Z"
  }
}
```

This enables:
- Reliable "already installed" detection in search results (match by project_id, not filename)
- Future update checking (compare installed version_id against latest)

### Dependency Resolution

- Reads `dependencies` field from Modrinth version API response
- Filters for `dependency_type == "required"` only
- Compares against installed mods list (by Modrinth project_id from metadata, falling back to mod_id from fabric.mod.json) to find missing dependencies
- Single-level resolution only (no recursive dependency walking)
- Returns list of missing deps with project_id, name, recommended version

### Installation Flow

```
User clicks Install
  -> Frontend calls check-deps
  -> Shows missing dependencies in modal
  -> User confirms
  -> Frontend calls install (can batch)
  -> Backend acquires per-server lock
  -> Backend downloads JAR(s) to mods/ (60s timeout, 50MB limit)
  -> Updates mods_metadata.json
  -> Checks server running status
  -> Returns result + restart hint if server is running
```

## Frontend Design

### New Page: `web-ui/src/pages/Mods.tsx`

**Two-column layout:**

**Left Column — Installed Mods:**
- Card-style display: mod icon, name, version, enable/disable toggle
- Action menu per card: delete, enable/disable
- Filter bar: All / Enabled / Disabled
- Empty state: "No mods installed"

**Right Column — Online Search & Install:**
- Search input + results list
- Each result shows: icon, name, summary, download count, last updated
- Click to expand: full description, version selector (filtered by server version + loader)
- Install button -> dependency check -> confirmation modal -> batch install
- Already-installed mods marked in search results (matched by Modrinth project_id from metadata)

### New Frontend Files

| File | Purpose |
|------|---------|
| `web-ui/src/pages/Mods.tsx` | Page component |
| `web-ui/src/components/mods/ModCard.tsx` | Installed mod card |
| `web-ui/src/components/mods/ModSearchResult.tsx` | Search result item |
| `web-ui/src/components/mods/DependencyModal.tsx` | Missing dependencies confirmation |
| `web-ui/src/components/mods/ModDetailPanel.tsx` | Expanded mod details |
| `web-ui/src/store/useModStore.ts` | Zustand store for mod state |
| `web-ui/src/types/api.ts` | New mod-related interfaces (added to existing file) |
| `web-ui/src/api/client.ts` | ~8 new API functions (added to existing file) |

### TypeScript Interfaces

Add to `web-ui/src/types/api.ts`:

```typescript
interface InstalledMod {
  filename: string
  enabled: boolean
  mod_id: string | null       // from fabric.mod.json
  name: string                // from fabric.mod.json or filename
  version: string | null      // from fabric.mod.json
  description: string | null
  authors: string[]
  file_size: number
  modified_at: string
  modrinth_project_id: string | null  // from mods_metadata.json
}

interface ModSearchResult {
  project_id: string
  slug: string
  title: string
  description: string
  icon_url: string | null
  downloads: number
  updated: string
  categories: string[]
  installed: boolean          // matched against installed mods
}

interface ModVersion {
  version_id: string
  name: string
  version_number: string
  game_versions: string[]
  loaders: string[]
  file_name: string
  file_size: number
  dependencies: ModDependency[]
}

interface ModDependency {
  project_id: string
  version_id: string | null
  dependency_type: 'required' | 'optional'
  name: string               // resolved from Modrinth
}

interface DependencyCheckResult {
  missing: ModDependency[]
  satisfied: string[]         // project_ids already installed
}

interface ModInstallResponse {
  success: boolean
  filename: string
  restart_required: boolean   // true if server is running
}
```

### Routing

- Add `/:serverName/panel/mods` route in `web-ui/src/lib/router.tsx` (nested under existing `/:serverName/panel` layout, consistent with other server pages)
- Add "Mods" entry to sidebar navigation
- Hide "Mods" sidebar entry when `server_type` is `vanilla`

### Server Running State Handling

- After any mod change (install/delete/toggle) while server is running: show yellow warning bar at top of page — "Mods have changed, restart the server to apply" with a "Restart Server" button
- When server is stopped: no warning shown

## Enable/Disable Mechanism

File rename approach (community standard):
- Disable: `modname.jar` -> `modname.jar.disabled`
- Enable: `modname.jar.disabled` -> `modname.jar`

Also updates `mods_metadata.json` keys accordingly.

## Compatibility Checking

Two levels:
1. **Version match** — filter Modrinth versions by server's Minecraft version (from `server_instance.version`)
2. **Loader match** — filter by loader type (fabric/forge) matching `server_instance.server_type`

Incompatible versions are not shown in the version selector.

## Future Extensibility

- CurseForge integration: add `curseforge_client.py`, new routes, frontend unchanged
- Recursive dependency resolution: extend `check-deps` logic
- Mod update checking: compare installed version_id (from metadata) against latest Modrinth version
- Modpack support: bulk import from modpack manifests
