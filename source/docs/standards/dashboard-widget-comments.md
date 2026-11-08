# Dashboard Widget Comments

> **Shard:** `dashboard-widget-comments` · **Anchors to:** a `(pageId, widgetNodeId)` pair on a [`personalizable-dashboard-canvas.md`](./personalizable-dashboard-canvas.md) page
> **Plan:** [`plans/core/todo/dashboard-canvas/p-115-dashboard-widget-comments.md`](../../plans/core/todo/dashboard-canvas/p-115-dashboard-widget-comments.md)
> **The one deliberate exception:** every other 2026-09-10 addition to `personalizable-dashboard-canvas.md` stayed URL/session-ephemeral specifically to avoid a new persisted record. A comment thread cannot work that way by its nature — this shard is the one place that genuinely needs one new small table, and says so explicitly rather than forcing a discussion feature into a stateless shape.

Locked 2026-09-10. Implemented 2026-09-11. Independently sequenced from the rest of Dashboard Canvas — a page is fully usable with zero comments; this is an optional, separately-shippable capability.

## Intent

A lightweight, flat discussion thread attached to one widget on one dashboard page — "why did this spike?" / "flagging this for finance" — inspired by Preset's (Superset's commercial layer) widget/dashboard commenting, scoped down to the simplest version that's actually useful. No @mentions, no nesting, no rich text in v1.

## MUST

- Store comments in exactly one new Core table, `base_dashboard_widget_comments` — `base_` prefix because this is a cross-cutting Core capability (like the platform's own `base_workbook_shares`/`base_workbook_public_links` tables), not a package-scoped domain table.
- Anchor each comment to `(pageId, widgetNodeId)` — `widgetNodeId` is either a developer-authored node id or a user-added widget's `id` from the personalization JSON; either way it's an opaque string, this shard does not care which.
- Inherit view/comment permission from the **page's own existing permission model** — if a viewer can see the dashboard page, they can read and add comments; do not invent a second permission system for this.
- Keep comments **flat and append-only** (no threading/replies, no edit) in v1 — matches Task Management's `tsk_comments` precedent (`src/server/domain/workflow`-adjacent convention: "v1 immutable after send — correction = new comment").
- Author = `base_users.id` of the current session — never a free-text name field.

## NEVER

- Build a generic "attach a comment to any record" platform service as part of this shard — this table is dashboard-widget-specific; a generic commenting service (if ever wanted) is a separate, much bigger decision.
- Add @mentions, notifications-on-comment, rich text/markdown, or threading in v1 — start flat, add depth only when a real need shows up.
- Let a comment reference a `pageId`/`widgetNodeId` the current user cannot otherwise view — the permission check happens before any read/write, not as an afterthought.

## Shape

```ts
// base_dashboard_widget_comments
{
  id: number
  page_id: string
  widget_node_id: string
  author_id: number        // -> base_users.id
  body: string
  created_at: timestamp
}
```

Indexes: `(page_id, widget_node_id, created_at)` for the ordered per-widget thread fetch.

## API

- `GET /api/dashboard-canvas/comments?pageId=&widgetNodeId=` — ascending by `created_at`.
- `POST /api/dashboard-canvas/comments` — `{ pageId, widgetNodeId, body }`, author from session.

Both check the same page-view permission [`personalizable-dashboard-canvas.md`](./personalizable-dashboard-canvas.md) already relies on for the page itself.

## Tokens / files (when implemented)

- Table/migration: `base_dashboard_widget_comments` (Core, not a package table).
- Routes: `src/server/routes/dashboard-canvas-comments.routes.ts` (or folded into wherever the canvas's own endpoints live).
- UI: the comment icon + popover thread referenced in `personalizable-dashboard-canvas.md`'s per-widget hover chrome — reuses `UiTextarea` + a simple stacked list with `DirectionalText`, not a chat-bubble kit (same convention Task Management's comments already follow).

## IDs

`dashboard-widget-comments.one-new-core-table`, `dashboard-widget-comments.inherits-page-permission`, `dashboard-widget-comments.flat-append-only-v1`, `dashboard-widget-comments.not-a-generic-comment-service`
