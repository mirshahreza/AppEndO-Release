# Unified Personal Inbox — Phase C (interface read union)

> **Status:** Implemented  
> **Depends on:** [01-decisions.md](./01-decisions.md), [02-phase-b-projection.md](./02-phase-b-projection.md)

## Goal

One personal UI (`my-inbox`) and one list API (`GET /api/personal-inbox`) for actionable inbox rows **and** MSGI dispatch ledger rows, without merging control-plane tables.

## Locked

| # | Decision |
|---|----------|
| C1 | **`kind=message_dispatch`** — MSGI rows mapped to `PersonalInboxItem`; live read from `base_user_message_dispatches` (not stored in projection). |
| C2 | **Default `kind=all`** — work items + feedback + alerts only (same as Phase A/B). Send log requires explicit filter `message_dispatch`. |
| C3 | **Bell / summary** — unchanged; dispatch rows never affect `attentionCount`. |
| C4 | **`pageKey: my-messages` removed** — no route binding; legacy `?view=messages` → `?kind=message_dispatch`. |
| C5 | **Dispatch filters** — `dispatchChannel`, `dispatchStatus` query params when `kind=message_dispatch`. |

## UI

- Hawiety filter bar: item type includes **Send log**; channel/status filters when send log selected.
- Row click opens dispatch detail dialog (`GET /api/personal-inbox/items/detail?itemKey=message_dispatch:{id}`).
