# User Message Inbox (MSGI)

Audience: **AI agents**. Load when touching outbound user messaging, `base_user_message_dispatches`, personal inbox send-log filter, or `dispatchNotification` ledger writes.

Specs: `specs/user-message-inbox/` (plan p-126 closed — see `plans/core/todo/p-00-todo-index.md` log)

## MUST

- **Personal inbox:** `/studio/my-inbox` (`pageKey: my-inbox`, label **Inbox**) — `GET /api/personal-inbox` + `/summary`. List query **`folder`:** default **inbox** (excludes `system:archived` / `system:deleted` tags), **`archived`**, **`deleted`**, **`all`**, or **`u:{folderId}`** (user folder). Per-item tags via **`POST /api/personal-inbox/items/folders`** (`folderRefs[]`, multi-folder). User folders: **`GET/POST /api/personal-inbox/folders`**. Legacy **`view=archived|all`** still maps to folder filters. **Phase B (default):** projection for work items, feedback, alerts. **`kind=message_dispatch`:** live MSGI rows (Phase C). Spec: `specs/unified-personal-inbox/`.
- **MSGI ledger UI:** No separate route — filter **Send log** on inbox (`kind=message_dispatch`). **`pageKey: my-messages` removed.** Retention/admin: Settings → Logs / record-events scope.
- **Single write path:** Product notifications to a user go through `dispatchNotification` / `dispatchNotificationForRole`, which writes **`base_user_message_dispatches`** (Sequelize) per channel attempt.
- **In-app live row:** `base_user_notifications` + `/api/notifications` — alert read state is **`read_at`** on that table. **Work items** (and inbox dismiss for any `item_key`) persist open/dismiss in **`base_personal_inbox_item_seen`** (`user_id`, `item_key`, `seen_at`). The **shell bell badge and preview** use **`GET /api/personal-inbox/summary`** (aggregated with work items and feedback). Per-item **`POST /api/personal-inbox/dismiss-attention`** marks seen (alerts: `read_at` + seen row; feedback: ticket read + seen row; work items: seen row). Folder tags live in **`base_personal_inbox_item_folder_tags`**; user folder names in **`base_personal_inbox_user_folders`**. Built-in tag refs: **`system:archived`**, **`system:deleted`**. Items tagged archived/deleted are hidden from default inbox + bell summary. Do not bulk-mark bell seen without decrementing summary. Ledger holds EMAIL / digest / fallback history.
- **Ledger idempotency:** Unique `(user_id, correlation_id, channel)`; new `correlation_id` per dispatch call.
- **Digest:** Queue time → `delivery_status=digest_pending`; batch send → `sent` + shared `digest_batch_id` (link via `msgiDispatchId` in digest item metadata).
- **API:** `GET /api/user-message-dispatches` — **recipient only** (same scoping as notifications).
- **ADMIN Records:** `GET /api/notifications/admin` — **ADMIN only** cross-user browse of live bell rows (`base_user_notifications`); Studio **Records → In-app notifications** (`pageKey: in-app-notifications`).
- **Retention:** Family `userMessageDispatches` in Settings → Logs (shared age/destination with app logs, auth audit, record events). Scope `recordEvents` retention jobs offload/delete hot `base_user_message_dispatches` by `createdAt`. ADMIN **Control records** on Record Events and Messages runs the same scope (clear hot record events + hot dispatches).
- **Auth transactional email** (OTP, reset, verify) **MUST NOT** create MSGI rows.

## MUST NOT

- Direct `createUserNotification` from product features (bypasses ledger).
- Cross-user notification **mutations** from admin UI (read-only browse in Records).
- Prisma models for `base_user_message_dispatches` (Sequelize control-plane only).
