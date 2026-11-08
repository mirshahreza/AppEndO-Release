# Unified Personal Inbox — Message envelope (logical unify)

> **Status:** Shipped (API + alert/DM/feedback/WI/dispatch focus surfaces)  
> **Depends on:** [01-decisions.md](./01-decisions.md), [03-phase-c-interface-union.md](./03-phase-c-interface-union.md)

## Goal

One **logical** shape for “open an inbox row and see messages + what you may do,” without merging feedback, notifications, workflow, MSGI, or DM into a single database table.

## Envelope (`PersonalInboxItemDetailEnvelope`)

| Field | Meaning |
| --- | --- |
| `itemKey` | Stable row key (`feedback:12`, `alert:9`, …) |
| `item` | Same `PersonalInboxItem` as list API |
| `threadId` | Envelope thread id (usually equals `itemKey`) |
| `messages[]` | Ordered messages (`id`, `body`, `authorDisplayName`, `createdAt`, `role`, `attachments`) |
| `capabilities` | `reply`, `forward`, `showRelatedHref` (UI hints; server still enforces on POST) |

## API

- `GET /api/personal-inbox/items/detail?itemKey={key}` — returns `{ success, detail: PersonalInboxItemDetailEnvelope }`.
- `404` when the row is not visible to the user.
- Reply / forward remain `POST /api/personal-inbox/items/reply` and `…/forward`.

## Adapter matrix

| `ref.type` | Messages source | Synthetic thread? |
| --- | --- | --- |
| `feedback` | Ticket messages (respect internal visibility) | No |
| `notification` | Notification `body` (+ title as context on item) | Yes (one message); **no reply/forward** (system alert, not correspondence) |
| `work_item` | Row `summary` or placeholder | Yes |
| `direct_message` | Thread messages | No |
| `message_dispatch` | Dispatch body summary | Yes (one message) |

## Out of scope (locked)

- Physical `base_inbox_message` table for all kinds.
- Two-way thread for `message_dispatch` ledger rows.
- Embedding workflow state machine inside envelope messages.

## UI

- **Alert** detail uses envelope + shared message block; **no reply/forward** (policy + UI).
- **Feedback** `FeedbackInboxFocusPanel` loads thread via envelope API; reply/forward from toolbar dialogs.
- **Work item** inbox focus shows envelope summary block; forward via correspondence dialog.
- **DM** thread panel uses envelope messages; **dispatch** detail dialog uses envelope + ledger meta.
