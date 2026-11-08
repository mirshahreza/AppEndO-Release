# MongoDB Analytics Provider (read-only)

> **Shard:** `mongodb-analytics-provider` · **Extends:** [`data-api-pivot.md`](./data-api-pivot.md) (`source.kind: 'mongo-aggregation'`)
> **Plan:** [`plans/core/todo/dashboard-canvas/p-110-mongodb-analytics-provider.md`](../../plans/core/todo/dashboard-canvas/p-110-mongodb-analytics-provider.md)
> **History:** MongoDB (and Redis) were removed platform-wide 2026-09-03/04 because the platform claimed full support (`DataSourceType`, CRUD-Gen, schema discovery) while in practice only raw query execution worked — a gap between claim and reality. This shard reintroduces MongoDB **narrowly and explicitly**: read/aggregate only, behind the Pivot API, never wired into CRUD-Gen or Edge Model. Do not widen this scope without a fresh, explicit decision.

Locked 2026-09-10. Implemented 2026-09-11.

## Intent

MongoDB's native Aggregation Pipeline (`$match`/`$group`/`$lookup`/`$project`) is architecturally well-suited to the exact rollup shape `PivotSpec` already describes — this is the one thing that genuinely worked before the 2026-09 removal. Reintroduce it as a fourth Pivot API provider, nothing more: no Edge Model import, no CRUD-Gen, no Data Studio schema-discovery UI for Mongo collections.

```
PivotSpec (rows/columns/measures/filters)
  → resolve each field against the dataset's declared field whitelist (no schema to introspect — Mongo is schemaless)
  → compile to a Mongo aggregation pipeline ($match, $group, $project)
  → run against the official `mongodb` driver
  → map result documents → PivotResult
```

## MUST

- Add a new `DataSourceType.MONGODB_ANALYTICS` — the name itself signals scope; never reuse the plain "MongoDB" label the platform removed, and never let this type appear anywhere CRUD-Gen/Edge Model configuration is offered.
- Reinstate the official `mongodb` npm driver (Apache-2.0 — corrected 2026-09-10; earlier notes in this initiative said MIT, verified against the npm registry to be Apache-2.0) as the only new dependency for this shard.
- Require an explicit **field whitelist** per dataset (collection + allowed field paths + type) declared by the developer at publish time — never auto-introspect a collection's shape from sampled documents as the source of truth. This mirrors `personalizable-dashboard-canvas.md`'s domain-whitelist requirement exactly, and is the direct fix for why the old integration silently broke: nothing here pretends to know Mongo's schema.
- Compile every request to a **single aggregation pipeline** run in MongoDB itself — never fetch raw documents into Node and aggregate in JavaScript.
- Apply Record Policy (if any) as an additional `$match` stage before `$group`, same ordering rule as the SQL providers.
- Return the same `PivotResult` shape as every other provider.
- Store the Mongo connection string/credentials in the **same encrypted secret field** `DataSourceRecord` already uses for the five existing RDBMS types — do not invent a second credential-storage path for this one type.
- Cap result size (`$limit` stage) and enforce a query timeout (`maxTimeMS`) on every pipeline, matching PIVOT-2's cell/cardinality cap on the flat-sql provider.

## NEVER

- Wire `MONGODB_ANALYTICS` into CRUD-Gen, Edge Model import, or any write path — this shard is read-only, full stop.
- Auto-generate the field whitelist from live document sampling as the system of record (a one-time "suggest fields from a sample" convenience in the authoring UI is fine; the *declared* whitelist is still what's enforced).
- Let a client-supplied field bypass the whitelist to reach an arbitrary document path.
- Reintroduce Redis in this shard — Redis was removed for a different reason (not an aggregation-capable store) and stays out; Redis-as-cache is a separate, already-existing, unrelated feature.

## Tokens / files (when implemented)

- Compiler: `src/server/domain/data-api/mongoAggregationCompiler.ts`.
- Driver reinstatement: `mongodb` back in `package.json`; connection handling in `src/core/database/` alongside (not merged into) `EdgeDbRouter.ts`'s SQL path.
- `DataSourceType.MONGODB_ANALYTICS`: `src/shared/api/contracts/data-sources/types.ts`.

## IDs

`mongodb-analytics.read-only-scope`, `mongodb-analytics.explicit-field-whitelist`, `mongodb-analytics.single-pipeline`, `mongodb-analytics.no-crud-gen`
