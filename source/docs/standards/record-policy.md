# Record Policy

> **Shard:** `record-policy`  
> **Specs:** `specs/record-policy/`

## Capability vs Scope

- **Capability** (`FunctionAccessControl` on each Data API / page): may the principal **call** this function?
- **Scope** (Record Policy Engine): **which rows** may they see or change **after** that call is allowed?

Both required: `can = Capability AND Scope`. Scope never grants a call that Access Control denied. Record scope is not a second API ACL.

## Defaults (PO)

- Models default `recordScope: off`.
- **Off:** engine off. Saved policies are not applied. Every row, every query.
- **On:** engine on. The policy tree filters **every** list / get / lookup / create / update / patch / delete on the model.
- **On with no policies:** treated like Off (every row) and shown as an incomplete-setup warning on the modeler Record Policies summary (not in the Configure dialog).
- Scope is the same set of rows for every operation. A record that is out of list scope cannot be get / patch / delete by id (404). Create payload must satisfy the tree.
- ADMIN bypasses **row filters** by default; per-model `forceScopeForAdmin` opts out. ADMIN still needs API Access Control to invoke the APIs.
- Per-operation escape hatch: `bypassRecordPolicy` on a Data API operation (Skip record scope). Access Control on that API still applies.
- Out-of-scope get/update/delete ⇒ **404**; empty list is not an error.
- Multi-membership per dimension is allowed (org/geo/…).

## Authoring

- Policies: `workspace/record-policies/`
- Bindings: `workspace/record-policy-bindings/{edgeModelId}.json` (`recordScope`, `forceScopeForAdmin`, `policyTree`)
- Built-in dimensions only: `org`, `geo` (always on; roots from org-geo / Base Info constants)
- Memberships: Prisma `base_scope_memberships` (user↔node) and `base_scope_role_memberships` (role↔node) — projected into **server session context** as `scope.org` / `scope.geo`
- Predicate value refs use **serverContext keys only** (`user.*`, `role.*`, `sys.*`, `scope.*`) — never `clientContext`, never legacy `session.*`
- Multiple policies combine in an AND/OR **tree** (`policyTree` on the binding). Missing tree ⇒ AND of every policy on the model.

## Studio

- Record Policies: Data Studio modeler **summary** on the main scroll; authoring in a maximized dialog from the section-header **Configure** button. Dialog: On/Off + ADMIN checkbox + policy tree. No per-action checkboxes. Refs pick from Session Context server keys.
- Skip record scope: checkbox on the Data API Runtime tab; amber **Skip scope** badge on the APIs summary.
- People / role assignment: Organization Chart / Geographic Divisions inspectors
- Session scope unions user memberships with role↔node memberships (into server context)
- Explain API: `GET /api/record-policy/explain?edgeModelId=&action=list` (ADMIN, debug — not shown in Studio UI)

## Packages

Packages may export/import `record_policies` and `record_policy_bindings` with Edge data export/install. Built-in dimensions are platform-native (not packaged). **Memberships are never packaged** (environment staffing).

## Predicate

Closed AST only — no raw SQL/JS. Ops and refs: see `src/shared/api/contracts/record-policy/`. Value refs resolve from `serverContext`. Membership is binary (user ↔ node); platform **Roles** remain the only role concept (principals + `sys.roles`).

## Enforcement

Data API executor merges `policyWhere AND defaultWhere AND userFilter`. Server functions must call `assertRecordInScope` / `buildScopeWhere` when bypassing Data API. Out-of-scope denials emit an optional security log (`RecordPolicy` context).

## Hard tenancy

Logical row filtering only — see [`specs/record-policy/05-hard-tenancy.md`](../../specs/record-policy/05-hard-tenancy.md). Deferred share / timed membership / include-leak: [`06-deferred-backlog.md`](../../specs/record-policy/06-deferred-backlog.md).

**IDs:** `platform.record-policy.capability-vs-scope`.
