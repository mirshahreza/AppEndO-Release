# Home Module Widgets — Decisions (D1–D12)

> **Plan:** p-125 closed (۲۰۲۶-۰۹-۱۶). Canonical: this shard.  
> **Contract:** [`01-metadata-contract.md`](./01-metadata-contract.md)  
> **Phase:** HOMEW-0-2  
> **Status:** Design complete — PO confirms at «شروع کن» (same bar as RPE D7)  
> **Created:** 2026-09-15

---

## Code facts (2026-09-15)

- `parseDashboardLayout` **silently drops** any `widgetOrder` id not in `DASHBOARD_LAYOUT_BLOCK_IDS` — dynamic ids cannot persist today.
- `DashboardWorkspace` uses a manual `switch` on `DashboardLayoutBlockId`; package slot fill runs in designer preview, **not** in Home grid.
- `PlatformPageModule` has no `homeWidgets` field yet.
- `my-inbox` is a first-class legacy block; p-126 inbox is a separate product track.

---

## D1 — Widget id model

| | |
|---|---|
| **Decision** | Introduce `DashboardWidgetId = DashboardLayoutBlockId \| DynamicDashboardWidgetId` where dynamic ids match grammar in 01-metadata-contract. |
| **Rationale** | One persistence shape; legacy union unchanged for migration. |
| **Rejected** | Numeric ids; UUID per user; separate storage for package widgets. |

---

## D2 — Legacy block ids frozen

| | |
|---|---|
| **Decision** | Keep `kpi`, `insights`, `welcome`, `my-inbox`, … as **canonical layout ids**. Do **not** auto-migrate stored layouts to `module:*`. |
| **Rationale** | Zero user layout breakage; platform widgets stay recognizable in support/debug. |
| **Implication** | HOMEW-1 migrates **catalog + render** to registry; ids stay literal strings. |

---

## D3 — `my-inbox` stays legacy in v1

| | |
|---|---|
| **Decision** | No `module:my-inbox` alias in v1. Work Items widget remains id `my-inbox`. |
| **Rationale** | Overlap with p-126 undecided; avoid dual catalog entries. |
| **Follow-up** | If MSGI merges UI, revisit in p-126 + HOMEW v1.1. |

---

## D4 — `feedback` block vs CrudSet

| | |
|---|---|
| **Decision** | Keep legacy `feedback` widget. Do **not** add `collection:base_feedback` in v1. |
| **Rationale** | Existing `DashboardFeedbackBox` is the product surface. |

---

## D5 — Multi-widget modules

| | |
|---|---|
| **Decision** | `homeWidgets[]` allowed; layout id `module:<pageKey>:<id>` when `id` present; multiple entries encouraged for tsk (`my-open`, `team-overdue`). |
| **Rationale** | R3 product rule. |

---

## D6 — Collections & generic host deferred

| | |
|---|---|
| **Decision** | **v1 ships:** legacy platform registry + **page-module** widgets + **package slot** catalog entries. **v1 does not ship:** `collection:*` widgets, `summarySpec` generic host, designer-authored Home widgets. |
| **Rationale** | CrudSet summary API and Record Policy story need explicit components first (R7). |
| **Implication** | tsk Home widget uses **`module:<tasks-pageKey>:*`** with package/core component, not `collection:tsk_tasks`, until collection phase. |
| **Rejected** | Auto-widget per published CrudSet in v1. |

---

## D7 — Default visibility for new widgets

| | |
|---|---|
| **Decision** | Module and package widgets default `defaultVisible: false`. Only legacy `buildDefaultDashboardWidgetOrder` seeds first-time Home. |
| **Rationale** | Prevent Home clutter when packages install. |

---

## D8 — Catalog eligibility

| | |
|---|---|
| **Decision** | Hide widgets user cannot use (roles, disabled module, uninstalled package). No disabled gray rows in Add widget catalog. |
| **Rationale** | R5; matches function access patterns. |

---

## D9 — Single grid for package slot

| | |
|---|---|
| **Decision** | Remove parallel package-only dashboard strip. Package widgets use same `widgetOrder`, DnD, hide, chrome as core. |
| **Rationale** | R6; HOMEW-5 is release blocker for package UX. |

---

## D10 — Widget content boundary

| | |
|---|---|
| **Decision** | Summary + deep link only; max ~5–8 rows or KPI chips + one primary CTA. No iframe, no full CrudSet grid, no designer canvas embed. |
| **Rationale** | R4; aligns with Insights. |

---

## D11 — RBAC

| | |
|---|---|
| **Decision** | `requiredRoles` on widget must be subset of intersection(route binding auth, page-module `defaultRoles`). Summary APIs use same auth as list page. |
| **Rationale** | R5; no policy bypass. |

---

## D12 — First package sample

| | |
|---|---|
| **Decision** | **HOMEW-6** acceptance: core widgets + **testkit** package widget already on `core.dashboard.widgets` (existing install test path). **tsk** widget follows in tsk-package Phase 3 after HOMEW-1+5 merge — not a HOMEW release blocker if testkit passes. |
| **Rationale** | Unblocks HOMEW without waiting for full tsk UI. |

---

## Operator rules R1–R7 mapping

| Rule | Decision |
|------|----------|
| R1 | 0 widgets for tool pages — see exclusion list in [`01-metadata-contract.md`](./01-metadata-contract.md) § tool pages |
| R2 | Deferred — D6 |
| R3 | D5 |
| R4 | D10 |
| R5 | D8, D11 |
| R6 | D9 |
| R7 | D6 |
