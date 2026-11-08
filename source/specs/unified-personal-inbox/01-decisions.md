# Unified Personal Inbox — Phase A (API/UI)

> **Status:** Phase A complete; Phase B projection — see [02-phase-b-projection.md](./02-phase-b-projection.md).  
> **Supersedes (product direction):** MSGI D2 «two menu entries» on the personal surface. Phase C: [03-phase-c-interface-union.md](./03-phase-c-interface-union.md) — **`my-messages` route removed**; send log via `kind=message_dispatch` on `my-inbox`.

## Locked (operator 2026-10-30)

| # | Decision |
|---|----------|
| P1 | **One sidebar inbox** at `/studio/my-inbox` (`pageKey: my-inbox`), label **Inbox**. |
| P2 | **Bell** uses `GET /api/personal-inbox/summary` — `attentionCount` + preview (not notifications-only). |
| P3 | Each row exposes **`kind`**, **`origin`**, **`ref`**, **`href`**, **`attention`** (`action_required` \| `unread` \| `none`). |
| P4 | Sources: actionable **work items** (assigned + claimed + claimable), **feedback** (my tickets + staff assigned + role queue), **alerts** (in-app notifications deduped when same WI/feedback already listed). |
| P5 | **Phase B:** Sequelize projection (`base_personal_inbox_projection_*`) — see [02-phase-b-projection.md](./02-phase-b-projection.md). |
| P6 | **Personal menu parity:** Profile drawer + dashboard **My links** lead with **Inbox** (`my-inbox`); **My Feedback** removed from personal menus (route `my-feedback` remains for deep links). Bell, sidebar Inbox, profile, and dashboard widgets share the same inbox destination. |
| P7 | **Deep links:** `?workItemId=`, `?kind=work_item\|feedback\|alert\|message_dispatch`, `?dispatchId=` on `my-inbox`. Legacy `?view=messages` → `?kind=message_dispatch`. |

## Attention semantics (Phase A)

- **Work item:** `action_required` while OPEN/CLAIMED in an eligible bucket.
- **Feedback:** `unread` when `unreadCount > 0`.
- **Alert:** `unread` when notification `readAt` is null; `none` when deduped against a WI/feedback row.
- Bell **mark seen** still only stamps `base_user_notifications.seen_at` (existing API); WI/feedback stay in count until acted/read on their surfaces.
