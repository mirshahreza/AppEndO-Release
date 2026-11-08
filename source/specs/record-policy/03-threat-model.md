# Record Policy Engine — Threat Model

> **Plan:** [`docs/standards/record-policy.md`](../../docs/standards/record-policy.md)  
> **Decisions:** [`02-decisions.md`](./02-decisions.md)  
> **Phase:** RPE-0-3  
> **Status:** Normative for RPE-1…10 design & tests  
> **Created:** 2026-08-12  
> **Code:** none in this task

---

## 1. Assets

| Asset | Why it matters |
|-------|----------------|
| Row data on scoped Edge models | Primary confidentiality / integrity target |
| SessionScope (memberships + attrs) | Compiles into WHERE; poison ⇒ over/under exposure |
| RecordPolicy / binding workspace JSON | Authoring artifacts; tamper ⇒ wrong enforcement |
| Data API response cache | Cross-user or stale-scope leak amplifier |
| Dimension nodes (Base Info org/geo/tenant) | Membership targets; wrong tree ⇒ wrong subtree |

---

## 2. Trust boundaries

```text
[Client / Designer UI]     — untrusted for authorization
        │
[Capability gate]          — FunctionAccessControl (unchanged)
        │
[RPE SessionScope + compiler + Data API executor]  — trusted enforcement
        │
[DB / Edge Sequelize]
```

- UI filters, hidden columns, Designer visibility = **not** controls.
- Client-supplied `filter` / `where` / id = untrusted; may only **narrow**, never widen, policy WHERE.
- Server functions that bypass Data API = **outside** automatic RPE unless they call helpers (N6).

---

## 3. Adversaries & goals

| Adversary | Goal |
|-----------|------|
| Authenticated user (other tenant/org) | Read or mutate out-of-scope rows (IDOR) |
| Authenticated user with list capability | Enumerate existence of forbidden ids |
| User with stale cache / shared cache key | See another principal’s list payload |
| Misconfigured operator | Accidental open model (no policy on `required`) |
| ADMIN without force-scope | Intended bypass — not an attack; abuse is ops risk |
| Package installer | Import policies that silently widen access |

---

## 4. Threats → mitigations (mapped to freezes)

### T1 — IDOR via get/update/delete by id

| | |
|--|--|
| **Attack** | Caller knows or guesses id; capability allows API; row outside SessionScope |
| **Today** | `defaultWhere` is list-only — get-by-id hole (D6) |
| **Mitigation** | RPE on **all** CRUD; after load or via id∈policyWhere, assert match; **404** if out of scope (PO) |
| **Tests** | Two users, two tenants; get/update/delete foreign id → 404 |

### T2 — Cross-tenant / cross-org list leak

| | |
|--|--|
| **Attack** | List without policy WHERE, or userFilter ORs out constraints |
| **Mitigation** | `Op.and(policyWhere, defaultWhere, userFilter)`; userFilter cannot broaden; fail-closed when `recordScope: required` and no allow (D5/D6/D7) |
| **Tests** | List never contains foreign tenant/org rows; empty list OK |

### T3 — Policy bypass via “raw id only” path

| | |
|--|--|
| **Attack** | Code path that loads by primary key without merging policy |
| **Mitigation** | Single helper in executor (`applyRecordPolicies`); no alternate findByPk for scoped models; codegen/routes must use executor |
| **Tests** | Inventory of Data API ops all go through hook |

### T4 — Cache leak / stale scope

| | |
|--|--|
| **Attack** | Response cached without `cacheByUser`, or same user after membership change still served old list |
| **Mitigation** | Force `cacheByUser` + hash(SessionScope sets + policy identity) in key (D8); invalidate on membership write |
| **Tests** | User A list not served to B; after membership revoke, next list excludes prior rows (no stale hit) |

### T5 — UI-only / Designer-only filters

| | |
|--|--|
| **Attack** | Hide rows in grid; call API directly |
| **Mitigation** | Document + tests that enforcement is server-side only; Designer visibility never grants/denies rows |
| **Tests** | Direct HTTP API without UI still scoped |

### T6 — Fail-open misconfiguration

| | |
|--|--|
| **Attack / accident** | `recordScope: required` but no matching allow policy |
| **Mitigation** | Deny-all (`1=0` equivalent); default models stay `off` so greenfield apps don’t break (PO) |
| **Tests** | Scoped model, zero policies → empty list + 404 on id |

### T7 — ADMIN confusion / over-bypass

| | |
|--|--|
| **Risk** | Support ADMIN sees all rows (by design); tenant demo needs isolation |
| **Mitigation** | Default bypass; per-model `forceScopeForAdmin` (D7 PO) |
| **Tests** | ADMIN bypass + force-scope cases |

### T8 — Create into foreign scope

| | |
|--|--|
| **Attack** | POST with `tenantId` / `orgUnitId` outside membership |
| **Mitigation** | `create` action validates binding fields ∈ session scope / predicate (D11) |
| **Tests** | Create with foreign tenantId rejected |

### T9 — Predicate smuggling (SQL/JS)

| | |
|--|--|
| **Attack** | Free SQL or expression in policy JSON |
| **Mitigation** | Closed AST; reject unknown ops/refs; no raw SQL (domain N3) |
| **Tests** | Illegal AST rejected at normalize/validate |

### T10 — Session attribute confusion

| | |
|--|--|
| **Attack** | Policy binds to client-controlled or non-allowlisted key |
| **Mitigation** | Allowlisted `session.user.*` from **server** session context only (D4) |
| **Tests** | Unknown ref rejected; client context ignored |

### T11 — Relation / include side-channel (known residual)

| | |
|--|--|
| **Attack** | Include related rows that skip parent policy |
| **Mitigation v1** | Document residual; harden in RPE-11-4 post-B review |
| **v1 stance** | Prefer not exposing unconstrained includes on scoped APIs; track as residual risk |

### T12 — Server function raw SQL (known residual)

| | |
|--|--|
| **Attack** | Custom SQL without `assertRecordInScope` |
| **Mitigation v1** | Helpers + standards; no auto-wrap (N6); revisit after B |
| **v1 stance** | Accepted residual with documentation |

### T13 — Package import widens access

| | |
|--|--|
| **Attack** | Imported policies allow `or`-open predicates or turn scope off |
| **Mitigation** | Ownership/conflict rules; import does not ship memberships (D9); validate AST on install |
| **Tests** | Install sample package; still zero cross-tenant leak with local memberships |

---

## 5. Deny / empty response policy (PO)

| Operation | Out of scope outcome |
|-----------|----------------------|
| `list` | Empty rows, count 0 — **not** an error |
| `read` / `update` / `delete` | **404** (not 403) — reduces existence oracle |
| `create` | Validation / 400-class (or domain error) when binding fields fail scope — not silent accept |

Existence oracle via 404 vs 403: prefer 404 even though timing/other channels may remain; do not switch to 403 in v1.

---

## 6. Residual risks (explicit)

| ID | Residual | Disposition |
|----|----------|-------------|
| R1 | Relation include leak | RPE-11 review after B |
| R2 | Raw SQL server functions | Helper + doc; review after B |
| R3 | ADMIN default bypass abuse | Ops + `forceScopeForAdmin` |
| R4 | Very large `inSubtree` sets | Perf: materialize/cache in RPE-3; monitor |
| R5 | Per-record share not available | Intentional; revisit after B |

---

## 7. Test matrix (minimum for RPE-5+)

| # | Case | Expect |
|---|------|--------|
| 1 | Scoped, no allow | list empty; get → 404 |
| 2 | Two tenants | no cross list/get/update/delete/create |
| 3 | Org subtree | sees descendants only |
| 4 | Multi-membership | union of nodes/subtrees |
| 5 | userFilter tries broaden | still constrained |
| 6 | Cache two users | no cross hit |
| 7 | Membership revoked | cache/session invalidate; rows gone |
| 8 | ADMIN default | sees all unless forceScopeForAdmin |
| 9 | Illegal predicate | rejected at write/validate |
| 10 | Attribute policy (e.g. gender) | role A vs B split |

---

## 8. Exit (RPE-0-3)

- [x] Threats T1–T13 mapped to D-freezes / PO addendum
- [x] 404 / empty-list policy recorded
- [x] Residuals called out for post-B review
- [x] No runtime code in this task

**Next:** [`04-file-map.md`](./04-file-map.md) (RPE-0-4)

---

*Record Policy Engine · threat model · RPE-0-3*
