/**
 * Domain Story markdown for platform control-plane (`base_*`) Edge models.
 * English-only · Purpose / Lifecycle / Rules — same contract as CMS studio-meta.
 *
 * Canonical catalog: import/refresh fills empty Story from here. Operator edits
 * in Data Studio win and survive delete+reimport via schema-keyed studio-meta.
 */

export const BASE_STUDIO_META_STORIES: Record<string, string> = {
  base_users: `## Purpose

Platform login account. Every authenticated person — staff, portal user, or future package customer — is one row here. Credentials and lock state live on this table; display identity lives on \`base_user_profiles\`.

## Lifecycle

1. **Create** — username required (unique). Email/mobile optional but unique when set. \`person_type_code\` is chosen at create on the paired profile (Individual vs Company) and is locked afterward.
2. **Assign roles** — via \`base_user_roles\` junction; effective permissions come from role names + MCP grants + record policies.
3. **Lock / unlock** — \`locked\` flag with audit (\`locked_at\` / \`locked_by\`, \`unlocked_*\`). Failed login counters reset on success.
4. **Delete** — cascades profile, identities, tokens, and package-visible FKs; prefer disable/lock for operators.

## Rules

- \`is_builtin\` rows are seeded system accounts — do not delete from Studio.
- Password hash only — never store plaintext; auth APIs hash at the boundary.
- Do not duplicate name/phone on package tables when the person can log in; extend with 1:1 tables on \`user_id\`.
- Audit \`created_by\` / \`updated_by\` from session actor; \`NULL\` for system/bootstrap rows.`,

  base_user_profiles: `## Purpose

1:1 identity profile for \`base_users\`. Holds natural-person vs company fields, optional avatar bytes, and \`person_type_code\` (Base Info \`100.2.*\`).

## Lifecycle

1. **Create with user** — profile row shares \`user_id\` PK. Person type picked at create (Add Individual / Add Company); never PATCH afterward.
2. **Edit** — conditional fields only: Individual shows person-name/gender/birth; Company shows \`company_name\` / registration / website.
3. **Avatar** — \`profile_image_body\` (+ optional \`profile_image_body_xs\`) stored in-row; mime/size tracked for UI.

## Rules

- PK = \`user_id\` — exactly one profile per user.
- \`gender_code\` / \`person_type_code\` are Base Info ids, not free text.
- Visibility helpers: \`isProfileFieldVisibleForPersonType\` — same matrix on Users modals and self-service profile.
- Organization link (\`organization_user_id\` when present) points to a Company user; packages read, do not fork.`,

  base_user_identities: `## Purpose

External identity provider links for a user — OAuth/OIDC \`(provider_id, subject)\` ↔ \`base_users.id\`. Enables passwordless and federated login without duplicating core user rows.

## Lifecycle

1. **Start OAuth** — \`GET /api/auth/oauth/:providerId/start\` creates a pending challenge; callback upserts this row.
2. **Link** — same subject on a new provider attaches another row to the same user.
3. **Unlink** — delete this row only; the platform user stays. Merge of two users is \`IdentityLinkService\`, not a Studio edit.
4. **User delete** — identities cascade with \`base_users\`.

## Rules

- **UNIQUE** (\`provider_id\`, \`subject\`) globally — one link per provider subject.
- Multiple providers may attach to the same user; merge policy lives in \`IdentityLinkService\`.
- \`profile_json\` is provider snapshot only — not authoritative over \`base_user_profiles\`.
- Cascade delete with user; unlink API removes row without deleting the user unless policy says merge.`,

  base_user_roles: `## Purpose

Many-to-many assignment of named roles to users. Composite PK (\`user_id\`, \`role_name\`). Effective access = union of all assigned roles' function grants, MCP grants, and scope defaults.

## Rules

- FK to \`base_roles.name\` and \`base_users.id\` — both cascade on delete.
- Assign/remove via Users/Roles admin APIs; audit optional on junction (\`created_by\`).
- Removing a role from a user does not delete the role definition.`,

  base_users_attributes: `## Purpose

Per-user values for **Settings → Data model** attribute definitions (\`base_settings_attributes\`). EAV storage for extended metadata configured by operators (tags, org units, custom fields).

## Rules

- **UNIQUE** (\`definition_id\`, \`user_id\`).
- Value shape follows definition \`data_type\` / \`cardinality\` — validated server-side, not free SQL.
- \`source_type\` on definition may bind to Base Info tree — store selected item id(s) in \`value_text\`.
- User self-edit obeys definition \`user_editable\` + \`user_edit_policy\`.`,

  base_roles: `## Purpose

Named role catalog for RBAC. Roles aggregate function access, optional MCP tool grants, scope defaults, and attribute values. Referenced by \`role_name\` string (stable key).

## Rules

- \`name\` is unique and used as FK target — rename carefully (cascade updates junction tables).
- \`note\` is operator documentation only.
- Builtin/system roles may be seeded — protect from accidental delete in production flows.`,

  base_roles_attributes: `## Purpose

Per-role default values for settings attribute definitions — e.g. default department tag applied to every user with that role until overridden on the user row.

## Rules

- **UNIQUE** (\`definition_id\`, \`role_name\`).
- Role-level value is a default, not a substitute for \`base_users_attributes\` when user-specific value exists.
- Cascade delete when role removed.`,

  base_role_mcp_grants: `## Purpose

Grants MCP server/tool access to a role. Tuple (\`role_name\`, \`resource_kind\`, \`resource_id\`) — evaluated when AI agent assembles tool registry for a session.

## Rules

- **UNIQUE** triple per role — no duplicate grants.
- \`resource_kind\` distinguishes server vs tool vs bundle ids — see AI settings / MCP registry.
- Effective tools for a user = union of grants across all assigned roles (subject to session capability scope).`,

  base_scope_memberships: `## Purpose

Assigns a user to a node in a **scope dimension** (org/geo/custom). \`node_id\` is a \`base_info.id\` string without FK — hierarchical renames remap in application code. Used by record policy / RPE row filters.

## Rules

- **UNIQUE** (\`user_id\`, \`dimension_key\`, \`node_id\`).
- \`dimension_key\` names the axis (e.g. org tree vs geo tree) — must match policy AST refs.
- Assign/remove writes append-only \`base_scope_membership_events\` for audit.
- Not a replacement for roles — capability still required to call functions.`,

  base_scope_membership_events: `## Purpose

Append-only audit log for scope membership assign/remove. Captures dimension, node, subject user, actor, and event type — not editable in place.

## Rules

- Insert-only from scope membership APIs/workflows.
- Indexed by node, user, and time for operator forensics.
- Deleting a user cascades subject rows; actor may be null for system events.`,

  base_scope_role_memberships: `## Purpose

Assigns a **role** to a node in a scope dimension (org/geo). Binary membership only — the role is in-scope for that node, not a per-user grant. Complements \`base_scope_memberships\` (user↔node). Record Policy Engine projects both into server session as \`scope.*\`.

## Rules

- **UNIQUE** (\`role_name\`, \`dimension_key\`, \`node_id\`).
- \`role_name\` FK to \`base_roles.name\` (cascade).
- \`node_id\` is a \`base_info.id\` string without FK — same remap rules as user memberships.
- Assign/remove writes append-only \`base_scope_role_membership_events\`.
- Does not grant the function call; Access Control still decides whether the role may invoke the API.`,

  base_scope_role_membership_events: `## Purpose

Append-only audit log for role↔node scope membership assign/remove. Captures dimension, node, role name, actor, and event type — not editable in place.

## Rules

- Insert-only from role-scope membership APIs.
- Indexed by node, role, and time for operator forensics.
- Actor may be null for system events.`,

  base_info: `## Purpose

Hierarchical reference-data tree (LOV catalog). Package vocabularies (CMS tags, CRM stages, person types, …) and platform roots (\`100\` Base, \`100.2\` person type, …) live here — not in ad-hoc enum columns.

## Lifecycle

1. **Category node** — folder under a root; may have \`short_name\` for stable codes in APIs.
2. **Item node** — leaf selectable in forms; \`id\` is hierarchical string (e.g. \`101.005.003\`).
3. **Deactivate** — \`is_active = false\` hides from pickers; historical FKs keep id.

## Rules

- \`id\` assigned by HID algorithm (\`baseInfoHid.ts\`) — do not hand-edit ids in production.
- LOV FK columns store **item id**, not \`short_name\` alone.
- \`ui_color\` / localized titles are presentation; business logic keys off \`id\`.
- Edge models wire \`belongsTo base_info\` on LOV columns for Studio/Data API includes.`,

  base_settings_sections: `## Purpose

Platform-wide settings blobs keyed by \`section_key\` (JSON in \`value\`). Shared across all nodes on the same control-plane DB — AI providers, cache, security/JWT, cultures, scheduler, git, etc.

## Rules

- One row per \`section_key\` — upsert only, never duplicate keys.
- Node-local settings stay in \`settings.json\` (\`runtime.*\`) — not this table.
- Import/export via \`/api/settings/transfer/*\` and install wizard seed from \`settings.example.json\`.
- Structured field definitions use \`base_settings_attributes\`, not arbitrary keys here.`,

  base_settings_attributes: `## Purpose

Data-model attribute **definitions** — typed fields bound to users and/or roles. Drives extended profile UI, record-policy dimensions, and EAV value tables.

## Rules

- **UNIQUE** (\`scope\`, \`key\`) — scope namespaces platform vs package definitions.
- \`source_type\` selects static, Base Info tree, or profile field binding.
- \`visibility\` / \`user_editable\` / \`user_edit_policy\` gate self-service vs admin-only edit.
- Deactivate with \`is_active\` rather than hard-delete when values exist.`,

  base_settings_profile_fields: `## Purpose

Registry of which core profile columns appear in Settings → Profile field policy. Maps \`profile_field\` key to labels and edit policies — does not store user data.

## Rules

- PK = \`profile_field\` string matching \`base_user_profiles\` column semantics.
- \`is_active\` gates visibility in self-service profile form.
- Person-type conditional display still enforced in UI helpers — this table is policy metadata only.`,

  base_otp_challenges: `## Purpose

Short-lived OTP verification rows for login/register/reset flows. Stores hashed OTP, channel, target address, expiry — never plaintext OTP.

## Rules

- \`used_at\` set on successful verify — row is spent.
- Expired rows ignored by auth service; periodic cleanup job may purge.
- \`user_id\` optional for pre-account flows (register by email/mobile).
- One active challenge policy enforced in service layer per purpose+target.`,

  base_auth_refresh_tokens: `## Purpose

Rotating refresh-token sessions. Each row tracks \`token_jti\`, user, expiry, revocation — pairs with JWT access tokens from auth API.

## Rules

- \`token_jti\` unique — lookup key for rotation/revoke.
- Revoke all on password change / admin lock when policy requires.
- Cascade delete with user.
- Do not expose refresh token in Data API public projections.`,

  base_logs_auth_audit: `## Purpose

Security audit trail for authentication events — login success/failure, lockout, token revoke, OAuth link, etc. Operator-facing via Logs workspace.

## Rules

- Append-only — no UPDATE of historical rows.
- May include IP/user-agent metadata in payload columns — classify as sensitive.
- Retention/cleanup via platform log policy — not user-editable rows.`,

  base_logs_app: `## Purpose

Application/runtime log index persisted to control plane — structured app log entries mirrored from Winston/telemetry pipeline for Studio Logs grid.

## Rules

- Append-only operational log — not a business entity.
- Level/status filters in UI map to stored severity columns.
- Large payloads may truncate — detail lives in message/text fields.`,

  base_jobs: `## Purpose

Background job queue — scheduled and ad-hoc work claimed by the Jobs worker. Studio **Jobs**, MCP jobs tools, and workflow \`jobs.*\` actions all write here.

## Lifecycle

1. **Enqueue** — insert \`pending\` with \`job_type\`, payload, \`max_attempts\`, and optional not-before window.
2. **Claim** — worker leases the row; only the lease holder may complete or fail it.
3. **Run** — dispatch by \`job_type\`: \`edge_function\` (managed Server Function), \`agent_task\`, or \`db_enrichment\`. Unknown types fail with a clear error.
4. **Complete / fail** — success is terminal; failure retries until \`max_attempts\`, then stays failed for operator review.

## Rules

- Do not edit \`status\` manually in Studio during an active run — you will race the worker lease.
- Idempotent handlers key off job type + payload fingerprint where required.
- Cancel own agent tasks through the Jobs API, not by deleting the row mid-flight.`,

  base_contact_messages: `## Purpose

Inbound contact form submissions from public/designer surfaces — name, email, body, optional subject Base Info code. Operator triage only. Not a CRM lead and not a feedback ticket (\`base_app_feedback\`).

## Lifecycle

1. **Submit** — public/designer POST creates one row; audit timestamps set by the server.
2. **Triage** — operators read in Studio / Logs-adjacent contact UI. There is no status machine and no assignee column in v1.
3. **Close** — delete or ignore; there is no "resolved" flag. Prefer export/archive policy over rewriting the body.

## Rules

- \`type\` stores a Base Info subject id under the platform contact taxonomy (\`100.3.*\`), not free text.
- No threading and no replies on this table — one row per submission.
- PII (name, email, body) — restrict Data API projections and export accordingly.
- Do not promote a row into CRM by copying identity here; create a real \`base_users\` + package extension if the person becomes a customer.`,

  base_ai_chat_sessions: `## Purpose

Persisted AI chat sessions per user — title, model, serialized messages JSON, token totals, optional agent capability scope. Powers Chat History panel and session resume.

## Lifecycle

1. **Start** — empty \`messages_json\`, counters zero.
2. **Append turns** — server updates \`messages_json\`, \`message_count\`, token totals, \`updated_at\`.
3. **Soft delete** — \`deleted_at\` set; hidden from user history, retained for admin audit.

## Rules

- Owned by \`user_id\` — users see only their sessions unless admin Chat History function.
- \`agent_capability_scope_json\` snapshots tool/page scope at session start.
- Traces and apply snapshots hang off session id optionally.`,

  base_ai_agent_traces: `## Purpose

Fine-grained agent iteration log — tool calls, policy decisions, durations, errors per chat turn. Diagnostic complement to \`messages_json\` in sessions.

## Rules

- Ordered by \`session_id\` + \`iteration\` when session linked.
- Append-only during agent run — no operator edit.
- May omit full args — \`args_hash\` for dedup/forensics; sensitive args not stored verbatim.`,

  base_ai_agent_apply_snapshots: `## Purpose

Point-in-time snapshots when user **applies** an agent code-change proposal — stores change sets + file snapshots for rollback. Tied to \`proposal_id\` from agent runtime.

## Rules

- \`rolled_back_at\` set when operator undo succeeds — both states kept for audit.
- Large JSON in \`change_sets_json\` / \`snapshots_json\` — not for grid listing unbounded.
- Cascade with session when session deleted.`,

  base_app_feedback: `## Purpose

Operator feedback/ticket inbox — bug reports, suggestions, portal context capture. Threaded conversation via \`base_app_feedback_messages\`; routing via assignee user/role fields.

## Lifecycle

1. **Submit** — status \`NEW\`, optional anonymous contact JSON when user not logged in.
2. **Route / claim** — assignee or role routing; \`claimed_by_user_id\` for operator lock.
3. **Resolve / duplicate** — terminal statuses; \`duplicate_of_id\` links merged tickets.

## Rules

- \`type\` = Base Info subject code (\`100.3.*\` taxonomy) — column name kept as \`type\`.
- \`message_count\` / \`last_message_at\` denormalized from messages — update in service layer.
- Portal context (\`portal_slug\`, \`page_key\`, \`route\`) captured at submit for repro.`,

  base_app_feedback_messages: `## Purpose

Individual messages on a feedback ticket — user or operator replies. \`kind\` distinguishes public reply vs internal note.

## Rules

- Always tied to \`feedback_id\`; cascade delete with ticket.
- Attachments optional via \`base_app_feedback_attachments.message_id\`.
- Append-only — edits rare; prefer new message row.`,

  base_app_feedback_attachments: `## Purpose

File attachments for feedback tickets or specific messages. Metadata + \`storage_key\` pointer to file-manager blob — bytes not in DB row.

## Rules

- Either \`feedback_id\` and/or \`message_id\` set — staged uploads use \`staged_session_key\` until commit.
- \`uploaded_by_user_id\` for audit; size/mime validated at upload API.
- Deleting message cascades message-linked attachments per FK rules.`,

  base_app_feedback_read_cursors: `## Purpose

Per-user read position on a ticket — \`last_read_message_id\` for unread badges in operator inbox. Composite PK (\`feedback_id\`, \`user_id\`).

## Rules

- Upsert on view — monotonic advance of cursor only.
- Cascade delete with ticket; user FK for assignee/subscriber views.`,

  base_user_notifications: `## Purpose

In-app notification inbox per user — title, body, severity, optional deep-link \`href\`, read cursor. \`dispatchNotification\` writes here when the user's preference for that \`eventType\` is \`IN_APP\` (the default) or when EMAIL send fails and falls back. The shell bell uses \`/api/notifications/unseen-count\` and \`bell-seen\`; list read state uses \`read_at\`. Channel history and EMAIL/digest outcomes live in \`base_user_message_dispatches\` (Messages page).

## Lifecycle

1. **Dispatch** — producers (workflow notify, escalation, comment mention) call \`dispatchNotification\`. No preference row ⇒ \`IN_APP\` + immediate.
2. **Seen (bell)** — \`seen_at\` stamped when the shell bell opens (\`POST /api/notifications/bell-seen\`). Badge uses unseen (\`seen_at\` null), not unread.
3. **Read** — \`read_at\` stamped by mark-one / mark-all. \`read_at\` null = unread in the list.
4. **EMAIL path** — immediate EMAIL does **not** insert here (unless fallback). \`EMAIL\` + \`digest: true\` queues \`base_user_notification_digest_items\` instead.

## Rules

- Owned by \`user_id\` — cascade delete with the user.
- \`source\` is the event-type key (\`workflow\`, \`workflow.escalation\`, \`workflow.comment\`, …) — same key as \`base_user_notification_preferences.event_type\`.
- \`metadata_json\` is producer-private evidence, not operator-edited.
- Do not use this table as a chat transcript, digest queue, or feedback ticket thread.`,

  base_workflow_definitions: `## Purpose

Workflow **design-time** header — stable \`(scope_key, key)\`, draft JSON, lifecycle (DRAFT/PUBLISHED/…), pointer to current published revision. Designer and runtime both anchor here.

## Lifecycle

1. **Draft edit** — \`draft_definition_json\` + increment \`draft_version\` on save.
2. **Validate / publish** — creates \`base_workflow_revisions\` row; may update \`current_published_revision_id\`.
3. **Unpublish / archive** — lifecycle transition without deleting historical revisions.

## Rules

- **UNIQUE** (\`scope_key\`, \`key\`) — \`scope_key\` isolates tenant/package definitions (\`global\` default).
- Published runtime always pins a **revision id**, never mutable draft JSON.
- Fork/clone tracked via \`created_from_*\` + \`creation_mode\`.`,

  base_workflow_revisions: `## Purpose

Immutable published snapshot of a workflow — frozen \`definition_json\`, action bindings, semantic fingerprint, validation report link. Instances execute against a revision row, not live draft.

## Rules

- **UNIQUE** (\`workflow_definition_id\`, \`revision_number\`) monotonic per definition.
- \`publication_status\` / \`binding_status\` gate whether instances may start.
- Do not mutate JSON in place after publish — new revision for changes.
- \`schema_projections_json\` optional Data API hints — derived at publish.`,

  base_workflow_instances: `## Purpose

Single workflow **run** — bound to one revision, carries input/context/output JSON, status machine (CREATED → RUNNING → terminal). Parent of all runtime child rows for that execution.

## Rules

- Always references \`workflow_revision_id\` — cannot retarget mid-flight.
- \`started_by_type\` / \`started_by_id\` record manual API, schedule, webhook, or subflow parent.
- \`state_version\` optimistic concurrency — engine increments on transition.
- Terminal instances retain traces/work items for audit.`,

  base_workflow_node_instances: `## Purpose

One row per **semantic node occurrence** inside an instance — execution state, branch/join metadata, lease fields for worker claim, next eligible time for retries/delays.

## Rules

- **UNIQUE** (\`workflow_instance_id\`, \`semantic_node_key\`) — one occurrence key per instance.
- Status drives scheduler scans (\`PENDING\`, \`RUNNING\`, \`WAITING\`, …).
- \`lease_owner_id\` / \`lease_expires_at\` — only holder may complete attempt.
- Parallel/join: \`branch_token_id\`, \`join_group_key\`, \`selected_incoming_edge_key\`.`,

  base_workflow_execution_attempts: `## Purpose

Action invocation attempts for a node — idempotency key, provider selection, deadlines, error class/code, result metadata. Supports retry with increasing \`attempt_number\`.

## Rules

- **UNIQUE** (\`node_instance_id\`, \`attempt_number\`).
- \`logical_invocation_id\` groups retries of same semantic invocation.
- Terminal attempt states stop scheduler re-entry unless policy retries.
- Links to traces/dead-letters for failure forensics.`,

  base_workflow_waits: `## Purpose

Active wait primitives owned 1:1 by a node instance — timer (\`due_at\`), correlation event, subflow child instance, or linked work item. Satisfying wait resumes node.

## Rules

- **UNIQUE** \`owning_node_instance_id\` — one wait row per waiting node.
- Event waits index \`event_name\` + \`correlation_value_hash\` for inbox matcher.
- \`child_instance_id\` for SUBFLOW; \`work_item_id\` for human task gates.
- \`status\` ACTIVE until satisfied/cancelled/timeout.`,

  base_workflow_event_inbox: `## Purpose

Durable ingress for external/async events — webhooks, bus messages, manual inject. Deduped by (\`event_source_identity\`, \`deduplication_key\`); correlation hash matches waiting nodes.

## Rules

- Processed inbox rows set \`processed_at\` + terminal \`status\`.
- Lease fields for worker claim during fan-out to waits.
- Payload JSON may be redacted in traces — classify appropriately.`,

  base_workflow_branch_tokens: `## Purpose

Parallel branch fan-out token — groups sibling node instances spawned from a split gateway. Join logic counts arrivals per token/group.

## Rules

- Owned by \`workflow_instance_id\`.
- Referenced from node instances via \`branch_token_id\`.
- Deleted/archived with instance lifecycle — not reused across instances.`,

  base_workflow_join_arrivals: `## Purpose

Records arrival of a branch at a join gateway — one row per (join node, branch token, upstream node) combination. Join fires when policy threshold met.

## Rules

- Tied to instance + node instance + branch token.
- Append-only during parallel execution — engine dedupes replays.
- Incorrect arrivals surface as stuck join — use simulation/dead-letter tools.`,

  base_workflow_dead_letters: `## Purpose

Operator recovery queue for unhandled action/instance failures (WFV2-12). One OPEN row per failing node occurrence — separate from work items to preserve 1:1 human-task invariant.

## Rules

- **UNIQUE** \`node_instance_id\` while open — park once per broken occurrence.
- Resolve/discard via operator UI/API with \`resolution_note\`.
- Stores error evidence JSON — may link \`attempt_id\`.`,

  base_workflow_traces: `## Purpose

Append-only execution audit timeline per instance — ordered \`sequence_number\`, trace type, actor, core evidence JSON. Powers workflow run history / debug views.

## Rules

- **UNIQUE** (\`workflow_instance_id\`, \`sequence_number\`).
- \`data_classification\` gates verbose diagnostic payload exposure.
- Insert-only from engine — never rewrite history.`,

  base_workflow_simulation_runs: `## Purpose

Designer **simulation** executions against draft or revision snapshot — fixture-driven dry run without creating production side effects. Tracks mode, scenario, fingerprint, result summary.

## Rules

- Source XOR: exactly one of \`source_draft_version\` or \`source_revision_id\` populated (repository enforced).
- \`fixture_set_fingerprint\` + \`simulation_resolved_snapshot_fingerprint\` identify reproducible runs.
- Terminal \`status\` + \`completed_at\` — result in \`result_summary_json\`.
- Does not replace live \`base_workflow_instances\` metrics.`,

  base_workflow_validation_reports: `## Purpose

Structured validation output from publish/simulate pipeline — errors/warnings against draft or revision. Linked from revision row when publish blocked or advisory.

## Rules

- Immutable after creation — new validation → new report row.
- Referenced by \`base_workflow_revisions.validation_report_id\`.
- JSON payload interpreted by designer UI — schema version in engine.`,

  base_workflow_designer_views: `## Purpose

Persisted canvas layout per definition/revision — node positions, zoom, lane grouping for Workflow Designer. Cosmetic only; does not affect runtime semantics.

## Rules

- Scoped to definition + optional revision — designer picks active view.
- Safe to delete/regenerate — runtime unaffected.
- JSON blob — not queried by execution engine.`,

  base_workflow_secret_references: `## Purpose

Named secret **references** for workflow actions — stores vault key/handle, not plaintext secret. Resolved at action runtime via secret provider.

## Rules

- Scoped to workflow definition scope — rotate secrets in vault, update reference row.
- Never store raw secret material in \`definition_json\` or this table.
- Audit \`created_by\` on reference creation.`,

  base_workflow_webhook_bindings: `## Purpose

One active webhook entry endpoint per workflow definition — \`secret_hash\` (sha256 of raw token) is lookup key for \`POST /api/workflow-hooks/:token\`. Rotating regenerates hash in place.

## Rules

- **UNIQUE** \`workflow_definition_id\` — at most one binding row.
- \`workflow_revision_id\` pins which revision starts on hook fire.
- \`enabled\` toggle without deleting binding.
- Old hash stops matching immediately after rotate.`,

  base_workflow_vector_documents: `## Purpose

Embedding index for workflow designer/runtime retrieval — one row per \`(collection, document_key)\` with text, embedding JSON, and optional metadata. Not a workflow instance; used by vector search over definitions/docs.

## Rules

- **UNIQUE** (\`collection\`, \`document_key\`).
- \`embedding_json\` is the stored vector — regenerate on text change, do not hand-edit.
- Safe to rebuild the collection from source documents; rows are a cache, not the contract.
- Keep package/domain documents out of this table unless the workflow engine owns them.`,

  base_work_items: `## Purpose

Human task inbox rows — 1:1 with a waiting node instance when assignment policy creates operator work. Claim, outcome, priority, allowed outcomes JSON for task UI.

## Lifecycle

1. **Open** — created by engine when node enters human task state.
2. **Claim** — \`claimed_by_user_id\` + timestamp; may enforce role/scope.
3. **Complete** — \`outcome\` + \`output_json\` satisfies wait and resumes workflow.

## Rules

- **UNIQUE** \`node_instance_id\` — preserves human-task invariant vs dead letters.
- Inbox sort: status + priority + created_at (indexed).
- Escalations tracked in \`base_work_item_escalations\`; history in \`base_work_item_transitions\`.`,

  base_work_item_transitions: `## Purpose

Append-only state change log for a work item — from/to status, transition type, actor, reason, evidence JSON, post-transition state version.

## Rules

- Insert-only on claim/release/complete/escalate events.
- \`work_item_state_version_after\` matches optimistic lock on parent row.
- Indexed by work item + time for ticket timeline UI.`,

  base_work_item_escalations: `## Purpose

Escalation policy execution steps for stalled work items — timed nudges, reassign, notify. **UNIQUE** (\`work_item_id\`, \`policy_step_key\`, \`execution_number\`) replay fence.

## Rules

- \`action_type\` interpreted by escalation runner — not freeform operator edit mid-flight.
- Terminal \`status\` + \`completed_at\` per execution.
- Evidence JSON for audit when action fires.`,

  base_user_notification_preferences: `## Purpose

Per-user, per-event-type channel preference for \`dispatchNotification\`. Absence of a row means the untouched default: \`IN_APP\` + immediate. Opt-in only — existing users do not change behavior until they set a preference.

## Lifecycle

1. **Default** — no row. Inbox write to \`base_user_notifications\`.
2. **Set** — upsert \`(user_id, event_type)\` with \`channel\` \`IN_APP\` | \`EMAIL\` and \`digest\` boolean (self-service \`/api/notifications\` preference APIs).
3. **EMAIL immediate** — send now; on SMTP/address failure fall back to IN_APP.
4. **EMAIL + digest** — queue \`base_user_notification_digest_items\`; do not send now and do not write the inbox.
5. **Delete preference** — revert to IN_APP / immediate.

## Rules

- **UNIQUE** (\`user_id\`, \`event_type\`). \`event_type\` matches notification \`source\` (\`workflow\`, \`workflow.escalation\`, …).
- \`digest\` is meaningful only with \`EMAIL\`. IN_APP + digest is not a supported combination.
- Not an inbox and not a send log — do not store titles/bodies here.`,

  base_user_notification_digest_items: `## Purpose

EMAIL+digest queue. When preference is \`channel: EMAIL\` and \`digest: true\`, \`dispatchNotification\` inserts here instead of sending immediately or writing the in-app inbox. The workflow engine worker tick runs \`scanAndSendDueNotificationDigests\`.

## Lifecycle

1. **Queue** — insert with \`sent_at\` null. \`source\` is the event type; \`metadata_json\` is producer evidence.
2. **Clock** — a user's digest window starts at their **oldest** pending \`created_at\` (no separate last-sent column). Default interval is 24 hours.
3. **Send** — when due, every currently-pending item for that user is batched into one summary email; those rows get \`sent_at\`.
4. **Retry** — send failure (no email, SMTP error) leaves rows pending for the next scan.

## Rules

- Not the in-app inbox (\`base_user_notifications\`) and not a preference row.
- Requires \`base_users.email\`; missing address fails the send and keeps items pending.
- Do not hand-edit \`sent_at\` in Studio — the scanner owns that stamp.
- Cascade delete with the user. Safe to purge old sent rows under retention policy.`,

  base_user_message_dispatches: `## Purpose

MSGI **outbound dispatch ledger** per user — one row per channel attempt from \`dispatchNotification\` (IN_APP, EMAIL, digest pending, fallback). Powers **Messages** (\`/studio/my-messages\`) and retention family \`userMessageDispatches\`. Not the live in-app bell (\`base_user_notifications\`) and not workflow work items.

## Lifecycle

1. **Write** — \`dispatchNotification\` inserts with \`correlation_id\`, \`event_type\`, \`channel\`, \`delivery_status\`, title/body summary, optional \`href\`, \`in_app_notification_id\` when IN_APP succeeded.
2. **Digest** — EMAIL+digest queues as \`digest_pending\`; scanner sets \`sent\` + shared \`digest_batch_id\`.
3. **EMAIL failure** — failed EMAIL row + \`fallback_in_app\` IN_APP row when inbox fallback runs.
4. **Retention** — hot rows older than Settings → Logs age offload/delete by \`created_at\` (scope \`recordEvents\` job).

## Rules

- **UNIQUE** (\`user_id\`, \`correlation_id\`, \`channel\`) — idempotent per dispatch call/channel.
- Auth OTP/reset/verify email **must not** create rows (shard \`user-message-inbox\`).
- Recipient-only APIs — no ADMIN cross-user browser in v1.
- Sequelize control-plane table — not Prisma.`,

  base_idea_cards: `## Purpose

Earlier Idea Foundry **review-queue** card: a proposed idea with title, markdown brief (\`raw_description_md\`), kind, package origin, and a review status. The live Idea Foundry board (\`/studio/idea-foundry\`, \`/api/idea-foundry\`) now persists to \`base_product_ideas\`. This table is the older intake shape still imported in Data Studio and listed on the Idea Foundry platform API inventory.

## Lifecycle

1. **Submit** — \`initiator_id\` creates a card; \`status\` is the review state (not Idea Foundry maturity).
2. **Review** — optional \`review_work_item_id\` points at a human task on \`base_work_items\`.
3. **Merge** — \`merged_into_idea_id\` points at the surviving card; merged cards leave the active backlog.
4. **Park / kill** — write \`park_or_kill_reason_md\` and move \`status\`; do not delete history.

## Rules

- \`package_origin\` / \`package_slug\` / \`package_ref\` classify package home — not an FK to a package install row.
- \`tags_json\` is a JSON label array, not a junction table.
- Do not store current board fields (importance, scale, maturity, front/back office, team) here — those live on \`base_product_ideas\`.
- Prefer the product-ideas table for new Idea Foundry work.`,

  base_product_ideas: `## Purpose

Current Idea Foundry persistence. One row is a product idea on the board: title, description, icon, importance, scale, maturity, target (new vs existing package), optional package/section home, front/back office notes, and team JSON. Edited at \`idea-foundry/edit/{id}\`.

## Lifecycle

1. **Create** — UUID \`id\`; maturity usually \`defining\`. English operator copy only.
2. **Shape** — move maturity \`defining\` → \`cooking-idea\` → \`in-production\` → \`ready-to-use\`. Importance/scale are priority and size, not status.
3. **Place** — \`target_kind\` \`new-package\` | \`existing-package\`; existing package uses \`package_id\` plus \`section_key\` (or whole-package sentinel).
4. **Staff** — \`decision_maker\`, \`collaborators\`, and \`team_models\` are JSON text parsed by idea-foundry contracts.

## Rules

- \`note\` is operator remark (data-model note vs description). \`description\` is the idea brief.
- Not a project tracker, CRM opportunity, or work item — Tasks/CRM/Workflow own execution.
- Do not write this table through Prisma; Sequelize \`base_product_ideas\` is the contract.`,

  base_workbooks: `## Purpose

Personal spreadsheet workbooks under Records → Workbooks. \`sheets_json\` is the UiSpreadsheet document. Owned by \`owner_user_id\`.

## Lifecycle

1. **Create** — UUID \`id\`, name required, empty or seeded sheet JSON, owner = session user.
2. **Edit** — replace \`sheets_json\` on save; \`note\` is operator documentation only.
3. **Delete** — hard-delete the workbook row; not shared across users in v1.

## Rules

- One owner per row — not a multi-user collab document.
- Do not store connection strings, secrets, or control-plane credentials in sheets.
- Legacy columns \`kind\` / \`binding_json\` were dropped — do not reintroduce.`,

  base_sample_mock_records: `## Purpose

Living-sample **header** for Base Components → CRUD Set (\`GET/POST/PATCH/DELETE /api/sample-mock/records\`). Demo data only — every relation kind and cell kind the wizard must show. Not a business entity.

## Lifecycle

1. **Create** — unique \`code\`, title, required \`status_id\`; optional parent, owner, geo, detail city/note, tags, comments. Adjacent create + bulk create exist on the sample API.
2. **Edit** — patch title/status/owner/parent/geo/active and nested detail/tags/comments through the same records API (not by editing child tables as the source of truth).
3. **Approve** — \`PATCH .../approve\` stamps \`approved_at\` / \`approved_by\` and typically moves status to \`approved\`.
4. **Lock / unlock** — \`PATCH .../lock\` toggles \`locked\` with audit timestamps (CRUD Set boolean-toggle cousin of Users Lock).
5. **Delete** — cascades details, comments, and tag links; parent FK on children becomes SET NULL.

## Rules

- \`parent_id\` is a self-tree (ON DELETE SET NULL). \`status_id\` belongsTo \`base_sample_mock_statuses\`. \`owner_id\` belongsTo \`base_sample_mock_people\`.
- \`latitude\` / \`longitude\` drive the map body in the living sample.
- Seed only with control-plane reference data. Do not treat rows as production records.`,

  base_sample_mock_statuses: `## Purpose

Lookup catalog of lifecycle labels for \`base_sample_mock_records.status_id\` (Open, Approved, …). Seeded for the CRUD Set living sample — not platform Base Info.

## Rules

- \`code\` is unique (\`open\`, \`approved\`, …). \`sort_order\` is the picker order (\`GET /api/sample-mock/lookups\`).
- Approve action on records expects the \`approved\` code to exist.
- Do not replace this with \`base_info\` for the sample; the living sample must stay self-contained.`,

  base_sample_mock_details: `## Purpose

1:1 extension of a sample-mock record — \`city\` + \`note\`. Demonstrates CRUD Set **hasOne** include (toggling the include hides the column and the create/edit fields).

## Rules

- **UNIQUE** \`record_id\`. Cascade delete with the record.
- Written through \`/api/sample-mock/records\` (\`city\`, \`detailNote\`), not as a standalone business API.
- \`note\` is the sample remark field (data-model note vs description).`,

  base_sample_mock_record_tags: `## Purpose

Composite junction for sample-mock **belongsToMany** tags. PK = (\`record_id\`, \`tag_id\`). There is no surrogate id.

## Rules

- Cascade delete when either the record or the tag is removed.
- Tag vocabulary is \`base_sample_mock_tags\` (slug + title), not Base Info.
- The records API replaces the set on patch; do not maintain a second write path in Studio unless you are debugging the junction.`,

  base_sample_mock_people: `## Purpose

Demo people lookup for sample-mock \`owner_id\` and comment \`author_id\`. Not \`base_users\` — the living sample must not depend on real login accounts.

## Rules

- \`username\` unique. \`display_name\` is the picker title.
- Owner FK on records is ON DELETE SET NULL; comment author is the same.
- Seeded reference data only.`,

  base_sample_mock_tags: `## Purpose

Demo tag vocabulary for the sample-mock belongsToMany. \`slug\` unique; \`title\` is the chip label.

## Rules

- Junction rows live in \`base_sample_mock_record_tags\`.
- Deleting a tag cascades its junction rows, not the records.
- Not a Base Info tree.`,

  base_sample_mock_comments: `## Purpose

Demo **hasMany** comments on a sample-mock record — body + optional \`author_id\` (a sample person). Shows a related list on the living sample, not a CMS/CRM thread.

## Rules

- Cascade delete with the record. Author SET NULL if the person is removed.
- Written through the records API \`comments\` payload when the include is on.
- Not moderation, not public comments.`,

};

export const BASE_STUDIO_META_OBJECT_NAMES = Object.keys(BASE_STUDIO_META_STORIES).sort();
