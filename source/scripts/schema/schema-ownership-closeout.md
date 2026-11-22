# Schema ownership — dev closeout

> **STATUS: CLOSED** — single dev SQL Server (`AppEnd`), operator 2026-11-09.  
> Re-open only for a new environment or an explicit product/schema program.

## Last verified (dev)

- `schema:verify-extx-gates` — finance + legacy parity + area-limits (cross-level **0** after purge)
- `extx:verify-db-objects:tests` · `test:portalx-package` · `qa:portalx-list-routes`
- B11: docs + ETL skip + `extx:etl:purge-cross-level-area-limits` on dev

## Regression checklist (if you change EXTX SQL or ETL)

```bash
npm run schema:install-extensions:extx -- --force
npm run schema:verify-extx-gates
npm run schema:ownership-report
npm run extx:verify-db-objects:tests
npm run test:portalx-package
npm run qa:portalx-list-routes
```

**QA login (this dev DB):** `identifier=admin` + `P#ssC0de`. Clear stale `APPENDO_DEV_PASSWORD=admin123` in the shell if login fails.

**Expected gates (`schema:finance-parity-probe`):** `legacyImportParityTables` · `legacyImportParityViews` · `financePaymentTables` · `financeEdgeCompat` = true; `paymentProcCount` ≥ 16.

## B11 (electoral geo — closed)

- Same-level multi-node: **expected** (direct / employees path).
- Cross-level approved rows: **drift** — not imported by `extx:etl:legacy-edge-parity` or geo-responsibility ETL; purge with `extx:etl:purge-cross-level-area-limits` if needed.
- Probe: `npm run schema:area-limits-invariant` (exit 1 only on cross-level).

## Out of scope

B4–B10 and optional items: [`schema-ownership-backlog.md`](./schema-ownership-backlog.md) §Not in this initiative.
