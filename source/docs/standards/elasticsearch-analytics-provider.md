# Elasticsearch Analytics Provider (read-only)

> **Shard:** `elasticsearch-analytics-provider` · **Extends:** [`data-api-pivot.md`](./data-api-pivot.md) (`source.kind: 'elasticsearch-aggregation'`)
> **Plan:** [`plans/core/todo/dashboard-canvas/p-111-elasticsearch-analytics-provider.md`](../../plans/core/todo/dashboard-canvas/p-111-elasticsearch-analytics-provider.md)

Locked 2026-09-10. Implemented 2026-09-11.

## Intent

Elasticsearch's Aggregations framework (`terms`, `date_histogram`, `sum`/`avg`/`cardinality`/etc. metric aggregations) is purpose-built for exactly the rollup shape `PivotSpec` describes — arguably the best-fitting NoSQL engine surveyed for this. Reintroduce it as a fifth Pivot API provider, read-only, same scope discipline as the MongoDB shard.

**Licensing note (settled 2026-09-10):** Elasticsearch server's license (AGPLv3/ELv2/SSPL, triple-licensed since August 2024) is the customer's own concern — they run their own cluster under whichever license they chose; AppEndO only connects as a client. The official Node client `@elastic/elasticsearch` is Apache-2.0 and unaffected by the server relicensing history. No licensing blocker for this shard.

```
PivotSpec (rows/columns/measures/filters)
  → resolve each field against the dataset's declared field whitelist
  → compile to an Elasticsearch aggregation query (terms/date_histogram buckets + metric sub-aggregations)
  → run via @elastic/elasticsearch client
  → map aggregation buckets → PivotResult
```

## MUST

- Add `DataSourceType.ELASTICSEARCH_ANALYTICS` — same scope-signaling naming convention as `MONGODB_ANALYTICS`.
- Use the official `@elastic/elasticsearch` client (Apache-2.0) — the only new dependency for this shard.
- Require an explicit field whitelist per dataset (index + allowed field paths + type), same rule as the MongoDB shard — Elasticsearch mappings can be introspected (`GET {index}/_mapping`) but that is a one-time authoring convenience, never the enforced source of truth at query time.
- Compile every request to a **single aggregation query** — never scroll/fetch raw documents into Node to aggregate client-side.
- Apply Record Policy as an additional `bool`/`filter` clause before aggregation, same ordering rule as every other provider.
- Return the same `PivotResult` shape as every other provider.
- Store the Elasticsearch connection URL/API key/credentials in the **same encrypted secret field** `DataSourceRecord` already uses for the five existing RDBMS types — do not invent a second credential-storage path.
- Cap result size (`size: 0` on the query, only aggregation buckets returned — never raw hits) and set a request timeout, matching PIVOT-2's cell/cardinality cap on the flat-sql provider.

## NEVER

- Wire this provider into CRUD-Gen, Edge Model import, or any write path — read-only, full stop.
- Let a client-supplied field bypass the whitelist to reach an arbitrary mapped field.
- Treat Elasticsearch's own SQL/ES|QL surface as a shortcut that skips the aggregation-DSL compiler — keep one compilation path per provider, matching the other shards.

## Tokens / files (when implemented)

- Compiler: `src/server/domain/data-api/elasticsearchAggregationCompiler.ts`.
- Driver: `@elastic/elasticsearch` in `package.json`; connection handling in `src/core/database/`, separate from the SQL path.
- `DataSourceType.ELASTICSEARCH_ANALYTICS`: `src/shared/api/contracts/data-sources/types.ts`.

## Kibana-parity scope — decided 2026-09-10

This provider (plus `p-108`'s dashboard canvas) covers Kibana's Dashboard/Visualize/Lens layer for aggregated charts — and, unlike Kibana, can mix Elasticsearch data with any other provider on one dashboard. It deliberately does **not** chase the rest of Kibana:

| Kibana capability | Decision | Why |
|---|---|---|
| Threshold alerting | ✅ built, see [`pivot-threshold-alerts.md`](./pivot-threshold-alerts.md) | Cheap — reuses Workflow Engine's existing scheduler + existing notification service |
| Discover (free-text raw document search/exploration) | ⏸ parked, not committed | Needs a genuinely new, separate request/response contract (a document list with highlighting/paging, not a `PivotSpec`/`PivotResult` matrix) — real enough scope to deserve its own future decision, not folded in here. Only meaningful for document-shaped providers (Elasticsearch, MongoDB), which would make the capability inconsistent across providers — a real tension with this whole design's "one contract, N providers" principle. Revisit only if a concrete need shows up. |
| Raw ES query console (mirrors SQL Console) | ⏸ backlog, optional | Cheap to add later (same UI pattern as `SqlConsolePage.tsx`), but not required for v1 — no ticket cut yet |
| Anomaly Detection / ML jobs | ❌ rejected | Real ML anomaly detection is itself a **paid** Elastic feature (Platinum tier) — chasing it means matching a competitor's paid tier, not their free one. A thin statistical substitute (moving average + stddev bands) is conceivable later but not planned. |
| APM / Tracing | ❌ rejected | A different product category entirely (application instrumentation, trace storage, waterfall/service-map UI) — not a natural extension of a dashboard/data-source feature; would mean AppEndO becoming an APM vendor. |
| SIEM / Security analytics | ❌ rejected | Same reasoning as APM — a specialized security product (detection rules, threat intel, case management), unrelated to AppEndO's own product identity. |
| Cluster/index management (ILM, Stack Monitoring, Dev Tools admin) | ❌ rejected | Infra-ops tooling for the customer's Elasticsearch cluster itself, not data visualization — AppEndO doesn't do this for SQL Server or Postgres either; doing it only for Elasticsearch would be an inconsistent, one-off scope choice. |

Broader risk this table exists to guard against: chasing full Kibana parity is chasing a moving target maintained by a much larger team, dilutes AppEndO's own product identity (an app/data platform, not an observability/security suite), and — because ES-specific features like Discover/ILM don't exist for the other four providers — would break the provider-agnostic uniformity the whole Pivot API design was built to preserve.

## IDs

`elasticsearch-analytics.read-only-scope`, `elasticsearch-analytics.explicit-field-whitelist`, `elasticsearch-analytics.single-aggregation-query`, `elasticsearch-analytics.no-crud-gen`, `elasticsearch-analytics.client-license-only`
