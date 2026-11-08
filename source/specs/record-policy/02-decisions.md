# Record Policy Engine — Decisions (D1–D12)

> **Plan:** [`docs/standards/record-policy.md`](../../docs/standards/record-policy.md)  
> **Domain:** [`01-domain.md`](./01-domain.md)  
> **Phase:** RPE-0-2  
> **Status:** Frozen (D7 PO-confirmed 2026-08-12 — RPE-0-5)  
> **Created:** 2026-08-11  
> **Last updated:** 2026-08-12  
> **Code:** none in this task

---

## How to read this document

Each decision is **Frozen**. D7 was confirmed by PO on 2026-08-12 (RPE-0-5).

Format: **Decision** · **Rationale** · **Rejected alternatives** · **Implications** · **Depends on**.

Code facts that drove freezes (as of 2026-08-11):

- Edge models/APIs: workspace JSON stores (`workspace/edge-models/`, `workspace/edge-apis/`) — `edgeModelStore` / `edgeApiStore`
- `BaseScopeMembership` / `BaseScopeMembershipEvent` already exist in `prisma/schema.prisma`; `nodeId` is a Base Info id string (no FK); no `src/` service usage yet
- Session context merges user/role/profile attrs as `user.{key}` / `role.{key}` — `sessionContext.service.ts`
- Data API list merges `defaultWhere` via shallow object spread; get/update/delete by id do **not** apply `defaultWhere` today — `dataApiExecutor.ts`
- Response cache supports `cacheByUser` via `buildEdgeResponseCacheKey` — `dataApiRuntimePolicy.ts`
- Edge model identity: `id` + `objectName` (no model `key`); API `key` is on `EdgeApiDefinition` only
- Package edge export/install already exists (`packageEdgeDataExport.service` / `packageEdgeDataRuntime.service`)

---

## D1 — Policy (+ binding metadata) storage

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | Store **RecordPolicy** definitions and **per-model scope bindings / recordScope flags** as **workspace JSON** (Edge-store pattern: `index.json` + `{id}.json`, atomic write + lock), with an **in-memory/request cache** in the RPE service layer. Do **not** persist policies only as Prisma rows without files. |
| **Suggested paths (RPE-0-4 may refine names)** | `workspace/record-policies/` · optional `workspace/record-policy-bindings/` **or** bindings embedded on EdgeModel studio-meta / side-car JSON keyed by `edgeModelId` |

**Rationale**

- Matches EdgeModel/EdgeApi greenfield definition workflow (file-backed, packageable, reviewable in git).
- Policies are authoring artifacts like APIs, not high-churn transactional rows.
- Enables D9 package export without inventing a second packaging story.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Prisma-only `base_record_policies` without workspace files | Diverges from Edge definition pattern; harder package/git workflow |
| Embed full policy AST only inside each `EdgeApiDefinition` | Same model can have many APIs; policy is **model-scoped**, not API-scoped; would duplicate and drift |
| Server-function JS files as policies | Requires coding; violates “no per-project code” goal |

**Implications**

- RPE-1 schemas must serialize to JSON stably.
- Invalidation: bump cache when policy/binding files change (mirror session/edge invalidation patterns).

**Depends on:** Edge store conventions · D9 · D10

---

## D2 — Dimension nodes

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | **Dimension nodes are Base Info records.** `dimensionKey` selects which Base Info subtree/category (or registered root) acts as that dimension. Topology `tree` uses Base Info parent/child; `flat` uses a Base Info category treated as a flat set. **Do not** create a parallel `base_scope_nodes` table in v1. |

**Rationale**

- Schema for `BaseScopeMembership.nodeId` is already documented as Base Info id (string), aligned with org/geo intent.
- Base Info already provides tree UX, package vocabulary patterns, and APIs (`docs/standards/package-base-info-vocab.md`, `pageKey: base-info`).
- Avoids dual hierarchies (Base Info vs scope nodes) and duplicate CRUD.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| New `base_scope_nodes` generic table | Duplicates Base Info; schema comment already points at Base Info |
| EdgeModel rows as nodes for every dimension | Overkill for org/geo catalogs; Base Info is the platform catalog tree |
| Ad-hoc JSON node files only | Weak querying, no shared Studio tree, poor membership integrity |

**Implications**

- Dimension **definition** (key, label, topology, base-info root/category pointer) still needs a small registry — prefer workspace JSON (with D1) or a thin settings doc; not full node rows.
- `inSubtree` expands via Base Info parent links (algorithm in RPE-3).
- Tenant preset: Base Info category/root for tenants **or** a documented convention under a system root — detail in RPE-3/RPE-9, not a second node engine.

**Depends on:** Base Info · D3

---

## D3 — Memberships

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | Use existing Prisma models **`BaseScopeMembership`** (`base_scope_memberships`) and **`BaseScopeMembershipEvent`** for **user↔node**, plus **`BaseScopeRoleMembership`** / **`BaseScopeRoleMembershipEvent`** for **role↔node**. Fields: user or role, `dimensionKey`, `nodeId` (Base Info id). Unique `(userId|roleName, dimensionKey, nodeId)`. **No `roleInNode`** — membership is binary; SessionScope unions user memberships with memberships of the user’s roles. |

**Rationale**

- Tables already exist for exactly this purpose; greenfield means **use them**, not invent a second membership store.
- Control-plane transactional data (who belongs where) fits Prisma/`base_*`, unlike authoring policies (D1).
- Audit events table supports assign/remove/role changes without bolting audit onto workspace JSON.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Membership only in workspace JSON | Poor multi-user concurrency; not aligned with user lifecycle (user delete cascade already on Prisma) |
| New table with different shape | Unnecessary migration/churn while empty schema already matches |
| Role-only membership without user rows in v1 | Insufficient for real org assignment; role-default can be v1.1 |

**Implications**

- RPE-3 implements the first `src/` services/repos over these tables.
- SessionScope resolver (RPE-2) loads memberships by `userId` (+ expand subtree for tree dimensions).
- Invalidate `session:ctx:{userId}` (and any RPE scope cache) on membership writes.

**Depends on:** D2 · session context cache

---

## D4 — Session attributes for predicate refs

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | Predicate `session.user.<attrKey>` resolves only against an **explicit allowlist** of keys drawn from: (1) keys present in `sessionContext` **server** map under `user.*` (profile + user attributes), and (2) optional RPE allowlist config. Map DSL refs as: `session.userId` → auth user id; `session.user.<attrKey>` → `user.<attrKey>` in server context; `session.roles` → role keys array; `session.scope.<dimensionKey>` → resolved id set from memberships (RPE-2), **not** from legacy attribute bags alone. |

**Rationale**

- `sessionContext.service` already builds `user.*` / `role.*` with visibility split — reuse, don’t fork attribute loading.
- Allowlist prevents policies from binding to arbitrary/internal keys and keeps Rule Builder enumerable.
- Scope sets must come from memberships (D3), not from free-form attributes named `org`, to avoid two sources of truth.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Any key in JWT/profile without allowlist | Surprising exposure; unstable Rule Builder |
| Client context keys in compiler | Client context is not a trust boundary |
| Encode org membership only as user attributes | Bypasses D3; breaks subtree expansion |

**Implications**

- RPE-2 may extend session payload with a dedicated `scope` object for compilers while keeping attribute merge as today.
- Gender-style policies use profile fields already available (e.g. gender via profile/attrs once allowlisted).

**Depends on:** `sessionContext.service` · D3

---

## D5 — Compiler output shape

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | Compiler emits Sequelize **`WhereOptions`** (and/or an intermediate filter bag that **only** feeds `buildWhereFromFilter` / shared helpers in `dataApiQuery.ts`). Single code path into Data API queries. Prefer `Op.and` arrays when combining policy, defaultWhere, and user filters — **do not rely on shallow key spread** for security merges. |

**Rationale**

- Executor already centers on `buildWhereFromFilter` + `WhereOptions`.
- Shallow spread of `defaultWhere` today can overwrite keys and is insufficient for boolean policy trees (`or` of allows).
- One path reduces drift between list and assert-in-scope.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Raw SQL strings from policies | Forbidden by domain N3; injection risk |
| Separate query DSL only for RPE | Dual stacks with Data API filters |
| Client-side filter JSON as sole enforcement | Not a security boundary |

**Implications**

- RPE-4/RPE-5 should introduce a small `mergeWhereAnd(...)` helper used by executor.
- Golden tests compare WhereOptions / Op trees, not SQL text.

**Depends on:** `dataApiQuery.ts` · D6

---

## D6 — Relationship to `defaultWhere`

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | Keep `EdgeApiDefinition.defaultWhere` for **static, non-principal** constraints. Runtime merge: **`Op.and(policyWhere, defaultWhere, userFilterWhere)`** (order documented; all required). Document that per-user/tenant/org rules belong in Record Policies, not `defaultWhere`. **RPE enforcement applies to list and to get/update/delete/create** on scoped models — closing today’s gap where `defaultWhere` is list-only. |

**Rationale**

- Preserves existing SEA escape hatch without overloading it into a policy engine.
- List-only `defaultWhere` is a known hole for IDOR via get-by-id; RPE must not inherit that hole.
- Clear operator guidance reduces misuse.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Remove `defaultWhere` in v1 | Breaks existing definitions; unnecessary |
| Treat `defaultWhere` as per-user by substituting session tokens inside it | Reinvents RPE poorly; harder to validate |
| Policy only on list | Leaves IDOR on get/update/delete |

**Implications**

- RPE-5 checklist must cover all CRUD ops, not only list.
- Migration guide: move tenant-ish `defaultWhere` examples into policies (doc in RPE-5/RPE-9).

**Depends on:** D5 · Data API executor

---

## D7 — ADMIN and scoped fail-closed

| Field | Value |
|-------|--------|
| **Status** | **Frozen (PO 2026-08-12)** |
| **Decision** | (1) Models mark `recordScope: 'off' \| 'required'` (name final in RPE-1). **Default is `off`** — page/API access shows every row until an allow policy matches. **`required` ⇒ fail-closed** (no applicable allow ⇒ deny-all / empty / not-found). (2) **ADMIN bypasses record scope by default**, matching capability bypass. (3) Per-model flag **`forceScopeForAdmin: boolean`** (default `false`) to keep ADMIN inside policies when needed (e.g. tenant demos). |

**Rationale**

- Fail-closed is the only safe default for “this model is segregated.”
- ADMIN bypass matches operator expectations from function ACL and speeds support; force-scope is the escape for strict tenancy demos.
- PO confirmed both behaviors 2026-08-12.

**Rejected**

| Option | Why rejected as default |
|--------|-------------------------|
| Fail-open when no policy on scoped model | Accidental full disclosure |
| Never bypass ADMIN for scope | Friction for platform admins; still available via `forceScopeForAdmin` |
| Global “all models scoped” | Too aggressive for platform/system models |

**Implications**

- Tests must include ADMIN bypass and force-scope cases.

**Depends on:** Domain evaluation rules · RPE-0-5

---

## D8 — Data API cache keys when policies apply

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | For any published Data API whose model has `recordScope: 'required'` **or** any applicable record policy for the request: response cache **must** set **`cacheByUser: true`** (force at publish/runtime if definition omitted it) **and** include a **stable hash of SessionScope dimension sets + compiled policy identity/version** (or compiled where hash) in the cache key namespace/tail — not userId alone. Writes continue to invalidate by `data-api:{definitionId}` prefix. |

**Rationale**

- `cacheByUser` exists but two users in the same “user bucket” mistake isn’t the issue — **same user with changed membership** or **different effective where** must not share entries; userId alone is insufficient when scope changes without user id change timing, and shared caches across users with same role would be worse without byUser.
- Actually primary leak risk is **missing cacheByUser** serving user A’s list to user B. Secondary is stale scope after membership change — hash + invalidation on membership updates.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Disable HTTP/response cache entirely for all Data APIs | Unnecessary perf hit for unscoped APIs |
| cacheByUser only, no scope hash | Stale allow after membership change until TTL |
| Cache ignore policies | Cross-principal data leak |

**Implications**

- Membership service must invalidate session + data-api caches appropriately (RPE-3/RPE-5).
- Publish path may coerce `runtime.cacheByUser` for scoped models.

**Depends on:** `dataApiRuntimePolicy` · D3 · D7

---

## D9 — Package portability

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | Packages **may** export/import: Dimension registry entries, RecordPolicies, model scope bindings / recordScope flags. **Memberships are environment data** — **not** exported as package install defaults (optional sample fixtures only under explicit seed flag). Reuse Edge package zip conventions (manifest capability flags, conflict ownership keys). |

**Rationale**

- Policies/bindings are part of the app definition (like Edge APIs); memberships are tenant/org staffing of a deployment.
- Edge export/install code already patterns zip + manifest capabilities.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Export all memberships in every package | Couples environments; privacy/ops hazard |
| No package support until v2 | Blocks CMS/CRM-style reusable isolation templates |

**Implications**

- New manifest capabilities e.g. `record_policies`, `scope_dimensions` (exact names in RPE-9).
- Ownership keys e.g. `record_policy::{id}`, `scope_dimension::{key}`.

**Depends on:** D1 · D2 · package edge services

---

## D10 — Canonical model identity

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | Record policies and bindings reference **`edgeModelId`** (`EdgeModel.id`, e.g. `em_…`) as the **canonical** foreign key. **`objectName`** is display / physical-table hint only and must be resolved through the model store. **Do not** use EdgeApi `key` as model identity. |

**Rationale**

- Store and package identity for models is `id`; there is no `EdgeModel.key`.
- API `key` identifies endpoints, not models; one model may have many APIs.
- `objectName` is not uniquely enforced in store today — unsafe as sole FK.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Plan draft “EdgeModel key” | Does not exist on the type |
| objectName-only references | Collision risk; rename fragility |
| Bind policies to EdgeApiDefinition.id only | Wrong grain (API vs model); gaps on other APIs for same model |

**Implications**

- Corrects domain/plan wording: canonical = **`edgeModelId`**, not “key”.
- Rule Builder loads columns from EdgeModel by id.

**Depends on:** `edgeModelDefinitionSchema` · D1

---

## D11 — Actions ↔ Data API operations

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | Policy `actions` use the set **`list` \| `read` \| `create` \| `update` \| `delete`**. Mapping: |

| Policy action | Data API / executor |
|---------------|---------------------|
| `list` | list / findAndCount |
| `read` | getById / lookup (single-record read) |
| `create` | create (validate binding fields ∈ scope / predicate) |
| `update` | update by id |
| `delete` | delete by id |

Wildcard / omit rules: a policy may list multiple actions; no implicit include of write when only `list` is granted.

**Rationale**

- Matches domain CRUD mental model and executor operation surface.
- Separating `list` vs `read` allows “see in list but not open” only if product needs it later; v1 still supports both explicitly.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Mirror raw HTTP verbs only | Harder Rule Builder; less stable across codegen vs executor |
| Single `read` covering list+get | Prevents nuanced policies; can add sugar templates later |

**Implications**

- RPE-5 maps operation name → action before loading policies.
- Templates in RPE-8 can offer “all read” = `list`+`read`.

**Depends on:** Data API operations enum · D5

---

## D12 — UI language

| Field | Value |
|-------|--------|
| **Status** | Frozen |
| **Decision** | All Studio UI strings for Dimensions, Memberships, and Rule Builder are **English-only**, per `docs/standards/ui-core.md`. Specs/plans may remain bilingual; runtime copy must not. |

**Rationale**

- Always-on platform rule; avoids mixed culture bundles for a security surface.

**Rejected**

| Option | Why rejected |
|--------|----------------|
| Persian-first Studio labels for RPE | Violates ui-core English-only copy |

**Implications**

- RPE-7/RPE-8 copy review against English-only.

**Depends on:** ui-core

---

## Cross-cutting freeze summary

| ID | One-line freeze |
|----|-----------------|
| D1 | Policies/bindings = workspace JSON (+ service cache) |
| D2 | Nodes = Base Info; dimension registry separate |
| D3 | Memberships = existing `base_scope_memberships` (+ events) |
| D4 | Allowlisted `session.user.*` from server session context; scope from memberships |
| D5 | Sequelize `WhereOptions` via shared Data API where helpers; `Op.and` merges |
| D6 | Keep `defaultWhere`; AND with policies; RPE on all CRUD not list-only |
| D7 | Fail-closed scoped + ADMIN bypass default + `forceScopeForAdmin` — **PO confirmed 2026-08-12** |
| D8 | Force `cacheByUser` + scope/policy hash for scoped/policy-affected APIs |
| D9 | Package policies/dimensions/bindings; not memberships |
| D10 | Canonical `edgeModelId` (not API key / not objectName-alone) |
| D11 | Actions `list\|read\|create\|update\|delete` ↔ executor ops |
| D12 | English-only UI copy |

---

## PO freeze addendum (2026-08-12) — delivery scope & product defaults

| Topic | PO decision |
|-------|-------------|
| Delivery target | **Option B:** RPE-0…8 + RPE-9 (tenant product + package) + RPE-10 (Explain + standards) |
| Out-of-scope id response | **404** for get/update/delete outside scope (not 403) |
| Empty list | Empty result / count 0 — not an error |
| Studio UI placement | **Both:** Dimensions/Memberships under Access/Security; Rule Builder on model in Data Studio (+ cross-links) |
| Binding storage | **Sidecar** `workspace/record-policy-bindings/` (not embedded in EdgeModel) |
| Data API hook timing | Hook **current** `dataApiExecutor` now (do not wait for full p-73 SEA-4…6) |
| Multi-membership | **Allowed** — multiple nodes per user per dimension (org, geo, tenant, custom) |
| Default `recordScope` | **`off`** for all models until explicitly `required` |
| Deferred after RPE-11 close | Per-record share · timed membership · include leak — [`06-deferred-backlog.md`](./06-deferred-backlog.md). Hard tenancy remains logical-only — [`05-hard-tenancy.md`](./05-hard-tenancy.md). Local `roleInNode` **removed** (binary membership only). |

## Follow-ons

| ID | Work |
|----|------|
| RPE-0-3 | Threat model against these freezes (esp. D6 list-only gap, D8 cache, D7 ADMIN) |
| RPE-0-4 | Exact workspace paths, pageKeys, service file map |
| RPE-0-5 | ✅ PO sign-off on D7 + delivery addendum (2026-08-12) |
| RPE-1 | Implement schemas aligned to D1/D10/D11 |

Update [`01-domain.md`](./01-domain.md) §6 to point here as **fully frozen**.

---

*Record Policy Engine · decisions · RPE-0-2*
