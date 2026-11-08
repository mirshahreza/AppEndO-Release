# User Message Inbox (MSGI) — Decisions (D1–D10, P1–P3)

> **Plan:** p-126 closed (MSGI v1 shipped) — [`user-message-inbox.md`](../../docs/standards/user-message-inbox.md)  
> **Scope:** [01-scope-contract.md](./01-scope-contract.md)  
> **Phase:** MSGI-0  
> **Status:** ✅ **Locked** (operator 2026-09-16) — implement at «شروع کن»  
> **Created:** 2026-09-16

---

## Code facts (2026-09-16)

- `dispatchNotification` / `dispatchNotificationForRole` in `notificationDispatch.ts` — channels `IN_APP` | `EMAIL`; per-user preference on `eventType`; digest queues `base_user_notification_digest_items` without in-app row.
- Successful **EMAIL** send does **not** write `base_user_notifications` (by design today).
- In-app API: `GET/POST /api/notifications` — self-scoped list, unread count, mark read (`userNotifications.controller.ts`).
- **Bypasses** (write in-app without dispatch ledger): `jobWorker.service.ts` (`createUserNotification`, `source: agent_task`), `dbEnrichmentService.ts` (`createNotificationsForRole`, `source: db_enrichment`).
- Auth transactional email (`login.service`, `passwordRecovery`, `verification.service`) calls `sendEmail` directly — no notification stack.
- `my-inbox` / `base_work_items` = Human Workflow inbox; Home widget id `my-inbox` (HOMEW D3: separate product track from MSGI).
- New control-plane tables: **Sequelize** (constitution + `record-event-log` precedent); extend Prisma only for legacy `base_user_notifications` until p-76 migration.

---

## Industry alignment (research 2026-09-16)

Patterns consistent with locked decisions (not new scope for v1):

| Practice | Sources | MSGI mapping |
|----------|---------|----------------|
| **Task/work queue ≠ notification center** | [WooCommerce Task vs Inbox](https://developer.woocommerce.com/docs/extensions/ux-guidelines-extensions/task-list-and-inbox/), [notification center UX](https://uxpatternsguide.com/patterns/notification-center/) | D2 — two surfaces |
| **Single ingress; in-app is channel materialization** | [Objectstack ADR-0030](https://github.com/objectstack-ai/objectstack/blob/main/docs/adr/0030-notification-platform-convergence.md) | D5 — `dispatchNotification` only |
| **One delivery row per (event, user, channel) + idempotency** | [DevOps Daily — outbox](https://devops-daily.com/posts/in-app-email-and-push-from-one-event), [Stripe webhook dedup](https://docs.stripe.com/webhooks) | D3 — `correlation_id` + unique `(user_id, correlation_id, channel)` |
| **Sent ≠ delivered ≠ read** | [Delivery vs read](https://sohilladhani.com/blog/post/2026-04-13-delivery-receipts-and-read-tracking/), [SuprSend engagement matrix](https://docs.suprsend.com/docs/logging) | D4 — `readAt` in-app only; no open-tracking v1 |
| **Digest: system of record for items; one email per window** | [Courier digest](https://www.courier.com/docs/platform/automations/digest), [Knock batch caveat](https://docs.knock.app/designing-workflows/batch-function) | D7 — row at queue + `digest_batch_id` |
| **Append-only audit, retention policy central** | [GSE enterprise channels](https://gse.kz/en/blog/notification-architecture-corporate-channels) | D9 |
| **Bell UX: cap badge, optional unseen ≠ unread** | [Courier in-app center](https://www.courier.com/blog/in-app-notification-center-design) | v1.1 follow-up (below) |

---

## D1 — Product name and scope

| | |
|---|---|
| **Decision** | ✅ **MSGI** = append-only **outbound-to-user dispatch ledger** (who received what, when, via which channel, with delivery outcome). Not workflow work items, Mail Hub, feedback, or internal chat. |
| **Rationale** | Operators need «چه برای این کاربر فرستادیم» across channels; today only part of IN_APP is visible in the bell. |
| **Rejected** | Single merged «everything inbox» with `my-inbox` in v1 (D2). |

---

## D2 — UI: two menu entries in v1

| | |
|---|---|
| **Decision** | ✅ **Operator-confirmed:** **`my-inbox`** and **Messages** are unrelated products — **two places, two displays**, no merge. Keep work items unchanged. Add **Messages** at **`/studio/my-messages`** (P1). Shell **bell** = IN_APP unread + deep links; **View all** → Messages. |
| **Rationale** | Actionable workflow state vs read-mostly outbound log (industry task vs notification center split). |
| **Follow-up** | Optional Home widget `my-messages` in MSGI v1.1 after list page ships. |

---

## D3 — Data model: ledger + live in-app

| | |
|---|---|
| **Decision** | ✅ New Sequelize **`base_user_message_dispatches`**: one row per logical dispatch per user per channel under a **`correlation_id`**. **Unique constraint** `(user_id, correlation_id, channel)` for idempotent retries. Keep **`base_user_notifications`** as IN_APP live row (`readAt`, bell). Nullable **`in_app_notification_id`** when IN_APP (including EMAIL fallback). |
| **Rationale** | EMAIL-only and digest paths need history without fake in-app read state. |
| **Rejected** | Channel-only columns on `base_user_notifications`. |
| **Digest idempotency** | Store optional **`batch_key`** in `metadata_json`: `(user_id, event_type, channel, window_id)` per industry digest-window pattern. |

---

## D4 — Read vs delivery semantics

| | |
|---|---|
| **Decision** | ✅ **`readAt`** = in-app acknowledgment only. Ledger: `channel`, `delivery_status` (`digest_pending` \| `sent` \| `failed` \| `fallback_in_app`), `delivered_at` (SMTP accept / in-app write time in v1), `error_summary` (no secrets). **No** email-open / SMS-DLR / provider «seen» in v1. |
| **Rationale** | Industry separates engagement per channel; mixing with bell read confuses support and DSAR. |
| **MSGI-3+** | `delivered_at` may be updated from provider webhooks where available; still separate from `readAt`. |

---

## D5 — Single write path

| | |
|---|---|
| **Decision** | ✅ All **product** notifications to a `userId` via **`dispatchNotification`** (wrapper always writes ledger first). Migrate **`jobWorker`** and **`dbEnrichmentService`** bypasses in MSGI-1. |
| **Rationale** | Single ingress; producers never write inbox rows directly (ADR-0030-style). |

---

## D6 — Auth / security email out of v1 ledger

| | |
|---|---|
| **Decision** | ✅ Login OTP, password reset, email verification **do not** create MSGI rows in v1. Shard **MUST NOT**. |
| **Rationale** | Credential-adjacent, high volume; separate auth audit surface. |
| **Follow-up** | Optional `eventType: auth.*` in v2 if compliance requires user-visible auth message history. |

---

## D7 — Digest behavior

| | |
|---|---|
| **Decision** | ✅ On `EMAIL`+`digest`: ledger row at queue (`delivery_status=digest_pending`). On `scanAndSendDueNotificationDigests` success: each item → `sent`, shared **`digest_batch_id`**. **UI:** one row per logical notification (P3). |
| **Rationale** | User history matches events; batch email is one SMTP artifact linked by `digest_batch_id`. |

---

## D8 — Access control v1

| | |
|---|---|
| **Decision** | ✅ **Recipient only** (same as `/api/notifications`). No ADMIN cross-user MSGI browser in v1. |
| **Rationale** | PII in bodies; admin replay/search deferred to later plan with Record Policy. |

---

## D9 — Retention

| | |
|---|---|
| **Decision** | ✅ **Settings → Logs** — family **User message dispatches** (record-events pattern). Default **90 days** hot (P2). |
| **Rationale** | Central policy; append-only ledger with offload/purge jobs, not list-toolbar retention. |

---

## D10 — Channels roadmap

| | |
|---|---|
| **Decision** | ✅ MSGI-1 logs **IN_APP** and **EMAIL** only. **SMS** / **PUSH** (p-91) in MSGI-3. **WEBHOOK** integration-only — not user MSGI. |
| **Rationale** | Extend `NotificationChannelKey` when adapters exist. |

---

## P1–P3 — Product parameters (locked)

| # | Topic | Locked value |
|---|--------|----------------|
| **P1** | Route / labels | `/studio/my-messages` · EN **Messages** · FA **پیام‌ها** |
| **P2** | Default retention (hot) | **90 days** |
| **P3** | Digest in Messages UI | **One row per logical notification** (batch linked via `digest_batch_id`) |

---

## Follow-ups (explicitly not v1)

| ID | Item | When |
|----|------|------|
| **F1** | ✅ `seen_at` on bell open (unseen badge ≠ unread list) | shipped |
| **F2** | Badge cap `9+`; list grouping by `metadata.workItemId` | MSGI v1.1–1.2 |
| **F3** | `base_user_message_dispatch_attempts` for SMTP retries | When retry loop ships |
| **F4** | ADMIN replay with reason + rate limits | MSGI v2 / support tooling |
| **F5** | `severity: critical` bypass digest / quiet hours | Policy shard + preferences |

---

*Control — AppEndO*
