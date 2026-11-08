# Record Policy Engine — Domain

> **Plan:** [`docs/standards/record-policy.md`](../../docs/standards/record-policy.md)  
> **Phase:** RPE-0-1  
> **Status:** Draft → domain + decisions in progress (see [`02-decisions.md`](./02-decisions.md))  
> **Created:** 2026-08-11  
> **Last updated:** 2026-08-11  
> **Code:** none in this task — domain document only

---

## 1. Purpose

AppEndO already answers **“May this principal call this function / open this page?”** via `FunctionAccessControl` (capability).

Projects also need **“Which records may they see or change?”** — organization trees, geography, logical multi-tenancy, attribute splits (e.g. customer gender), owner-only rows, and future attribute rules — **without** writing per-project SQL or platform code for each new condition.

**Record Policy Engine (RPE)** is the declarative, model-driven layer that answers the second question and **compiles** policies into enforced query predicates (WHERE), primarily on Data API paths.

```text
can(action, record) = Capability(FunctionAccessControl) AND Scope(RecordPolicies)
```

Both conjuncts are required. Capability failure never reaches scope evaluation. Scope never grants a function the caller cannot invoke.

---

## 2. Problem / outcome

### Problem today

| Layer | State |
|-------|--------|
| Function / page / MCP ACL | Present (`FunctionAccessControl`) |
| Automatic row/record authorization | Absent |
| Org / geo / tenant as product concepts | Absent |
| Per-user data filters | Manual only (`defaultWhere`, hand-written SQL / session placeholders) |
| Designer row visibility | UX only — not a security boundary |

### Desired outcome

Operators configure **Dimensions**, **memberships**, **model bindings**, and **Record Policies** in Studio against the project’s information model. At runtime the engine injects an **effective WHERE** (and create-time field checks) so new conditions are data, not code.

### Success (product-level)

- Capability and record scope remain separate contracts and UIs.
- Org tree, flat geo, logical tenant, and attribute rules are instances of one abstraction.
- Data API list/get/update/delete on **scoped** models cannot return or mutate out-of-scope rows (IDOR / cross-tenant tests).
- New project conditions = new rules in Studio, not PRs that edit queries.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **Capability** | Permission to invoke a **function**, **route**, **page**, or **MCP** resource. Owned by `FunctionAccessControl` and role/user allow·deny lists. Answers *whether* an API may be called at all. |
| **Scope (record scope)** | Constraint on **which rows** of a data model a principal may list/read/create/update/delete after capability passes. Owned by Record Policy Engine. |
| **Dimension** | A named segregation axis (`key`, label, `topology: flat \| tree`). Examples: `org`, `geo`, `tenant`, or project-specific axes. Not a Role hierarchy. |
| **Dimension node** | One value in a Dimension (e.g. an org unit, region, or tenant id). Tree nodes have a parent; flat nodes do not. |
| **Membership** | Binding of a **principal** (primarily a user) to one or more dimension nodes. Binary membership only — no per-node role label (avoids confusion with platform Roles). |
| **SessionScope** | Per-request resolved snapshot: `userId`, `roles`, allowlisted user attributes, and per-dimension id sets (exact membership and/or expanded subtree). Input to the compiler. |
| **Scope binding (model binding)** | Declaration on a data model that a record field maps to a Dimension (e.g. `Customer.orgUnitId` → `org`) and/or an owner field (`ownerUserId`). |
| **Predicate** | Closed AST of allowed operators over model fields and value refs (`literal`, `session.*`, `session.scope.*`). No free SQL/JS. |
| **RecordPolicy (Policy)** | Stored rule: `effect` (`allow` \| `deny`) + `actions` + `principals` (roles/users) + `predicate`, scoped to a **model**. |
| **Principal** | Subject of authorization: authenticated user identity and/or role keys (same family as function ACL principals). |
| **Action** | Record operation: at least `list` \| `read` \| `create` \| `update` \| `delete`, mapped to Data API operations. |
| **Compiler** | Pure(ish) transform: applicable policies + SessionScope + model metadata → **effectiveWhere** compatible with Data API filter/`buildWhereFromFilter` path, plus single-record match for get/update/delete. |
| **effectiveWhere** | Server-enforced predicate conjunction applied to queries; callers cannot widen it with client filters. |
| **Scoped model** | Model with `recordScope: required` (name TBD in RPE-0-2). Fail-closed: no matching allow policy ⇒ no rows. |
| **Unscoped model** | Model with record scope off. No RPE WHERE required (typical for some platform/system models unless explicitly opted in). |
| **Tenant (logical)** | Product preset: a **flat** Dimension (conventionally `tenant`) plus policies/bindings so `tenantId ∈ session.scope.tenant`. Not separate-DB / schema-per-tenant isolation. |
| **Hard tenancy** | Physical isolation (separate schema/database per tenant). **Out of RPE v1** (plan N1). |
| **defaultWhere** | Existing static filter on an Edge API definition. Remains and is **AND**-ed with policy WHERE; for model constants, not per-user rules. |
| **Explain access** | Admin/diagnostic view of which policies matched, compiled WHERE, and memberships (later phase). |

### Related but not RPE

| Concept | Why not RPE |
|---------|-------------|
| `FunctionAccessControl` | Capability only |
| Flat `BaseRole` | Identity/capability grouping; org trees live in Dimensions |
| Package `ownerPackageId` | Asset provenance, not end-user row ACL |
| Designer node/row visibility | Client UX, not enforcement |
| ApplicationScope / settings scope | Mount/config, not record authorization |

---

## 4. Boundary: Capability vs Scope

### Ownership

| Concern | Owner | Typical UI |
|---------|--------|------------|
| Who may call `/api/...` or open a page? | `FunctionAccessControl` + middleware | Access Control / Entity Function Access modals |
| Which rows pass once the API is allowed? | Record Policy Engine | Dimensions · Memberships · Rule Builder |

### Request pipeline (normative order)

```text
1. Authenticate (as required by capability mode)
2. Capability gate (FunctionAccessControl)     → 401/403 stop
3. Resolve SessionScope
4. Load applicable RecordPolicies (model, action, principals)
5. Compile → effectiveWhere
6. Merge: policyWhere AND defaultWhere AND userFilter
   (userFilter must not broaden policyWhere)
7. Execute query / assert single-record match
```

### Invariants

1. **No grant by scope alone** — failing capability never falls through to “allowed rows.”
2. **No silent open on scoped models** — `recordScope: required` without applicable allow ⇒ deny-all (empty result / 403·404 on id), not “all rows.”
3. **UI is not security** — list filters and hidden actions do not replace compiler enforcement.
4. **Do not merge layers** — do not encode org trees inside Roles; do not overload `FunctionAccessControl` with row predicates.
5. **Greenfield** — one predicate schema; no dual legacy policy formats; no free-text SQL in policy documents.

### Interaction with ADMIN

- Capability: ADMIN bypass remains as today for function ACL.
- Record scope: default proposal (plan D7) = ADMIN also bypasses scope, with optional per-model **force scope for admin**. Final freeze in RPE-0-2 / PO confirm RPE-0-5.

---

## 5. Conceptual model

```text
Principal ──membership──► Dimension nodes (flat | tree)
                              │
Model.field ◄──binding────────┘
                              │
RecordPolicy(predicate) ──uses──► session.user* / session.scope.<dimension>
                              │
                         Compiler → effectiveWhere → Data API / helpers
```

### Evaluation rules (v1 intent)

| Rule | Behavior |
|------|----------|
| Capability fail | Stop; no scope |
| Unscoped model | No mandatory RPE WHERE |
| Scoped + no matching allow | Deny all rows (fail-closed) |
| Multiple allows | OR of allow predicates |
| Denies | AND with allows; **deny wins** on conflict |
| Multi-dimension in one policy | Per AST (`and` / `or`); product guidance: tenant ∧ org via `and` |
| Client filters | AND with policy; cannot OR-out policy constraints |

---

## 6. Decision register (D1–D12)

**Authority:** [`02-decisions.md`](./02-decisions.md) (RPE-0-2). Summary:

| ID | Topic | Frozen decision |
|----|--------|-----------------|
| D1 | Policy storage | Workspace JSON (Edge-store pattern) + service cache |
| D2 | Dimension nodes | **Base Info** records (no parallel `base_scope_nodes`) |
| D3 | Memberships | Existing `BaseScopeMembership` / events tables |
| D4 | Session attributes | Allowlisted `user.*` from server session context; scope from memberships |
| D5 | Compiler output | Sequelize `WhereOptions` via Data API helpers; `Op.and` merges |
| D6 | `defaultWhere` | Kept; AND with policies; RPE on all CRUD (not list-only) |
| D7 | ADMIN / fail-closed | Fail-closed scoped · ADMIN bypass default · `forceScopeForAdmin` — **PO confirmed 2026-08-12** |
| D8 | Cache | Force `cacheByUser` + scope/policy hash when policies apply |
| D9 | Packages | Export policies/dimensions/bindings; **not** memberships |
| D10 | Model identity | Canonical **`edgeModelId`** (not API `key`; not objectName-alone) |
| D11 | Actions | `list\|read\|create\|update\|delete` ↔ Data API ops |
| D12 | UI copy | English-only |

**Open for PO (RPE-0-5):** ✅ closed 2026-08-12 — see [`02-decisions.md`](./02-decisions.md) PO freeze addendum (delivery B, 404, UI split, bindings sidecar, multi-membership, default off).

---

## 7. Predicate DSL (domain preview — normative freeze in RPE-1)

Allowed operator families: boolean (`and`/`or`/`not`), comparisons (`eq`/`neq`/`in`/…), null checks, optional string ops if Data API already supports them, scope ops (`inSubtree`, `inScopeSet`).

Value forms: `{ literal }` · `{ ref: "session.userId" | "session.user.<attr>" | "session.scope.<dimensionKey>" | "session.roles" }`.

**Forbidden in v1:** raw SQL, free JS, arbitrary cross-table access, unconstrained ABAC without model field schema.

Illustrative cases (not schema-final):

- Gender split: `eq(gender, literal "F")` or `eq(gender, session.user.gender)`
- Tenant: `inScopeSet(tenantId, session.scope.tenant)`
- Org: `inSubtree(orgUnitId, session.scope.org)`
- Combined: `and(tenant, geo)` as above

---

## 8. Example scenarios (same engine)

| Scenario | Mechanism |
|----------|-----------|
| Manager sees org subtree | Dimension `org` tree + membership + `inSubtree` |
| Regional segregation | Dimension `geo` flat or tree |
| Multi-tenant SaaS (logical) | Dimension `tenant` + binding + `inScopeSet` |
| Split customers by gender across roles | Policies per role with `eq` on `gender` |
| “Mine only” | `eq(ownerUserId, session.userId)` |

---

## 9. Non-goals (v1) — domain reminder

Copied from plan for spec locality: hard tenancy (N1); org hierarchy inside Roles (N2); free SQL/JS policies (N3); replacing `FunctionAccessControl` (N4); full per-record share ACL UI (N5); auto-wrap of all custom raw SQL without helper (N6); schemaless ABAC (N7).

---

## 10. Acceptance criteria by subphase (summary)

| Phase | Exit when |
|-------|-----------|
| **RPE-0** | Domain + decisions + threat model + target file map written; D1–D12 frozen; PO confirms fail-closed + ADMIN behavior; **no runtime code required** |
| **RPE-1** | Shared Zod/types + normalize/validate; golden tests (gender/tenant/org/and-or/deny); illegal AST rejected; draft standards doc |
| **RPE-2** | `resolveSessionScope` testable without HTTP; attrs + per-dimension sets; cache/invalidation story |
| **RPE-3** | Persist dimensions/nodes/memberships; subtree expand; tenant preset; fixtures for two users |
| **RPE-4** | Policy store + compiler → WHERE; single-record match; fail-closed empty-allow; deny-wins tests |
| **RPE-5** | Data API always merges policy WHERE on scoped models; IDOR/cross-tenant integration green; cache keys hardened; create validates bindings |
| **RPE-6** | `assertRecordInScope` / `buildScopeWhere` reuse compiler (no duplicate logic) |
| **RPE-7** | Studio Dimensions + membership UI (Base Components); tenant preset activatable |
| **RPE-8** | Rule Builder on model×action×principal; templates; gender + tenant scenarios config-only |
| **RPE-9** | Tenant productization + package portability; zero-leak tenant tests |
| **RPE-10** | Explain access + final `docs/standards/record-policy.md` + projectStandards |
| **RPE-11** | Optional hardening (per-record ACL, relation leak, etc.) per PO — local node-role labels removed |

### RPE-0-1 done when

- [x] This document exists at `specs/record-policy/01-domain.md`
- [x] Glossary covers Capability, Dimension, Membership, Predicate, Policy, Binding, Tenant (+ SessionScope, Compiler, scoped/unscoped)
- [x] Capability vs Scope boundary and pipeline order are explicit
- [x] D1–D12 are listed with freeze pointer to RPE-0-2
- [x] Per-phase acceptance summarized
- [x] No application/runtime code introduced in this task

---

## 11. Follow-ons (same RPE-0)

| ID | Deliverable |
|----|-------------|
| RPE-0-2 | `specs/record-policy/02-decisions.md` — freeze D1–D12 with rationale |
| RPE-0-3 | `specs/record-policy/03-threat-model.md` |
| RPE-0-4 | Target file / pageKey / Data API dependency map |
| RPE-0-5 | PO sign-off: fail-closed scoped models + ADMIN scope behavior |

**Authority:** [`docs/standards/record-policy.md`](../../docs/standards/record-policy.md) is the execution contract; this file is the domain vocabulary and boundary source.

---

*Record Policy Engine · domain · RPE-0-1*
