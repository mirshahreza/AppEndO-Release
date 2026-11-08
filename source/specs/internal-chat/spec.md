# Internal direct messages (integrated inbox)

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `internal-chat` |
| **Status** | `In Progress` |
| **Created** | 2026-11-01 |
| **Constitution version** | 2.0.0 |

## Feature goal

Authenticated users can exchange **direct messages (1:1)** inside AppEndO Studio, surfaced in **`my-inbox`** as a first-class inbox kind — separate from MSGI dispatch ledger, workflow work items, feedback tickets, and system alerts.

### Phases

| Phase | Scope |
| --- | --- |
| **1 (this shard)** | DM text · thread list in inbox · compose · read/unread · thread view |
| **2** | File attachments (reuse feedback attachment staging pattern) |
| **3** | Reply and forward (message graph fields + UI) |

### Out of scope (all phases)

- Group channels (p-63 CHT v1 channels)
- Realtime SSE (poll / inbox refresh only in phase 1)
- MSGI ledger rows for peer chat (no `dispatchNotification` for DM body)

## Success criteria (phase 1)

- [ ] User A sends text to user B; B sees inbox row with unread attention
- [ ] Opening thread marks read; bell `attentionCount` includes unread DMs
- [ ] Cannot read or post to a thread without being a participant

See [01-decisions.md](./01-decisions.md) and [02-phase-1-dm-inbox.md](./02-phase-1-dm-inbox.md).
