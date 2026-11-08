# Data Studio

> **Shard:** `data-studio` · **Modeler chrome:** [`data-studio-modeler.md`](./data-studio-modeler.md) · **URL:** [`deep-linking.md`](./deep-linking.md)

REST semantics for published Data API routes. Do not duplicate visual rules here.

## Modeler deep link

Canonical URL is **`data-studio/edit/{objectName}`** (studio mount: `/studio/data-studio/edit/{objectName}`).

- Slug is the Edge model’s database `objectName`, not the model id.
- Literal `edit` segment is required (same nested-editor formula as Workflows / Server Functions).
- Helpers: `src/features/data-studio/dataStudioRoute.ts`.
- Shell header: `{nav group} / Data Studio / Edit` via `useDataStudioModelerShellHeader`; item identity (`objectName`) in the modeler content header (see `deep-linking.md`).
- Legacy `data-studio/{objectName}` redirects to the canonical edit URL.
- Visual/layout contract for the modeler workspace: [`data-studio-modeler.md`](./data-studio-modeler.md).

## Studio-meta identity

Studio-meta (Story, tags, column groups, `associationMeta`) is keyed by the **schema object** `(dataSourceId, objectType, objectName)`, not by ephemeral `edgeModelId`.

- Delete model, drop table, or Sync/import of the same table **reattaches** parked meta. Hard-delete studio-meta only on package uninstall or unreadable store records.
- Platform `base_*` Story catalog (`src/server/services/data-api/baseModelStudioStories.ts`) fills **empty** Story on import, refresh, and modeler load. Operator edits win and are not overwritten.
- Optional re-seed: `npm run control-plane:seed-studio-meta`.

## API route standard

- REST semantics: method = operation; path = resource. No verb segments.
- **Pivot exception:** published `kind: 'pivot'` is `POST {basePath}/pivot` with the layout in the body — dataset prep only on the operation. Shard: [`data-api-pivot.md`](./data-api-pivot.md).
- Read by PK: `GET /api/{collection}/:{pk}`.
- Writes: `POST /api/{collection}`, `PUT|PATCH|DELETE /api/{collection}/:{pk}`.
- Field projections: `?view=summary|detail|admin` or `?fields=`.
- Alternate key: `GET /api/{collection}?{field}={value}` first; `by-{field}` for stable lookups.
- Response envelope: `{ success: true, data, count?, meta?, source }`.
- **List COUNT (optional):** list operations accept `?includeCount=true|false`. When `false`, the executor uses `findAll` (page rows only) and omits top-level `count`; `meta.countMode` is `omitted`. Operation metadata may set `query.countMode` (`exact` | `none`) or `query.defaultIncludeCount` when the client omits the param (default remains exact count). Configure in Data Studio list **Query** tab. Platform default: Settings → Server Functions → **Data API list performance** (`dataApiListIncludeCountEnabled`). Env `APPENDO_DATA_API_LIST_INCLUDE_COUNT` overrides Settings when set.
- **List GET cache (opt-in default):** when a Data API function has cache disabled, Settings **Cache list GET responses by default** (or env `APPENDO_DATA_API_LIST_CACHE_DEFAULT=true`) enables GET response caching with TTL from Settings / `APPENDO_DATA_API_LIST_CACHE_TTL_MS` (default 60000) and query-aware keys. Per-function cache settings still win when already enabled.
- **Designer server grids:** published/runtime hydration binds `includeCount=static:page1Only` (exact COUNT on page 1 only; page 2+ sends `includeCount=false` and reuses hydrated `count` for paging). Seeds `gridQuery` before the first list fetch to avoid a param-less request plus refetch. Optional toolbar `serverQuery.listView` (e.g. `summary`) binds `view=static:summary` when the list operation defines `query.views`. Client `?includeCount=` wins over operation `query.countMode: none`.

## Filter DSL (v1)

- `filter[field][eq]=x`
- `filter[field][like]=x`
- `filter[field][in]=a,b`

## Live datasheet (no application)

Operators can edit table/view rows inside Data Studio without publishing a Data API: explorer **Data** and modeler **Data** open `EdgeModelDatasheetPanel`. The sheet is open for editing. Leaving a row writes that row (`POST /api/data-api/models/:id/datasheet/row`) or returns a field error and focuses the invalid cell. The toolbar is one editable SQL sentence (`SELECT` with named columns — never `*` — plus `TOP`/`LIMIT`, max 200) loaded via `POST .../datasheet/query`. Delete writes immediately (`POST .../datasheet/row/delete`).

## Platform API inventory

The modeler **APIs** section lists **operations** (method + path) from three sources, keyed by schema `objectName` (not ephemeral `edgeModelId`):

- **Data APIs** — enabled operations on `EdgeApiDefinition` rows for this model (including rematch when the model id changed but `objectName` is the same). Create / edit / publish here.
- **Built-in / managed functions** — `/api/functions/system` and custom functions whose path belongs to the object (longest prefix in `baseObjectPlatformApis.ts`) or whose DATA_API metadata `model.objectName` matches. Click opens the same Server Functions Settings form (`ConfigureFunctionApiDialog`); Access and Hooks open those forms; do not republish through `DataApiExecutor`.
- **Platform catalog** — fallback inventory of first-class Express routes with no matching function. Read-only; do not republish them through `DataApiExecutor`.

Tables with no HTTP surface stay empty. Operator-created Data APIs can still be added beside inventory rows.

## Platform parity

Published Data API routes use the managed function proxy (`engineType: DATA_API`) with the same access control, runtime, cache, and hooks contracts as Server Functions.

Reference: `plans/core/todo/p-73-edge-sequelize-data-api.md`.
