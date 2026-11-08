# Phase 1 — DM in personal inbox

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/direct-messages/recipients?search=` | Autocomplete coworkers (auth only) |
| POST | `/api/direct-messages/threads` | Create/open thread `{ recipientUserId, body? }` |
| GET | `/api/direct-messages/threads/:threadId` | Thread meta + counterpart |
| GET | `/api/direct-messages/threads/:threadId/messages` | Paginated messages |
| POST | `/api/direct-messages/threads/:threadId/messages` | Send `{ body }` |

## Personal inbox

- `PersonalInboxItemKind`: `direct_message`
- Item id: `direct_message:{threadId}`
- `ref.type`: `direct_message`
- Collector: merge live DM items in `collectPersonalInboxItemsUnfiltered`
- Dismiss attention → mark thread read; mark unread → clear read cursor

## UI

- Toolbar **New message** on inbox list
- `DirectMessageComposeDialog` — recipient search + body
- `DirectMessageThreadPanel` — thread when `?threadId=` set (MyInboxPage)
