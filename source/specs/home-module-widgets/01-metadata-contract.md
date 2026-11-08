# Home Module & Collection Widgets — Metadata Contract

> **Plan:** p-125 closed (۲۰۲۶-۰۹-۱۶). Canonical contract: this shard + [`02-decisions.md`](./02-decisions.md) · [`03-file-map.md`](./03-file-map.md).  
> **Phase:** HOMEW-0-1  
> **Status:** Design complete (implementation after PO «شروع کن»)  
> **Audience:** AI agents · implementers  
> **Created:** 2026-09-15

---

## Purpose

Register **Home dashboard widgets** from platform page-modules and package manifests so users add, hide, reorder, and resize them in the **same masonry grid** as legacy blocks (`kpi`, `insights`, …). Widget bodies are **summary + deep link** only — no embedded workspace.

---

## Layout widget id grammar

| Kind | Pattern | Example | Persistence |
|------|---------|---------|-------------|
| **Legacy platform** | `[a-z0-9-]+` fixed union | `kpi`, `my-inbox` | Unchanged forever (D2) |
| **Page module** | `module:<pageKey>` or `module:<pageKey>:<widgetId>` | `module:workflows:running-instances` | New |
| **Collection** | `collection:<crudSetId>` | `collection:tsk_tasks` | New (v1 registry only; see D6) |
| **Package** | `package:<packageId>:<componentKey>` | `package:general/eco-demo:eco-stats` | New |

**Rules:**

- `pageKey`, `widgetId`, `packageId`, `componentKey`, `crudSetId` — URL-safe slug chars `[a-zA-Z0-9._-]`; no `:` inside segments.
- Single-widget modules may omit suffix: layout id `module:users` when exactly one `homeWidgets[]` entry and `id` omitted or equals `default`.
- Unknown ids in stored layout: **drop on parse** only if not in registry **and** not legacy (log dev warning once); never crash render.

---

## TypeScript contracts (target paths)

| Export | Path |
|--------|------|
| `HomeWidgetCatalogMeta` | `src/shared/api/contracts/home-widgets/catalog.ts` |
| `HomeWidgetDefinition` | `src/shared/api/contracts/home-widgets/definition.ts` |
| `HomeWidgetDeepLink` | same |
| `PlatformPageModuleHomeWidget` | extend `PlatformPageModule` in `src/shared/api/contracts/platform/types.ts` |
| Zod | `src/shared/api/contracts/home-widgets/schema.ts` |

### `HomeWidgetDefinition` (manifest row)

```ts
type HomeWidgetSpanPreset = 'half' | 'full';

type HomeWidgetCatalogMeta = {
  labelKey: string;
  descriptionKey: string;
  icon: string; // Lucide export name, same as route binding nav
  tone: 'slate' | 'violet' | 'cyan' | 'indigo' | 'emerald' | 'amber' | 'rose';
};

type HomeWidgetDeepLink = {
  pageKey: string;
  query?: Record<string, string>;
  hash?: string;
};

type HomeWidgetDefinition = {
  id?: string; // suffix; default 'default' → layout id module:<pageKey> only when single widget
  enabled?: boolean; // default true
  componentRef: string; // core:Name · designer:… · package:<pkgId>/<export>
  span?: HomeWidgetSpanPreset; // maps to masonry span via registry
  defaultVisible?: boolean; // default false for module/package widgets (D7)
  catalog: HomeWidgetCatalogMeta;
  requiredRoles?: string[]; // must ⊆ page route auth / defaultRoles
  deepLink: HomeWidgetDeepLink;
  summarySpec?: never; // v1 — reserved v1.1 (D6)
};
```

### `PlatformPageModule` extension

```ts
homeWidgets?: HomeWidgetDefinition[];
```

**Validation (HOMEW-3):**

- `pageKey` on module must match enclosing record.
- Each `componentRef` must resolve at build/runtime registry check.
- `requiredRoles` empty → inherit `defaultRoles` of page-module.
- At most one widget with omitted `id` per module.

---

## Registry entry (runtime)

```ts
type HomeWidgetRegistryEntry = HomeWidgetDefinition & {
  layoutId: string; // resolved full id
  group: 'platform' | 'module' | 'collection' | 'package';
  sourcePageKey?: string;
  sourcePackageId?: string;
  defaultSpanUnits: number; // from span preset + optional registry override
};
```

**`buildHomeWidgetRegistry()`** (`src/features/dashboard/homeWidgetRegistry.ts`):

1. Legacy platform blocks from `PLATFORM_HOME_WIDGET_SEEDS` (migrated from `dashboardWidgetCatalog.ts`).
2. Enabled `page-modules` with `homeWidgets[]` (DB + defaults merge).
3. Enabled packages: each `ui_components[]` where `slotId === 'core.dashboard.widgets'` → auto entry; plus manifest root `homeWidgets[]` if present.
4. Collection entries: only explicit seeds in v1 (`COLLECTION_HOME_WIDGET_SEEDS` empty until post-v1).

Filter at read time: drop entries where user lacks `requiredRoles` or page-module/package disabled.

---

## Package manifest

Existing `ui_components`:

```json
{
  "componentKey": "eco-stats",
  "slotId": "core.dashboard.widgets",
  "entry": "ui/eco-stats.tsx"
}
```

Auto registry:

- `layoutId`: `package:<ownerPackageId>:<componentKey>` (ownerPackageId from install context, not zip folder name alone).
- Catalog labels: `homeWidget.<packageSlug>.<componentKey>.title` / `.description` unless `homeWidgets[]` overrides.

Optional root `homeWidgets[]` for widgets **without** a page-module (same shape as page-module rows; `deepLink.pageKey` required).

---

## Component resolution

| Prefix | Resolver |
|--------|----------|
| `core:` | `src/features/dashboard/homeWidgets/` + `src/app/platform/homeWidgetResolvers.ts` lazy map |
| `designer:` | Designer runtime export (same as page loader) — **v1: disallow on Home** unless PO exception |
| `package:` | Existing package UI runtime loader |

Render path: `ModuleHomeWidgetHost` → error boundary → `React.lazy(resolver)` → child uses `DashboardWidgetShell`.

---

## Deep links

- Primary CTA and row clicks use `deepLink` → `resolvePlatformRoute(pageKey)` + query/hash.
- Must match Access Assistant / route binding auth; widget must not link to pages user cannot open.

---

## Default dashboard order

`buildDefaultDashboardWidgetOrder` stays role-based for **legacy ids only**.

Module/package widgets appear on Home **only** when:

- User adds from catalog, **or**
- `defaultVisible: true` **and** registry entry applicable (role + enabled module).

Fresh install Home layout **unchanged** from today (D7).

---

## Culture keys

- English source: `src/core/culture/translations/` shard or feature `*En.ts`.
- Pattern: `homeWidget.<pageKeyOrSlug>.<widgetId>.title` · `.description`.
- Widget body copy: `homeWidget.<…>.empty` · `.error` as needed.

---

## API (widgets data)

**v1:** Each core widget calls existing feature APIs (same as list pages). Coalesce in widget with `useQuery` per widget.

**v1.1 (optional):** `GET /api/dashboard/widget-summaries?ids=…` batch — add only if >6 widgets typical on Home.

All list/count calls **must** respect Record Policy (no `bypassRecordPolicy` on summary APIs).

---

## Related standards (implementation)

- Shell: `DashboardWidgetShell` · density tokens in `dashboardDensity.ts`
- Reference widget: `DashboardInsights` (links only)
- Ops pattern: [`docs/standards/platform-ops-dashboards.md`](../../docs/standards/platform-ops-dashboards.md)
- Not Home canvas: [`docs/standards/personalizable-dashboard-canvas.md`](../../docs/standards/personalizable-dashboard-canvas.md)
- Package Phase 3: [`docs/standards/package-ui.md`](../../docs/standards/package-ui.md) — add Home widget row to readiness gate when HOMEW-4 lands

---

## Acceptance (metadata layer)

- [ ] Zod rejects invalid `homeWidgets[]` on page-module create/update API
- [ ] Registry contains all legacy catalog ids with same labels/icons as today
- [ ] Package slot component appears in catalog group Package when package enabled
- [ ] `parseDashboardLayout` retains unknown dynamic ids that pass `isDashboardWidgetId`
