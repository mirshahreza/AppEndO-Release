# Dashboard AI Assist

> **Shard:** `dashboard-ai-assist` · **Extends:** [`personalizable-dashboard-canvas.md`](./personalizable-dashboard-canvas.md) (reads its domain declaration, its "Add Widget" dialog, and an already-fetched `PivotResult`)
> **Plan:** [`plans/core/todo/dashboard-canvas/p-116-dashboard-ai-assist.md`](../../plans/core/todo/dashboard-canvas/p-116-dashboard-ai-assist.md)
> **Split out 2026-09-10** from `personalizable-dashboard-canvas.md` — these three capabilities depend on AppEndO's AI/Agent/MCP infrastructure, a genuinely different subsystem dependency than the pure canvas/state/interaction features that shard covers. A dashboard page is fully usable with zero AI features; this shard is optional and independently shippable.

Locked 2026-09-10. Implemented 2026-09-11.

## Intent

Three AI-assisted capabilities, all bounded by the **exact same domain whitelist** `personalizable-dashboard-canvas.md` already enforces — none of them carry any additional privilege over the manual UI path a viewer already has:

1. **`query_dashboard_domain`** (MCP tool) — lets AppEndO's existing AI agent run a `PivotSpec` against a page's declared domain, borrowing Cube's "expose the semantic layer over multiple protocols" pattern.
2. **`draft_dashboard_widget`** — turns a natural-language request into a widget draft that pre-fills the ordinary "Add Widget" dialog for the viewer to confirm.
3. **"Explain this chart"** — a 1–3 sentence AI narrative of a widget's already-fetched `PivotResult`.

## MUST

- Implement `query_dashboard_domain` as a standard MCP tool alongside AppEndO's existing MCP tool registrations — it accepts the exact same `PivotSpec` shape the UI sends and runs through the exact same server-side domain-whitelist check, not a looser or parallel path.
- Implement `draft_dashboard_widget` as a **draft-only** agent tool, following the platform's existing draft→apply gate (the same pattern already used for Component Designer layout drafts) — its output is a widget config (kind, domain entry or `comboRef`, field mapping, viz config) that pre-fills the "Add Widget" dialog's own form state, never a direct write.
- Implement "Explain this chart" as a read-only operation over a `PivotResult` **already fetched and on screen** — it must not trigger a new or wider query than the one already rendering the widget.
- Require the viewer to explicitly confirm/adjust and submit the pre-filled Add Widget dialog before `draft_dashboard_widget`'s output becomes a real widget — matching every other draft→apply surface on the platform.

## NEVER

- Let `query_dashboard_domain` bypass the domain whitelist or accept a raw query string looser than `PivotSpec`.
- Let `draft_dashboard_widget` write a widget directly into personalization state, or let its `comboRef` output reference a field pair the page has not declared in `joinablePairs`.
- Let "Explain this chart" read anything beyond the widget's own already-fetched `PivotResult`, or call out to a data source directly.
- Grant either agent tool any privilege the manual UI path doesn't already have — both tools exist purely as a faster on-ramp into the same bounded surface `personalizable-dashboard-canvas.md` defines, never a second, looser one.

## Tokens / files (when implemented)

- `query_dashboard_domain`: alongside AppEndO's existing MCP tool registrations, calling the same server-side `PivotSpec` executor + domain-whitelist check the UI uses.
- `draft_dashboard_widget`: alongside AppEndO's existing agent draft-tool registrations, producing a draft object shaped exactly like the Add Widget dialog's own form state.
- "Explain this chart": a thin AI-call wrapper taking an already-fetched `PivotResult` — no new endpoint beyond whatever generic "ask the agent a question" surface AppEndO's AI infrastructure already exposes.
- UI entry points (AI "Describe what you want" input, per-widget "Explain" icon): additions to `personalizable-dashboard-canvas.md`'s own toolbar/hover-chrome components — no new UI shell.

## IDs

`dashboard-ai-assist.same-whitelist-as-ui`, `dashboard-ai-assist.draft-only-no-direct-write`, `dashboard-ai-assist.explain-reads-onscreen-data-only`, `dashboard-ai-assist.zero-additional-privilege`
