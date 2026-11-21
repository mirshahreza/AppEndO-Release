# Schema ownership — status

**Status:** **CLOSED** (dev-only operator, 2026-11-09)  
**Runbook:** [`schema-ownership-closeout.md`](./schema-ownership-closeout.md) · verify: `npm run schema:verify-vx-gates`  
**Canonical commands:** [`docs/standards/data-model.md`](../../docs/standards/data-model.md) (Schema ownership)

No mandatory follow-up on this initiative unless a second environment is introduced or product program B4–B10 is explicitly started.

---

## Shipped on dev (complete)

| ID | Summary |
|----|---------|
| — | Schema ownership manifest · `schema:install-extensions` / `:vx` · `schema:ownership-report` |
| — | Finance greenfield + ref compat · 16 payment procs · masoolin star recalc · deferred below/officials |
| — | Legacy import parity gates · pipeline Pascal compat · agg functions install fix |
| — | `npm run schema:verify-vx-gates` · `vx:verify-db-objects:tests` · `test:vertical-package` · `qa:vertical-list-routes` |
| B1 | ETL + `schema:install-extensions:vx -- --force` — done on dev |
| B2 / B2b / B3 | Masoolin + payment + deferred finance — done on dev |
| **B11** | Electoral geo: two assignment paths (process vs direct); same-level multi-node OK; cross-level = drift; ETL skip (`vxMemberAreaLimitsCrossLevelEtl`); `vx:etl:purge-cross-level-area-limits`; probe `schema:area-limits-invariant` (cross-level only) — **operator closed** |

---

## Not in this initiative (do not track here)

| ID | Notes |
|----|--------|
| B4–B10 | Product program (FK, workflow, CMS, …) — `plans/` |
| B12 | `vx:gen-finance-procs` — regen payment/masoolin; patches in `vxFinanceExportGreenfieldPatches.ts`; recalc hand file `vx_db_procedures_finance_masoolin_stars_recalc.sqlserver.sql` |
| B2 optional | Legacy activity ETL (`VX_Nashatat`, …) only when `vx_activities` empty; masoolin stars read greenfield first (`vx_masoolin_activity_metric_count`) |
| M2–M4 | Maintenance (DDL consolidate, Postgres parity, Sequelize index) — low priority |

*B11 in Vertical membership plans (approval dashboard stats) is a different ID — not schema-ownership B11.*
