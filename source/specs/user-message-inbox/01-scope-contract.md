# User Message Inbox (MSGI) — Scope contract

> **Plan:** p-126 closed (MSGI v1 shipped) — [`user-message-inbox.md`](../../docs/standards/user-message-inbox.md)  
> **Decisions:** [02-decisions.md](./02-decisions.md) (D1–D10, P1–P3 — **locked**)  
> **Status:** Design locked — implementation starts at operator «شروع کن»  
> **Updated:** 2026-09-16

---

## Locked product surface (P1–P3)

| Key | Value |
|-----|--------|
| **Route** | `/studio/my-messages` |
| **Labels** | EN **Messages** · FA **پیام‌ها** |
| **Retention (hot default)** | **90 days** — Settings → Logs family **User message dispatches** (D9) |
| **Digest UI** | One ledger row per logical notification; shared `digest_batch_id` when batch email sends (D7, P3) |

---

## Two surfaces (operator-confirmed)

| Surface | Purpose | Route / entry |
|---------|---------|----------------|
| **Work Items** | Actionable Human Workflow inbox (claim, due, complete) | `my-inbox` — unchanged |
| **Messages (MSGI)** | Outbound dispatch history (all logged channels) | `/studio/my-messages` + bell «View all» |

No shared menu merge, no duplicate rows across the two surfaces.

---

## Implementation shard (MSGI-1)

When coding starts, add canonical prose:

- `docs/standards/user-message-inbox.md`
- One line in `src/config/projectStandards.ts`

---

*Control — AppEndO*
