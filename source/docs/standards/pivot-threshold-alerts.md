# Pivot Threshold Alerts

> **Shard:** `pivot-threshold-alerts` · **Reads via:** [`data-api-pivot.md`](./data-api-pivot.md) (any provider — flat-sql, star-schema, OLAP bridge, MongoDB, Elasticsearch)
> **Plan:** [`plans/core/todo/dashboard-canvas/p-112-pivot-threshold-alerts.md`](../../plans/core/todo/dashboard-canvas/p-112-pivot-threshold-alerts.md)

Locked 2026-09-10. Implemented 2026-09-11.

## Intent

This is not a new subsystem — it is wiring three things that already exist, none of them invented for this shard:

```
Workflow Engine scheduled trigger (scheduleBindingAdapter.ts — already exists)
  → new action: data.pivot-threshold-check
      runs a PivotSpec against a Data Source (any Pivot provider)
      compares one cell/measure value against an operator-defined threshold
  → on breach: existing createUserNotification (userNotification.service.ts — already exists)
      + optional: continue the workflow (escalation, ticket creation, etc.) like any other action
```

This is deliberately the *cheap, low-risk* slice of Kibana-style alerting (threshold on a metric) — not anomaly detection / ML (see `elasticsearch-analytics-provider.md`'s rejected-scope section for why real ML is out).

## Scheduled Delivery (added 2026-09-10) — a sibling, not the same feature

Every product benchmarked (Metabase's "dashboard subscriptions," Superset's "Reports," Lightdash's "scheduled deliveries") draws a hard line between two mechanically distinct features that happen to share the same scheduler:

| | Alert (this shard, `data.pivot-threshold-check`) | Delivery (this addition, `data.pivot-snapshot-delivery`) |
|---|---|---|
| Fires | Only when a condition is true | Every scheduled run, unconditionally |
| Payload | A notification saying the condition breached | A rendered snapshot (image/PDF) of the widget or dashboard page |
| Purpose | "Tell me when something's wrong" | "Send me this dashboard every Monday 9am" |

Both reuse the exact same `scheduleBindingAdapter.ts` trigger and `createUserNotification` delivery path — this is a second action in the same core action pack, not a second scheduler or a second notification mechanism. Rendering the snapshot reuses whatever headless-render capability the platform already has for page screenshots (same approach originally scoped for the retired Dashboard Builder package's export feature) — no new rendering engine.

## MUST

- Implement as a new **Workflow action** (`data.pivot-threshold-check`) in the existing core action pack (`src/server/domain/workflow/actions/corePack/`), alongside `data.db-query` / `data.crud-gen-query` — not a new standalone scheduler, not a new notification channel.
- Accept a `PivotSpec` + Data Source reference (any provider behind the Pivot API — the action does not know or care which one) + a threshold expression (`{ field, operator: 'gt'|'gte'|'lt'|'lte'|'eq'|'ne', value }|`) evaluated against one resolved cell/measure.
- Trigger via the existing scheduled-trigger binding (`scheduleBindingAdapter.ts`) — reuse the same cron/interval UI Workflow already has, not a new scheduling UI.
- On breach, call the existing `createUserNotification` — do not build a second notification pipeline. Continuing the workflow (further actions on breach) is ordinary Workflow behavior, not special-cased here.
- Respect Record Policy exactly as the underlying Pivot provider already does — the alert action does not bypass it.
- Implement `data.pivot-snapshot-delivery` as a second, sibling action in the same pack: takes a dashboard page (or single widget) reference + recipients, renders it headlessly, and sends it via the existing notification path on the same scheduled-trigger binding — fires unconditionally, no threshold expression.

## NEVER

- Build statistical/ML anomaly detection as part of this shard — threshold-only. A future "trend/anomaly" mode is a distinct, separately-scoped decision (see rejected-scope notes), not assumed here.
- Invent a parallel scheduling or notification mechanism — this shard has zero new infrastructure, only new actions.
- Let the threshold check run any query outside the existing Pivot API/provider path (no ad hoc SQL, no direct driver access).
- Build a second rendering/screenshot engine for `data.pivot-snapshot-delivery` — reuse whatever headless-render capability already exists on the platform.
- Conflate Alert and Delivery into one action/config surface — keep them as two distinct, separately-triggered actions matching every product surveyed's own internal split.

## Tokens / files (when implemented)

- Actions: `src/server/domain/workflow/actions/corePack/pivotAlertActions.ts` (both `data.pivot-threshold-check` and `data.pivot-snapshot-delivery`, or added to `dbActions.ts` alongside the existing two data actions — implementer's call, same pack).
- Trigger: existing `scheduleBindingAdapter.ts` — no changes needed to the trigger itself.
- Notification: existing `userNotification.service.ts` — no changes needed.

## IDs

`pivot-threshold-alerts.reuses-existing-scheduler`, `pivot-threshold-alerts.reuses-existing-notification`, `pivot-threshold-alerts.threshold-only-no-ml`, `pivot-threshold-alerts.provider-agnostic`, `pivot-threshold-alerts.delivery-is-a-sibling-not-the-same-action`, `pivot-threshold-alerts.no-second-render-engine`
