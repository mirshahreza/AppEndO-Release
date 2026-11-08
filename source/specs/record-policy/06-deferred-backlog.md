# Record Policy — Deferred v1.2+ backlog (RPE-11-2…4)

> **Status:** Explicitly deferred — not shipped with RPE-11 close  
> **Plan:** [`docs/standards/record-policy.md`](../../docs/standards/record-policy.md)

PO approved closing RPE-11 with property fuzz tests and hard-tenancy decision. Local membership `roleInNode` was later **removed** (binary user↔node only). The following remain **out of this delivery** so the backlog stays explicit (plan exit criterion).

## RPE-11-2 — Per-record share / temporary ACL

**Intent:** Grant a specific user/role access to one row for a time window (share link / collaborator).

**Why deferred:** Needs new ACL store, UI, expiry jobs, and deny/allow interaction with Dimension policies. Non-goal N5 for v1; do not bolt onto memberships.

**Reopen when:** Dedicated plan with threat model for share tokens and list/get leakage.

## RPE-11-3 — Time-bounded membership delegation

**Intent:** `validFrom` / `validTo` on `BaseScopeMembership` (or delegatee rows).

**Why deferred:** Schema + SessionScope time filtering + Studio UX + audit events. Current unique `(userId, dimensionKey, nodeId)` has no interval.

**Reopen when:** Prisma migration + resolver filter design approved.

## RPE-11-4 — Relation / include leak prevention

**Intent:** When Data API `include`s related models, apply the related model’s Record Policies (or strip unauthorized nested rows).

**Why deferred:** Touches Sequelize include graph, nested assert, and package APIs; risk of silent under-filter if half-done.

**Mitigation today:** Authors must not expose sensitive related models without their own scoped Data APIs / server-function helpers (`assertRecordInScope`).

**Reopen when:** SEA include policy design exists on p-73 / Data API parity plan.
