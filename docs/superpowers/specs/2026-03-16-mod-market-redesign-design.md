# Mod Market Redesign — Modrinth-Style UI

**Date:** 2026-03-16
**Scope:** Mods and Plugins pages full redesign

---

## Overview

Redesign the Mods and Plugins pages to match Modrinth's browsing experience: a full-page market view with category filters, sort options, grid/list toggle, and default-loaded results. The server's game version and loader are applied automatically — users never need to set them manually.

---

## Page Structure

`Mods.tsx` and `Plugins.tsx` become tab containers with two tabs:

1. **浏览市场 (Browse Market)** — renders `<ModMarket type="mod" | "plugin" />`
2. **已安装 (Installed) (N)** — renders the existing installed mod list using `ModCard`

The restart-required banner remains visible across both tabs. The installed count badge on the tab updates in real time.

Both pages share the same structure; the only difference is the `type` prop passed to `ModMarket`.

---

## ModMarket Component

**File:** `web-ui/src/components/mods/ModMarket.tsx`

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  🔍 [Search bar]                  [≡ List] [⊞ Grid]      │
│                                   [Sort: Downloads ▾]    │
├────────────┬─────────────────────────────────────────────┤
│ Filters    │  Card area                                  │
│            │                                             │
│ Categories │  Grid: 2–3 columns of ModProjectCard        │
│ □ Adventure│  List: full-width rows of ModProjectCard    │
│ □ Magic    │                                             │
│ □ Tech     │  [Load More]                                │
│  ...       │                                             │
│ [Clear]    │                                             │
└────────────┴─────────────────────────────────────────────┘
```

### State (local, not Zustand)

| State | Type | Default |
|-------|------|---------|
| `query` | `string` | `""` |
| `selectedCategories` | `string[]` | `[]` |
| `sortBy` | `"relevance" \| "downloads" \| "newest" \| "updated"` | `"downloads"` |
| `viewMode` | `"grid" \| "list"` | `"grid"` |
| `results` | `ModSearchResult[]` | `[]` |
| `page` | `number` | `0` |
| `totalHits` | `number` | `0` |
| `loading` | `boolean` | `false` |

### Behavior

- On mount: fetch results immediately with empty query, sorted by downloads
- Any change to `query`, `selectedCategories`, or `sortBy` resets to page 0 and replaces results
- "Load More" appends next page
- `ModDetailPanel` and `DependencyModal` are rendered inside `ModMarket` (existing install flow unchanged)

---

## ModProjectCard Component

**File:** `web-ui/src/components/mods/ModProjectCard.tsx`

Replaces `ModSearchResult` in the market context. Accepts a `viewMode` prop.

### Grid View

```
┌──────────────────────────┐
│ [icon 64x64]  ✓ Installed│
│                          │
│ Title                    │
│ Description (2 lines)... │
│                          │
│ [Category] [Category]    │
│                          │
│ ↓ 12.3M    🕐 3 days ago │
└──────────────────────────┘
```

### List View

```
┌─────────────────────────────────────────────────────────────┐
│ [icon 48x48]  Title                     ↓ 12.3M  3 days ago │
│               Description (1 line)...  [Cat] [Cat] [Install]│
└─────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface ModProjectCardProps {
  mod: ModSearchResult
  viewMode: "grid" | "list"
  isInstalled: boolean
  onSelect: (mod: ModSearchResult) => void
}
```

- Click anywhere on card → calls `onSelect` to open `ModDetailPanel`
- Already-installed mods show "Installed" badge; no Install button shown
- Categories capped at 3 tags to avoid overflow

---

## MarketSidebar Component

**File:** `web-ui/src/components/mods/MarketSidebar.tsx`

Renders the categories filter panel.

- Loads category list from `GET /api/mods/categories` (or `/api/plugins/categories`) on mount
- Renders a checkbox list grouped by header
- "Clear" button resets all selections
- Emits `onCategoriesChange(categories: string[])` to parent

---

## Backend Changes

### Extend Search Endpoints

**`GET /api/mods/search`** — add two new optional params:

| Param | Type | Description |
|-------|------|-------------|
| `categories[]` | `string[]` | Filter by Modrinth categories; maps to `facets` |
| `index` | `string` | Sort order: `relevance`, `downloads`, `newest`, `updated` |

Same changes applied to `GET /api/plugins/search`.

### New Categories Endpoint

**`GET /api/mods/categories`**
- Fetches from Modrinth `GET /v2/tag/category`
- Filters by `project_type: "mod"`
- Cached in memory for 1 hour
- Returns: `[{ name: string, icon: string, header: string }]`

**`GET /api/plugins/categories`**
- Same, but filters by `project_type: "mod"` with `categories: ["paper"]` (Modrinth plugin categories)

### Service Layer

`modrinth_client.py` — extend `search()` to accept `facets` list and `index` string, pass through to Modrinth API.

`modrinth_plugin_client.py` — same update.

---

## Frontend API Changes

`api/client.ts`:

```typescript
// Updated signatures
searchMods(query, version, loader, page?, limit?, categories?, index?): Promise<ModSearchResponse>
searchPlugins(query, version, page?, limit?, categories?, index?): Promise<ModSearchResponse>

// New
getModCategories(): Promise<ModCategory[]>
getPluginCategories(): Promise<ModCategory[]>
```

New type in `types/api.ts`:
```typescript
interface ModCategory {
  name: string
  icon: string
  header: string
}
```

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `web-ui/src/components/mods/ModProjectCard.tsx` | Card component for grid/list views |
| `web-ui/src/components/mods/MarketSidebar.tsx` | Categories filter sidebar |
| `web-ui/src/components/mods/ModMarket.tsx` | Market container (browse/search/filter) |

### Modified Files
| File | Change |
|------|--------|
| `web-ui/src/pages/Mods.tsx` | Convert to tab container |
| `web-ui/src/pages/Plugins.tsx` | Convert to tab container |
| `web-ui/src/api/client.ts` | Extend search signatures, add categories functions |
| `web-ui/src/types/api.ts` | Add `ModCategory` type |
| `app/routes/mod_routes.py` | Extend search params, add categories endpoint |
| `app/routes/plugin_routes.py` | Same |
| `app/services/modrinth_client.py` | Support facets + index |
| `app/services/modrinth_plugin_client.py` | Same |

### Unchanged (Fully Reused)
- `ModCard.tsx` — installed tab cards
- `ModDetailPanel.tsx` — install flow
- `DependencyModal.tsx` — dependency checks
- All Zustand stores

---

## Out of Scope

- Game version or loader filter UI (auto-applied from server config)
- Modrinth color scheme (keep existing app colors)
- Screenshots gallery or full project description page
- Follower count display
