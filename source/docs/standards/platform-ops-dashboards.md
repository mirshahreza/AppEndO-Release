# Platform Ops Dashboards

Audience: **AI agents**. Load this shard when the task touches Studio Insights pages, the Home Insights widget, `base_ops_*` VIEWs, or ops Pivot APIs.

Canonical implementation: `src/shared/lib/opsDashboardCatalog.ts` · `src/server/domain/platform-ops-dashboards/` · Home widget `insights` in `src/features/dashboard/`.

## Intent

After a fresh install, ADMIN sees **three** published Dashboard Canvas pages on the **default control-plane Data Source**. They answer operational questions Home KPIs cannot: trend, breakdown, and date-range filters over `base_*` facts. Home stays a mosaic. Insights is not a sidebar group.

Pages:

| pageKey | Title | Route |
|---------|-------|-------|
| `studio-insights-ops` | Studio operations | `/studio/insights/operations` |
| `studio-insights-work` | Work queue | `/studio/insights/work` |
| `studio-insights-people` | People and access | `/studio/insights/people` |

## MUST

- Seed **13** read-only Edge models + **13** Pivot APIs (`kind: pivot`, `allowFilter: true`, Record Policy on, no `bypassRecordPolicy`) on the Data Source with `isDefault: true`. No second Data Source.
- Domain `exposedFields` is the catalog whitelist. Deny-list in `OPS_DASHBOARD_DENIED_FIELDS` is law (password, email, IP, log `message`, payloads, vault/secret names, …). `username` on ops VIEWs is allowed; Data Source `username` is not a VIEW column.
- Reporting VIEWs are Sequelize DDL, physical names `base_ops_*`. Prisma is locked — no new Prisma models.
- Routes: `nav: null`, ADMIN `accessMode: specific`. Entry is Home widget `insights` (ADMIN only), default order after `kpi`. Direct URL still works.
- Designer drafts persist under folder `general` with ids `studio-insights-ops|work|people` (never `builtin-` prefix). Publish snapshot + pin loader; do **not** call `publishDesignerComponent` (it propagates sidebar nav).
- Default date range `last:7d` on Studio operations, Work queue, and People Sign-in. People/Hygiene census has no default range. Baked KPI filters (e.g. `status=failed`) must not take the page status/level filter.
- English empty-states. No fake chart rows. Tables are pivot matrices. `personalizable: true`. Share/snapshot/embed off in seed.
- Work queue is the ADMIN view of the whole queue. There is no “My work” tab on Insights v1.

## NEVER

- Sidebar Insights group or `nav.label` on these bindings.
- Star-schema / OLAP / Mongo / ES / second Data Source for these pages.
- Expose log text, vault, PII, or deny-listed columns on Edge models, Pivot `fields.read`, or VIEW output.
- Convert Home mosaic to a canvas. Do not add Prisma tables for ops dashboards.
- Seed dummy jobs/logs/users to fill charts.

**IDs:** `platform-ops-dashboards.insights-home`, `platform-ops-dashboards.whitelist`, `platform-ops-dashboards.views`.
