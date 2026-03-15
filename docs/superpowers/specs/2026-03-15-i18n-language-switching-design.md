# i18n Language Switching System — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Frontend only (`web-ui/`)

---

## Problem Statement

The frontend has ~257 unique Chinese strings hardcoded across ~73 files with zero i18n infrastructure. The goal is a clean Chinese/English switching system that auto-detects browser language, persists user preference, and integrates naturally into the existing architecture.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| i18n library | `react-i18next` | Mature, handles interpolation, browser detection, localStorage persistence; React 19 compatible |
| Default language | Browser language → fallback Chinese | Matches user expectation; `zh`/`zh-CN`/`zh-TW` → Chinese, `en*` → English, else → Chinese |
| Persistence | `localStorage` via i18next built-in | Auto-detected from browser, manually overridable, survives page refresh |
| Language switcher placement | TopNav (top navigation bar) | Globally visible, always accessible |
| Switcher UI | Dropdown (Globe icon + current language label) | Extensible for future languages; clear affordance |

---

## Architecture

### New Files

```
web-ui/src/
├── i18n/
│   ├── config.ts              # i18next initialization (browser detection + localStorage)
│   └── locales/
│       ├── zh-CN.json         # Chinese translations (~257 strings)
│       └── en-US.json         # English translations (~257 strings)
```

### Modified Files

```
web-ui/
├── package.json               # Add: react-i18next, i18next, i18next-browser-languagedetector
├── src/main.tsx               # Import i18n/config.ts
├── src/components/layout/TopNav.tsx   # Add language dropdown
└── ~73 pages + components     # Replace hardcoded strings with t('key')
```

### Data Flow

```
App Start
  → i18next reads localStorage('i18nextLng')
  → If missing: navigator.language detection
    → zh* → 'zh-CN' | en* → 'en-US' | else → 'zh-CN' (fallback)
  → All components receive language via React context
  → User selects language in TopNav dropdown
    → i18next.changeLanguage() called
    → localStorage updated automatically
    → All components re-render with new locale
```

---

## Translation Structure

### Namespaces

| Namespace | Contents | Approx. Strings |
|-----------|----------|-----------------|
| `common` | Navigation, buttons, status words, generic actions | ~60 |
| `dashboard` | Metrics, charts, time ranges | ~35 |
| `players` | Player management actions and messages | ~45 |
| `servers` | Server creation, management, status | ~50 |
| `mods` | Mod and plugin management (shared components) | ~40 |
| `backups` | Backup operations and status | ~25 |
| `files` | File browser and editor | ~20 |
| `settings` | Startup params, server properties, scheduled tasks | ~35 |

### Key Naming Convention

Format: `section.key` (max two levels deep)

```json
{
  "nav": { "dashboard": "仪表盘" },
  "status": { "running": "运行中" },
  "actions": { "confirm": "确认" }
}
```

### Interpolation

Use i18next `{{variable}}` syntax for dynamic strings:

```json
{ "kickSuccess": "{{username}} 已被踢出" }
```

```tsx
t('kickSuccess', { username: 'Steve' })
// → "Steve 已被踢出" / "Steve has been kicked"
```

---

## TopNav Language Switcher

```
┌─────────────────────────────────┐
│  MC Panel    [...]   [🌐 中文 ▾] │
└─────────────────────────────────┘
                        ┌──────────┐
                        │ ✓ 中文   │
                        │   English│
                        └──────────┘
```

- Icon: `Globe` from `lucide-react` (already installed)
- Styling: matches existing TopNav Tailwind patterns
- Behavior: immediate language switch on selection, no page reload

---

## Special Cases

| Case | Handling |
|------|----------|
| `toLocaleString('zh-CN')` hardcoded | Replace with `i18n.language` dynamic value |
| Console WebSocket logs | **Not translated** — raw Java server output |
| Mixed strings like `"CPU 使用率"` | Translated as whole unit (`"CPU Usage"` in English) |
| Already-English strings (`"Connecting..."`) | Added to both locales; Chinese version added |
| Flask API error messages | **Out of scope** — remain English, wrapped by frontend try/catch |

---

## Out of Scope

- Backend Flask API message translation
- RTL language support
- Third language addition
- Pluralization rules (not needed for Chinese/English pair)

---

## Implementation Order

1. Install dependencies + create `i18n/config.ts`
2. Create `zh-CN.json` and `en-US.json` with all strings
3. Import config in `main.tsx`
4. Add language switcher to `TopNav.tsx`
5. Migrate `common` namespace strings (affects most files)
6. Migrate per-namespace: `dashboard` → `players` → `servers` → `mods` → `backups` → `files` → `settings`
7. Fix hardcoded `toLocaleString('zh-CN')` calls

---

## Dependencies to Add

```json
{
  "react-i18next": "^15.x",
  "i18next": "^24.x",
  "i18next-browser-languagedetector": "^8.x"
}
```
