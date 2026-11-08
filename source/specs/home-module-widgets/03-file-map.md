# Home Module Widgets — File Map

> **Plan:** p-125 closed (۲۰۲۶-۰۹-۱۶). Engineering map: this shard.  
> **Phase:** HOMEW-0 / HOMEW-1 engineering map  
> **Status:** Target layout for implementation  
> **Created:** 2026-09-15

---

## 1. Shared contracts

| Module | Path |
|--------|------|
| Widget id helpers | `src/shared/api/contracts/home-widgets/id.ts` — `isDashboardWidgetId`, parse prefix |
| Definitions + Zod | `src/shared/api/contracts/home-widgets/schema.ts` |
| Platform type extend | `src/shared/api/contracts/platform/types.ts` — `homeWidgets?` on `PlatformPageModule` |

---

## 2. Layout persistence (critical)

| File | Change |
|------|--------|
| `src/shared/lib/userDashboardLayout.ts` | Replace `DashboardLayoutBlockId`-only order/sizes/chrome keys with `DashboardWidgetId`; keep legacy union as subset; **`parseDashboardLayout` must not strip dynamic ids** |
| `src/shared/lib/__tests__/userDashboardLayout.test.ts` | Round-trip `module:users`, invalid id drop rules |
| `src/contexts/DashboardLayoutContext.tsx` | Types only if needed |
| `src/features/dashboard/dashboardLayout.ts` | `buildDefaultDashboardWidgetOrder` unchanged ids |

---

## 3. Registry & catalog

| File | Role |
|------|------|
| `src/features/dashboard/homeWidgetRegistry.ts` | `buildHomeWidgetRegistry`, `getHomeWidgetEntry`, platform seeds |
| `src/features/dashboard/platformHomeWidgetSeeds.ts` | Legacy metadata moved from catalog |
| `src/features/dashboard/dashboardWidgetCatalog.ts` | Becomes thin wrapper / deprecated export → registry |
| `src/features/dashboard/dashboardWidgetLayoutSpan.ts` | Extend span map for dynamic ids via registry default |

---

## 4. Render pipeline

| File | Role |
|------|------|
| `src/features/dashboard/components/DashboardWorkspace.tsx` | Replace `switch(blockId)` with `resolveHomeWidgetContent(layoutId)` |
| `src/features/dashboard/components/ModuleHomeWidgetHost.tsx` | Lazy + boundary + shell wrapper |
| `src/features/dashboard/components/DashboardSortableWidget.tsx` | Accept `DashboardWidgetId` |
| `src/features/dashboard/components/DashboardWidgetCatalog.tsx` | Grouped catalog UI |
| `src/app/platform/homeWidgetResolvers.ts` | `core:*` lazy imports |
| `src/features/dashboard/homeWidgets/*.tsx` | One file per core widget |

**Remove / stop using for Home:** separate package widget strip (if any dead path after HOMEW-5).

---

## 5. Platform registry & server

| File | Role |
|------|------|
| `src/config/platform-registry/page-modules/*.json` | Add `homeWidgets[]` seeds (HOMEW-3) |
| `src/server/services/platform/*pageModule*` | Validate `homeWidgets` on CRUD |
| `src/server/services/package-runtime/packageUiRuntime.service.ts` | Expose catalog metadata for enabled package widgets (if not client-only merge) |

---

## 6. Package install

| File | Role |
|------|------|
| `src/core/packages/*Manifest*` | Validate optional `homeWidgets[]` |
| `src/server/services/packages.service.ts` | Already knows `core.dashboard.widgets` |

---

## 7. Culture

| File | Role |
|------|------|
| `src/core/culture/translations/*En.ts` or new `homeWidgetsEn.ts` | All `homeWidget.*` keys |
| Culture packs | Generated/synced per existing pipeline |

---

## 8. Standards & index

| File | When |
|------|------|
| `docs/standards/home-widgets.md` | HOMEW-4 |
| `docs/standards/INDEX.md` | Link shard |
| `src/config/projectStandards.ts` | One-liner id `home-widgets` |
| `docs/standards/package-ui.md` | Add checklist row: Home widget culture + dashboard smoke |

---

## 9. Tests

| Path | Covers |
|------|--------|
| `src/features/dashboard/__tests__/homeWidgetRegistry.test.ts` | Merge, RBAC filter, package enable |
| `src/features/dashboard/__tests__/dashboardLayoutDynamicIds.test.ts` | Parse persistence |
| `src/features/dashboard/homeWidgets/__tests__/*` | 2–3 widget smoke render |
| Package exit tests | Slot widget in unified order (extend existing dashboard shell test if present) |

---

## 10. Plans / packages touch

| File | Change |
|------|--------|
| `plans/packages/todo/tsk-package/p-packages-task-management.md` | tsk Home widget (Phase 3) — uses core HOMEW registry |
