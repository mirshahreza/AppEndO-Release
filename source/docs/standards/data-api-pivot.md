# Data API Pivot

> **Shard:** `data-api-pivot` · **REST list/CRUD:** [`data-studio.md`](./data-studio.md) · **Record Policy:** [`record-policy.md`](./record-policy.md)  
> **Plan:** [`plans/core/todo/dashboard-canvas/p-93-data-api-pivot.md`](../../plans/core/todo/dashboard-canvas/p-93-data-api-pivot.md)

Locked 2026-08-18. Implemented 2026-09-11.

## Intent

Pivot is **not** a saved layout on the server. A published Pivot API on an Edge model (TABLE / VIEW) prepares a **dataset**. The client sends the pivot layout on every request. A generic server utility turns that dataset + request config into a matrix.

Grid and chart are separate later views of the same `PivotResult`. They are not one third-party widget.

```
Edge model (table/view)
  → published Pivot API: dataset prep (columns, row filter, ID titles) + ACL
  → client request: rows / columns / measures / aggregation
  → generic pivot utility
  → PivotResult  →  (later) PivotGrid | PivotChart (existing UiChart / ECharts)
```

This document defines the `flat-sql` provider (the original, v1 engine); four more server-side providers now share the same contract — see the **Providers** table below, which is the current, authoritative list (superseding any earlier "not v1" framing — `star-schema`, `olap-bridge`, `mongo-aggregation`, and `elasticsearch-aggregation` are all real, committed shards now, not hypotheticals). A **client-side** execution mode (fetch allowed raw rows, pivot in-browser via DuckDB-WASM) remains genuinely unscoped — see Later.

`source.kind` on the request names which provider/compiler runs, so adding a provider never changes the `PivotSpec`/`PivotResult` contract itself.

## Providers (all behind this one contract)

Every provider below accepts the same `PivotSpec` and returns the same `PivotResult` — a widget never branches on which one it's talking to. `source.kind` names which compiler runs.

| `source.kind` | Backing engine | Shard |
|---|---|---|
| `flat-sql` | Single Edge model (table/view) via `EdgeDbRouter` — **this shard, v1** | (this document) |
| `star-schema` | Multi-table star schema over existing Edge model associations, via Sequelize | [`rolap-star-schema.md`](./rolap-star-schema.md) |
| `olap-bridge` | Real external Microsoft SSAS (MDX/DAX) via an optional external bridge service | [`olap-bridge.md`](./olap-bridge.md) |
| `mongo-aggregation` | MongoDB Aggregation Pipeline, read-only | [`mongodb-analytics-provider.md`](./mongodb-analytics-provider.md) |
| `elasticsearch-aggregation` | Elasticsearch Aggregations framework, read-only | [`elasticsearch-analytics-provider.md`](./elasticsearch-analytics-provider.md) |

Every provider enforces the **same class of result-size cap and query timeout** described under PIVOT-2 (`meta` cardinality caps) — each provider's own shard states its concrete cap (row limit, `LIMIT`/`$limit`/`size:0`, timeout) but the *principle* — bounded response, no unbounded scan — is set once here, not re-derived per provider.

## Result caching (added 2026-09-10, benchmarked against Cube's pre-aggregations)

Cube's signature performance feature is "pre-aggregations" — background-refreshed rollup tables the query planner automatically routes matching requests to, absorbing repeated dashboard queries before they hit the warehouse. A full rollup/aggregate-awareness engine is real, separate scope (see `personalizable-dashboard-canvas.md`'s Later section) — but the cheap 80%-of-the-value version is in scope for every provider here:

- **MUST** cache a `PivotResult` keyed by `(dataSourceId, normalized PivotSpec hash)` for a configurable TTL (a sane default, e.g. 60s, overridable per Data Source) — this is a plain response cache, not a rollup engine; it does not need to understand which fields are measures/dimensions.
- **MUST** invalidate or bypass the cache when `bypassRecordPolicy`-equivalent request options are set, or when a caller explicitly requests fresh data (a `noCache` flag) — mirrors the existing `pollingIntervalMs` auto-refresh concept already used elsewhere in the platform's `DataSourceDefinition`.
- **NEVER** cache across different callers' Record Policy contexts — the cache key must include whatever identity/role scoping Record Policy applies, or caching would leak row-filtered data across users.

## MUST

- Bind pivot to an **Edge model** (TABLE or VIEW). Do not accept a free table name, raw SQL, or a procedure (`routine` stays the procedure/function kind).
- **Publish** pivot like other Data APIs: `kind: 'pivot'`, access control, cache, hooks, Record Policy. Wizard option **Pivot** for TABLE/VIEW only.
- Server definition stores **dataset prep only**:
  - columns in the dataset (`fields.read`)
  - row filter (`defaultWhere`; request filters if `query.allowFilter`)
  - ID → title via existing `enrichments` / attached fields
- Client sends **PivotSpec** in the POST body every time. Do not persist rows / columns / measures / aggregation on the operation.
- Request `field` values must be columns (or enrichment outputs) from that prepared dataset.
- Apply Record Policy on the **raw rows before aggregation**, same as list (unless `bypassRecordPolicy`).
- Execute over a **query** (projection + where + title joins), not by materializing the full row set in Node.
- Return **`PivotResult`** (axes + cells), not a flat list of fact rows.
- Envelope matches Data API: `{ success, data, meta, source }`. `meta` includes cell/cardinality caps.
- Keep `field` names independent of SQL so a later cube can map them to dimension/hierarchy.
- On PostgreSQL/SQL Server/Oracle sources, allow a `field` to resolve to a **JSON-column extraction expression** (`jsonb_path_query`/`->`/`->>` on Postgres, `JSON_VALUE`/`OPENJSON` on SQL Server, `JSON_VALUE`/`JSON_TABLE` on Oracle) declared once on the dataset (`fields.read`), never composed ad hoc from a client-supplied JSON path — added 2026-09-10, extends every flat-sql/star-schema provider, not a new provider (see IDs below).

## NEVER

- Store pivot layout (which fields are rows/columns/values) in `EdgeApiDefinition` / operation JSON.
- Expose a platform utility HTTP that takes an arbitrary table name and bypasses Edge model ACL.
- Treat FortuneSheet, Perspective Viewer, Flexmonster, WebDataRocks, or `react-pivottable` as the product pivot control.
- Pull 200k fact rows into the Node process to pivot in JavaScript.
- Use GET + query-string for the spec (it is a document → **POST**).
- Add a cube provider, client engine, PivotGrid, or a second chart library in v1.
- Invent a second pivot contract for client vs server.

## HTTP

`POST {basePath}/pivot` — read with a body. `POST {basePath}` remains create.

This is an explicit exception to [`data-studio.md`](./data-studio.md) “no verb segments”: pivot is a derived resource, not a CRUD verb on the collection. Default `pathPattern` is `{basePath}/pivot`; the operator may compose another path.

## Request (`PivotSpec`) — client, every call

```ts
{
  rows: [{ field: string }]
  columns: [{ field: string }]
  measures: [{
    field: string
    aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'countDistinct'
  }]
  filters?: /* same filter DSL as list */
  totals?: { rows?: boolean, columns?: boolean }
}
```

## Dataset (published operation)

Reuse list machinery. Do not add a parallel “pivot layout” object.

| Prep | Where it lives |
|------|----------------|
| Columns in the pivot dataset | `operation.fields.read` |
| Exclude rows | `definition.defaultWhere` + optional request `filters` |
| ID columns need titles | `operation.enrichments` (`base_info_title` / `join_lookup` / attached fields) |
| Who may call | `accessControl` on the definition (same as other Data APIs) |

## Response (`PivotResult`)

```ts
{
  rowAxis: { fields: string[], members: Array<{ key: string, labels: unknown[] }> }
  colAxis: { fields: string[], members: Array<{ key: string, labels: unknown[] }> }
  measures: Array<{ field: string, aggregation: string }>
  cells: Array<{ rowKey: string, colKey: string, values: number[] }>
}
```

Grid and chart both consume this object. Do not fork a chart-specific payload in v1.

## Utility

Domain function, not HTTP:

`pivotFlatDataset(datasetQuery, spec) → PivotResult`

The published `kind: 'pivot'` operation builds the dataset query from the Edge model + prep, then calls this utility. Other callers (tests, later client-prep pipelines) may use the same function. The utility must not know about wizard UI.

## Later (not this shard's v1 build)

- **Client-side:** fetch allowed raw rows, run DuckDB-WASM against the same `PivotSpec`, emit the same `PivotResult`.
- **UI:** thin PivotGrid over `PivotResult` (TanStack Virtual + existing table chrome) + map to existing `UiChart` / ECharts. Field list edits request spec; it is not stored on the API definition.

The "cube provider" idea this section used to describe as a hypothetical has since graduated into four real, committed shards (see the Providers table above) — `star-schema`, `olap-bridge`, `mongo-aggregation`, `elasticsearch-aggregation`. Do not re-describe them here; this section is only for what is still genuinely unscoped (client-side DuckDB-WASM, PivotGrid UI).

## Tokens / files (when implemented)

- Contract: `src/shared/api/contracts/data-api/` (`kind: 'pivot'`, PivotSpec / PivotResult)
- Utility: `src/server/domain/` (pure) · orchestration `src/server/services/data-api/`
- Execute: `DataApiExecutor` + `EdgeDbRouter` / Sequelize
- Wizard: `DATA_API_WIZARD_METHOD_OPTIONS` Pivot · TABLE/VIEW

## JSON/document field extraction (RDBMS, not a new provider)

PostgreSQL, SQL Server, and Oracle each have mature native JSON querying (`JSONB`/`OPENJSON`/`JSON_TABLE`) over an ordinary relational connection — no new driver, no new `DataSourceType`, no new provider. A dataset's `fields.read` may declare a field as a JSON-path extraction from an existing JSON/JSONB column; the compiler emits the provider-specific SQL function. This is the one case where "document store" capability is in scope for the flat-sql/star-schema providers directly, since it costs nothing beyond a richer field-expression grammar. Genuinely schemaless document/search engines (MongoDB, Elasticsearch) are separate providers — see [`mongodb-analytics-provider.md`](./mongodb-analytics-provider.md), [`elasticsearch-analytics-provider.md`](./elasticsearch-analytics-provider.md).

Rejected for this reason (2026-09-10): Cassandra, DynamoDB — neither supports ad hoc `GROUP BY`-style aggregation natively (Cassandra's CQL has no arbitrary joins/grouping; DynamoDB has no native aggregation at all, and AWS's own guidance is to export to Athena/Redshift for analytics). Building a provider for either would repeat the exact mistake that got MongoDB/Redis removed platform-wide 2026-09-03/04 — claiming a connector that cannot actually do the thing a dashboard needs it for. Do not revisit without a fundamentally different underlying engine (e.g. a Spark/Athena layer already sitting in front of them, at which point that layer — not Cassandra/DynamoDB directly — would be the provider's actual target).

## IDs

`data-api.pivot.dataset-not-layout`, `data-api.pivot.published-api`, `data-api.pivot.request-spec`, `data-api.pivot.result-matrix`, `data-api.pivot.utility`, `data-api.pivot.no-third-party-widget`, `data-api.pivot.json-field-extraction`, `data-api.pivot.no-aggregation-incapable-nosql`, `data-api.pivot.result-cache-keyed-by-policy-context`, `data-api.pivot.no-full-rollup-engine-v1`
