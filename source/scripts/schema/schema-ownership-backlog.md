# Schema ownership — status

**Status:** **CLOSED** (dev-only operator, 2026-11-09)  
**Runbook:** [`schema-ownership-closeout.md`](./schema-ownership-closeout.md) · verify: `npm run schema:verify-hwy-gates`  
**Canonical commands:** [`docs/standards/data-model.md`](../../docs/standards/data-model.md) (Schema ownership)

No mandatory follow-up on this initiative unless a second environment is introduced or product program B4–B10 is explicitly started.

---

## Shipped on dev (complete)

| ID | Summary |
|----|---------|
| — | Schema ownership manifest · `schema:install-extensions` / `:hwy` · `schema:ownership-report` |
| — | Finance greenfield + ref compat · 16 payment procs · masoolin star recalc · deferred below/officials |
| — | Legacy import parity gates · pipeline Pascal compat · agg functions install fix |
| — | `npm run schema:verify-hwy-gates` · `hwy:verify-db-objects:tests` · `test:hawiety-package` · `qa:hawiety-list-routes` |
| B1 | ETL + `schema:install-extensions:hwy -- --force` — done on dev |
| B2 / B2b / B3 | Masoolin + payment + deferred finance — done on dev |
| **B11** | Electoral geo: two assignment paths (process vs direct); same-level multi-node OK; cross-level = drift; ETL skip (`hwyMemberAreaLimitsCrossLevelEtl`); `hwy:etl:purge-cross-level-area-limits`; probe `schema:area-limits-invariant` (cross-level only) — **operator closed** |

---

## Not in this initiative (do not track here)

| ID | Notes |
|----|--------|
| B4–B10 | Product program (FK, workflow, CMS, …) — `plans/` |
| B12 | `hwy:gen-finance-procs` — only if legacy regen requested |
| B2 optional | Legacy activity ETL (`HWY_Nashatat`, …) for full masoolin star parity |
| M2–M4 | Maintenance (DDL consolidate, Postgres parity, Sequelize index) — low priority |

*B11 in Hawiety membership plans (approval dashboard stats) is a different ID — not schema-ownership B11.*
