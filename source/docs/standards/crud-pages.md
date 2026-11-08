# CRUD pages and tree views

> **Shard:** `crud-pages`  
> **Grid/toolbar details:** [`ui-grid.md`](./ui-grid.md) · [`ui-toolbar.md`](./ui-toolbar.md)  
> **Gold list:** `UsersPageView.tsx` → `UserFilterToolbar.tsx` → `UserTableGrid.tsx`.

## Intent

CRUD lists copy the Users shell. Trees are a different widget — no paging.

**Users** is the gold list for **inline** toolbar filters (search, multi-select, person-type radios) **plus** **List Filter** at the end of the filters cluster — not either/or. Keep every ordinary filter; add `ListFilterToolbarControl` after the last one. Do not move List Filter next to Refresh or drop inline filters to “simplify” the toolbar.

## New DB-backed list interface (checklist)

When scaffolding a hand-written admin list (not Client Components), wire chrome in this order:

| Step | What | Reference |
|------|------|-----------|
| 1 | Shell: **`ListPageShell`** (toolbar collapse + grid scroll wiring) → optional `ListFilterSummaryBand` → grid host `flex-1 min-h-0`; toolbar row = **`ListPageToolbarFrame`** + filter/action clusters — **no** per-page `useListPageToolbarScroll` / `listToolbarCollapsed` | `UsersPageView.tsx` · [`ui-toolbar.md`](./ui-toolbar.md) · [`ui-grid.md`](./ui-grid.md) §Full-height |
| 2 | **Filters cluster (left):** search / selects / checkboxes the product needs — keep all of them | `UserFilterToolbar.tsx` |
| 3 | **List Filter (left, last):** `ListFilterToolbarControl` with `separatorBefore` when any inline filter precedes it | [`ui-toolbar.md`](./ui-toolbar.md) §List Filter |
| 4 | **Actions cluster (right):** Create (if any) → other actions → `ToolbarRefreshButton` **rightmost** | `UserFilterToolbar.tsx` |
| 5 | **Hook:** `useListFilter` + persist `where` tree (`usePersistedListFilters` or page filter state); `serializeListWhereTree` on list `GET` when active | `useUsersPage.tsx` · `useLogsPage.tsx` |
| 6 | **Server:** parse `where` query param; map fields via shared column map + `listWhereIrToPrisma` / edge equivalent | `usersListWhere.ts` · `userRepository.ts` |
| 7 | **Dialog:** `ListFilterDialog` at page root (sibling of grid), not inside the toolbar | `UsersPageView.tsx` |

Logs / Record Events add data-source toggles (e.g. Include archived) **before** List Filter in the filters cluster — not in the where tree. Designer grids and **CRUD Set** use the same placement (`filterBar.listWhereFilter` default on in `CrudSetSpec`).

Do not stack many predicate controls in header 1 when nested AND/OR is enough — use List Filter instead of a fourth toolbar select. Do not omit List Filter on new DB lists that already expose a `where` API unless the feature spec explicitly disables it.

## CRUD list coverage
- Toolbar: filters + Create button.
- Grid: actions column with Edit.
- Full-height shell and vertical rhythm must match the existing Users list: `UsersPageView.tsx` → `UserFilterToolbar.tsx` → `UserTableGrid.tsx`.
- Toolbar controls are centered `h-8` controls inside the shared `lg:h-14` toolbar; the grid header starts immediately below its bottom border with no spacer.
- Generated/scaffolded pages must use shared toolbar/grid tokens and preserve the full flex chain; do not recreate the reference with feature CSS overrides.
- Paging and Infinite Scroll modes (user-switchable).
- Create/Edit open in-app modals by default. Complex deep-linked editors are the exception:
  use the Data Studio Column Properties composition (sectioned white main + neutral read-only
  rail + separate actions). If create-time identity selects the editor, collect and persist it
  in a dialog before navigating to `{list}/edit/{id}`; lock editor-discriminating format/kind.
- Footer: `GridPagingFooter` with range, page-size dropdown, sort field, direction toggle, paging controls.
- Default page size `50`; options from `gridPagingConstants.ts`.
- Label-style dropdown triggers; no native `<select>` in footer.
- Sort direction: icon toggle; list mode: icon + combo in footer.

## Tree pages
- Tree or grid+tree hybrid; no pagination/infinite scroll.
- Root nodes on initial load; children lazy on expand.
- Expand All / Collapse All in toolbar.
- Depth-0 labels heavier (`font-semibold`).
- Footer: summary stats only (root count, visible count).

**IDs:** `ui.crud.*`, `ui.tree.*`, `ui.list.footer.sort`.
