# OLAP Bridge (Microsoft SSAS)

> **Shard:** `olap-bridge` · **Pivot contract this extends:** [`data-api-pivot.md`](./data-api-pivot.md)
> **Plan:** [`plans/core/todo/dashboard-canvas/p-107-olap-bridge-data-source.md`](../../plans/core/todo/dashboard-canvas/p-107-olap-bridge-data-source.md)

Locked 2026-09-09. Implemented 2026-09-11. Depends on `data-api-pivot.md` PIVOT-1 (server executor) existing first — this shard is the **second provider** behind the same `PivotSpec`/`PivotResult` contract, exactly the slot that document already reserved ("Cube provider: same published API; compile `PivotSpec` to MDX instead of SQL").

## Why this exists

Microsoft SQL Server Analysis Services (SSAS) — both classic Multidimensional (MDX) cubes and Tabular (DAX) models — has no query protocol reachable from a plain Node.js process. On-premises SSAS is XMLA/SOAP-only at every SQL Server version up to and including 2025; there is no REST query endpoint for on-prem or Azure Analysis Services. The only Microsoft-sanctioned client libraries (AMO, ADOMD.NET) are .NET, and Analysis Services' TCP connectivity is Windows-only per Microsoft's own client-library documentation. No free/OSS Node/JS XMLA client exists that is both maintained and safely licensed (the one active candidate, `@metad/ocap-xmla`, is AGPL-3.0 and unproven against real SSAS).

Researched and rejected as alternatives (do not re-litigate without new evidence):
- **Eclipse Daanse**: an OLAP *server* (Mondrian/ROLAP successor) that computes and serves its own cubes over XMLA. It lets BI clients (Excel, Power BI, Tableau) query *it* as if it were SSAS; it has no capability to read data *out of* an existing, real SSAS instance. Wrong data-flow direction for this requirement.
- **Dundas BI / Logi Symphony**: fully commercial (thousands of USD/month, no free tier), and — even though the rest of the product runs on Linux — its own system-requirements page states the SSAS/Analysis Services connector is explicitly **"Not supported on Linux."** Adopting it would add a paid license on top of the same Windows-hosting requirement, not instead of it.

The only workable path is the pattern Microsoft itself publishes as a sample ([`microsoft/azure-analysis-services-http-sample`](https://github.com/microsoft/azure-analysis-services-http-sample)): a small, separately-deployed Windows-hosted **bridge service** wrapping AMO/ADOMD.NET, exposing a plain HTTPS/JSON contract to the rest of the platform. AppEndO does not run on Windows and does not gain a Windows dependency by defining this contract — the bridge is an optional, separately-operated component. A deployment with no bridge configured simply has no working OLAP Data Source, exactly like any other unconfigured/unreachable Data Source — there is no OS-detection or feature-flag logic inside AppEndO itself.

## MUST

- Treat the bridge as an **external, optionally-deployed service** reachable only over HTTP(S) — never a dependency of the Node process, never bundled into any package's install artifact.
- Compile `PivotSpec` (rows/columns/measures/filters, the exact contract from `data-api-pivot.md`) to **MDX** (Multidimensional catalogs) or **DAX** (Tabular catalogs) and return the result as the same **`PivotResult`** shape list/pivot already produces. Widgets/charts/tables never see a cube-specific payload shape.
- Keep `PivotSpec.field` values opaque, platform-agnostic names (already required by `data-api-pivot.md`) that this provider resolves to a dimension+hierarchy+level or a measure name via the metadata discovery endpoint — never SQL column names.
- Authenticate AppEndO → Bridge with a per-Data-Source shared secret (`X-Bridge-Api-Key` header). Authentication Bridge → SSAS (Windows/Kerberos, service account, `EffectiveUserName` impersonation) is entirely the bridge's own concern and out of scope for AppEndO's code.
- Treat an unreachable/misconfigured bridge exactly like any other failed Data Source connection test — same error surface, same retry/backoff, no special-cased "OLAP disabled" branch.
- Ship a **reference bridge implementation** (ASP.NET Core, .NET 8, MIT license) as an optional, separately-versioned artifact (its own repo folder, its own release/build pipeline) that operators who need on-prem SSAS build and run themselves. AppEndO's own CI/install pipeline never builds or requires .NET.
- Confirm empirically, before shipping OLAP-3 (widget integration), whether DAX queries can pass through the same XMLA `Execute` operation as MDX against a real Tabular instance (protocol theory says yes; no third-party JS library has confirmed this in practice) — do not assume it silently.
- Store `bridgeApiKey` in the **same encrypted secret field/mechanism** the existing `DataSourceRecord` already uses for `password` — do not add a second, differently-secured credential store for this one Data Source type.
- Cap result size and enforce a query timeout on every bridge call, matching PIVOT-2's cell/cardinality cap on the flat-sql provider — a slow or huge cube response must fail the same bounded way a slow SQL query already does, not hang the request indefinitely.

## NEVER

- Add an ADOMD.NET/AMO/.NET dependency, process, or build step to the main AppEndO Node application or to any Package Manager–installable package.
- Gate the OLAP Data Source type on the host OS of the AppEndO process itself — the constraint lives on the bridge's host, not on AppEndO's.
- Invent a parallel widget-binding shape for OLAP-sourced charts/tables. They consume `PivotResult` exactly like the flat-SQL provider.
- Store MDX/DAX statements, cube names, or dimension/measure selections as raw strings inside `dbb_widgets.viz_config` — persist only the `PivotSpec` plus a reference to which Data Source (and therefore which provider/catalog) it targets, matching `data-api-pivot.md`'s "dataset not layout" rule.
- Adopt Eclipse Daanse as an SSAS proxy, or Dundas/Logi Symphony as a dependency, for this capability (see rejected-alternatives above).
- Assume the Fabric/Power BI Premium "Execute Queries"/"Execute DAX Queries" REST APIs cover on-premises SSAS — they explicitly do not; on-prem and Azure AS models proxied from on-prem are unsupported by those APIs. (A Fabric-hosted semantic model connector was considered as a bridge-free third `DataSourceType` and dropped from scope 2026-09-09 — the operator's data is on-prem only; re-add later behind the same Pivot API if it ever becomes relevant.)

## Bridge HTTP contract (external service, implemented by the reference bridge or any compatible replacement)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{ status: 'ok', version, supportedLanguages: ('MDX'\|'DAX')[] }` |
| `GET` | `/catalogs` | List catalogs/databases the bridge's configured SSAS connection exposes |
| `GET` | `/catalogs/:catalog/cubes` | List cubes/models in a catalog (Discover `MDSCHEMA_CUBES`) |
| `GET` | `/catalogs/:catalog/cubes/:cube/metadata` | Dimensions, hierarchies, levels, measures for one cube (Discover `MDSCHEMA_DIMENSIONS`/`MDSCHEMA_HIERARCHIES`/`MDSCHEMA_LEVELS`/`MDSCHEMA_MEASURES`) |
| `POST` | `/catalogs/:catalog/query` | Body `{ language: 'MDX'\|'DAX', statement: string }` → `{ columns: { name, type }[], rows: unknown[][] }` |

All calls carry `X-Bridge-Api-Key`. `/query` is the only execution endpoint — the compiler (below) is the only caller in normal operation; a raw pass-through is intentionally exposed for diagnostics/support, not for widgets to call directly.

## `DataSourceType` addition

| Type | Reaches | Requires |
|---|---|---|
| `OLAP_BRIDGE` | On-prem or Azure SSAS, Multidimensional or Tabular, via the bridge | `bridgeUrl`, `bridgeApiKey`, `catalog` |

Connection test for `OLAP_BRIDGE` = `GET {bridgeUrl}/health` plus `X-Bridge-Api-Key` check; failure surfaces exactly like any other Data Source's failed test.

## Query path (server-side only — the bridge API key never reaches the browser)

```
Widget (PivotSpec, references dataSourceId)
  → AppEndO server: POST /api/data-sources/:id/pivot   (same envelope as data-api-pivot.md)
  → provider lookup by DataSourceType
      flat-sql        → EdgeDbRouter (existing PIVOT-1 path)
      OLAP_BRIDGE      → compile PivotSpec → MDX|DAX → bridge POST /catalogs/:catalog/query → map rows → PivotResult
  → PivotResult (identical shape regardless of provider)
```

## Later (not this shard's v1 build)

- Empirical validation of DAX-over-XMLA passthrough against a real Tabular instance (OLAP-4).
- Cascading/parameterized MDX (parameter B depends on parameter A) — a Report Builder–era concern, not v1 here.
- Any UI for authoring raw MDX by hand — v1 only compiles from `PivotSpec` via the metadata-driven picker.

## Tokens / files (when implemented)

- Reference bridge: separate deployable, e.g. `tools/olap-bridge/` (ASP.NET Core, .NET 8, MIT) — not part of `src/`.
- Compiler: `src/server/domain/data-api/pivotOlapCompiler.ts` (pure: `PivotSpec` + cube metadata → MDX/DAX string; and inverse: bridge tabular result → `PivotResult`).
- Provider dispatch: alongside the existing `PIVOT-1` executor in `src/server/services/data-api/`.
- Data Source config/types: `src/shared/api/contracts/data-sources/types.ts` (`DataSourceType.OLAP_BRIDGE` only — `FABRIC_SEMANTIC_MODEL` was dropped from scope, see NEVER above), `src/server/db/dataSourcesStore.ts`.

## IDs

`olap-bridge.external-only`, `olap-bridge.reuses-pivot-result`, `olap-bridge.opaque-field-names`, `olap-bridge.no-os-gating`, `olap-bridge.two-data-source-types`, `olap-bridge.server-side-query-only`
