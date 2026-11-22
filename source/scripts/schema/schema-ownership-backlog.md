# Schema ownership — status

**Status:** **CLOSED** (dev-only operator, 2026-11-09)  
**Runbook:** [`schema-ownership-closeout.md`](./schema-ownership-closeout.md) · verify: `npm run schema:verify-extx-gates`  
**Canonical commands:** [`docs/standards/data-model.md`](../../docs/standards/data-model.md) (Schema ownership)

No mandatory follow-up on this initiative unless a second environment is introduced or product program B4–B10 is explicitly started.

---

## Shipped on dev (complete)

| ID | Summary |
|----|---------|
| — | Schema ownership manifest · `schema:install-extensions` / `:extx` · `schema:ownership-report` |
| — | Finance greenfield + ref compat · 16 payment procs · masoolin star recalc · deferred below/officials |
| — | Legacy import parity gates · pipeline Pascal compat · agg functions install fix |
| — | `npm run schema:verify-extx-gates` · `extx:verify-db-objects:tests` · `test:portalx-package` · `qa:portalx-list-routes` |
| B1 | ETL + `schema:install-extensions:extx -- --force` — done on dev |
| B2 / B2b / B3 | Masoolin + payment + deferred finance — done on dev |
| **B11** | Electoral geo: two assignment paths (process vs direct); same-level multi-node OK; cross-level = drift; ETL skip (`extxMemberAreaLimitsCrossLevelEtl`); `extx:etl:purge-cross-level-area-limits`; probe `schema:area-limits-invariant` (cross-level only) — **operator closed** |

---

## Not in this initiative (do not track here)

| ID | Notes |
|----|--------|
| B4–B10 | Product program (FK, workflow, CMS, …) — `plans/` |
| B12 | `extx:gen-finance-procs` — regen payment/masoolin; patches in `extxFinanceExportGreenfieldPatches.ts`; recalc hand file `extx_db_procedures_finance_masoolin_stars_recalc.sqlserver.sql` |
| B2 optional | Legacy activity ETL (`EXTX_Nashatat`, …) only when `extx_activities` empty; masoolin stars read greenfield first (`extx_masoolin_activity_metric_count`) |
| M2–M4 | Maintenance (DDL consolidate, Postgres parity, Sequelize index) — low priority |

*B11 in Portalx membership plans (approval dashboard stats) is a different ID — not schema-ownership B11.*
