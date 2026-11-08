# Hawiety package — database objects for atomic writes

> **Shard:** `package-hawiety-db` · **Agent context:** [`plans/packages/todo/hawiety-package/hwy-agent-context.md`](../../plans/packages/todo/hawiety-package/hwy-agent-context.md) · **Audit:** [`hwy-db-write-audit.md`](../../plans/packages/todo/hawiety-package/hwy-db-write-audit.md) · **Execution plan (operator gate):** [`hwy-db-objects-execution-plan.md`](../../plans/packages/todo/hawiety-package/hwy-db-objects-execution-plan.md)

## Intent

Hawiety (هویتی) reads and writes SQL Server through `src/server/domain/hwy/*` and install scripts under `scripts/hwy-phase1/db/install/`. **Multi-step writes**, **guarded writes** (allocate id + insert), and **complex reads** (multi-join lists, scope subqueries, inbox grids) belong in **first-class database objects** (procedures / table-valued functions / views) so:

1. **Atomicity** is enforced in one `BEGIN TRAN` / `COMMIT` batch (not split across Node awaits).
2. **Operators and ETL** can run the same logic from SSMS, legacy parity scripts, or batch jobs without duplicating rules in TypeScript.

Greenfield: one contract per operation — no parallel “TS path” and “SP path” with different rules.

## MUST

| Rule | Detail |
|------|--------|
| **When to add a write proc** | Two or more DML statements that implement one business decision (approve, reject, register, workflow step, slot handoff, linked profile sync on write, …); or `UPDLOCK` / `HOLDLOCK` allocation + insert that must not race. |
| **When to add a read object** | Any SELECT that is not a **simple read** (single row by id, existence check, scalar lookup by FK) — e.g. admin grids, geo node matrix, targhin queue, similar members, fast-path segment lists, dossier timeline SQL. Prefer `VIEW` for stable projections; `PROC` / TVF when parameters, paging, or scope filters are required. |
| **Script location** | `scripts/hwy-phase1/db/install/hwy_<area>_<verb>.sqlserver.sql` (or extend an existing area file e.g. `hwy_geo_responsibility.sqlserver.sql`). Pair uninstall fragments under `scripts/hwy-phase1/db/uninstall/` when objects are dropped on package teardown. |
| **Naming** | Domain procedures/functions: `hwy_*` (same family as tables). Cross-package utilities stay `zz_*` per [`data-model.md`](./data-model.md). Prefer `CREATE OR ALTER PROCEDURE dbo.hwy_<domain>_<verb>`. |
| **Parameters** | Typed `@` parameters only — never concatenate user input into dynamic SQL inside Hawiety SPs. |
| **Errors** | `THROW` with stable `message` text (or `error_number` where legacy parity needs it). TypeScript maps known messages to HTTP 400/403/404. |
| **Install** | SQL batches: `scripts/hwy-phase1/db/install/hwy_db_*.sqlserver.sql`, repackaged in vertical-app **`hawiety`** (`npm run hawiety:pack` / **`npm run hawiety:install`**). When the package is enabled, `ensureHwyDbObjects()` may still apply drift on boot. Operator/CI: **`npm run hwy:db-objects`** (after control plane is `sqlserver`). Geo nomination list/count procs: **`npm run hwy:gen-nomination-procs`** before install. Legacy `hwy:phase1` runs the same install after HWY schema. Proc params: use `NVARCHAR(MAX)` or ≤4000 — not `NVARCHAR(8000)`. |
| **Discover** | **`npm run hwy:scan-inline-sql`** — list inline `sequelize.query` in `src/server/domain/hwy` and flag complex SQL (SP candidates). |
| **Verify (repeatable)** | **`npm run hwy:verify-db-objects`** — install SQL ↔ `execHwyProcedure` coverage (no DB). **`npm run hwy:verify-db-objects -- --install`** — also apply and match `sys.procedures`. **`npm run hwy:verify-db-objects:tests`** — Vitest install/coverage/integration. Agent skill: **`.claude/skills/appendo-build-hwy-db-objects/SKILL.md`**. |
| **TypeScript caller** | Service validates auth/roles, resolves Base Info ids if needed, then **one** `sequelize.query('EXEC dbo.hwy_…', { replacements })`. Post-commit side effects only: cache/session/record-event when they cannot live in DB. |
| **Simple reads** | May stay as one inline parameterized query in TS. **Complex reads** must move to DB objects (see execution plan). Base Info **title enrichment** and culture may stay in app on top of proc result sets. |

## SHOULD stay in the app layer (after SP commit)

- JWT session invalidation, list cache keys (`invalidateHwyMemberDirectoryListCache`, …).
- Append-only **record event log** when the product requires actor metadata the SP does not own — prefer SP returning an `OUTPUT` row snapshot for the emitter.
- Rate limits, role names, and Record Policy scope checks (unless duplicated for standalone DB use — document if so).

## NEVER

- **Write to legacy MembersV2** (production Hawiety SQL). Runtime and ETL open legacy only with `ApplicationIntent=ReadOnly` via `readLegacyConn()` / `connectLegacyReadPool()`; mutations stay on control-plane `hwy_*` procs and imported `HWY_*` tables on the AppEndO edge DB.
- Multi-statement Hawiety **decision** flows implemented only as a chain of `sequelize.query` without a DB object (except transient scaffolding before SP lands in the same task).
- Copy-paste SQL batches between ETL and runtime services — ETL may call the same SP once it exists.
- Drop or replace existing `hwy_*` functions/views without updating `ensureHwy*` installers and the audit backlog.

## Existing DB objects (baseline)

| Object | Role |
|--------|------|
| `dbo.hwy_member_passed_necessary_dorat` | Course completion predicate (geo montadhemin parity) |
| `dbo.hwy_base_info_*`, `dbo.hwy_region_*` | Title paths for member list view |
| `dbo.vw_hwy_members` | Denormalized member read model |
| `dbo.vw_hwy_candidate_pipeline_*` | Candidate pipeline stage lists (security / interview / courses / install) |
| `hwy_geo_responsibility*.sqlserver.sql` | Request table DDL + indexes |

## Execution order for migrations

When the operator says **شروع**: follow [`hwy-db-objects-execution-plan.md`](../../plans/packages/todo/hawiety-package/hwy-db-objects-execution-plan.md) wave-by-wave; run the test gate after each wave. Do not ship procs without updating the plan **Done** column and installers.

**IDs:** `package.hawiety.db-objects`
