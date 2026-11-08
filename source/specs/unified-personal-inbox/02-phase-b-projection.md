# Unified Personal Inbox — Phase B (projection)

> **Status:** Implemented  
> **Depends on:** [01-decisions.md](./01-decisions.md) (Phase A)

## Goal

Persist per-user inbox rows in the control plane so `GET /api/personal-inbox` and `/summary` read one indexed table instead of re-querying workflow, feedback, and notifications on every request.

## Storage (Sequelize)

| Table | Purpose |
|-------|---------|
| `base_personal_inbox_projection_items` | Denormalized rows — same shape as API `PersonalInboxItem` (+ `user_id`, stable `item_key`). |
| `base_personal_inbox_projection_meta` | Per-user `refreshed_at`, `item_count`. |

Boot: `ensurePersonalInboxProjectionTables` in `ensureControlPlaneFeatureTables` (schema marker version **5**).

## Read path (default)

1. **`PERSONAL_INBOX_READ_MODE=projection`** (default) — if meta `refreshed_at` is older than **30s** (or missing / stale), run Phase A collector (`collectPersonalInboxItems`), replace all rows for the user, then serve list/summary from projection.
2. **`PERSONAL_INBOX_READ_MODE=live`** — Phase A behavior only (tests / emergency).

## Invalidation

`invalidatePersonalInboxProjection(userId)` clears `refreshed_at` so the next read rebuilds.

Wired today:

- Create in-app notification (`createUserNotification`)
- Bell seen, mark read, mark all read
- Feedback ticket `markRead`
- Work item claim, complete, reassign, and forward (`invalidatePersonalInboxForWorkItem` in `personalInboxWorkItemInvalidate.ts`)

## API contract

Unchanged — same JSON as Phase A.
