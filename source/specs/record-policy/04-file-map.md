# Record Policy Engine — Target File Map

> **Plan:** [`docs/standards/record-policy.md`](../../docs/standards/record-policy.md)  
> **Phase:** RPE-0-4  
> **Status:** Engineering map for RPE-1…10 (paths may gain files; do not invent parallel stacks)  
> **Created:** 2026-08-12  
> **PO:** Bindings sidecar · UI split Access + Data Studio · hook current Data API executor

---

## 1. Workspace persistence

| Artifact | Path | Notes |
|----------|------|--------|
| Record policies | `workspace/record-policies/index.json` + `{policyId}.json` | Edge-store pattern (D1) |
| Scope bindings + flags | `workspace/record-policy-bindings/{edgeModelId}.json` | Sidecar per model (PO); holds `recordScope`, `forceScopeForAdmin`, field→dimension bindings |
| Dimension registry | Built-in `org`/`geo` only (in-code; no workspace files) | Nodes live in Base Info under Base (`100`); projected to serverContext as `scope.*` |
| Memberships | Prisma `base_scope_memberships` / `base_scope_role_memberships` (+ events) | Not workspace files (D3) |

**Preset roots (from p-88):** org Base Info `100.4` (`platform.org`) · geo `100.5` (`platform.geo`) — always built-in. Tenant is not a Base Info root.

---

## 2. Shared contracts

| Module | Path |
|--------|------|
| Predicate AST + ValueRef | `src/shared/api/contracts/record-policy/predicate.ts` |
| RecordPolicy / principals / actions | `src/shared/api/contracts/record-policy/policy.ts` |
| DimensionDef / ScopeBinding | `src/shared/api/contracts/record-policy/dimension.ts` |
| Zod schemas + normalize exports | `src/shared/api/contracts/record-policy/index.ts` |
| Constants (pageKeys, workspace dir names) | `src/shared/api/contracts/record-policy/constants.ts` |

---

## 3. Server services

| Concern | Path |
|---------|------|
| Policy + binding stores | `src/server/services/record-policy/recordPolicyStore.ts` · `recordPolicyBindingStore.ts` |
| Dimension registry store | `src/server/services/record-policy/scopeDimensionStore.ts` |
| Membership service | `src/server/services/record-policy/scopeMembership.service.ts` |
| Subtree expand (Base Info) | `src/server/services/record-policy/subtreeExpand.ts` |
| SessionScope resolver | `src/server/services/record-policy/sessionScope.service.ts` |
| Policy select + compiler | `src/server/services/record-policy/policyCompiler.ts` |
| mergeWhereAnd / deny-all | `src/server/services/record-policy/whereMerge.ts` |
| Data API apply hook | `src/server/services/record-policy/applyRecordPolicies.ts` |
| Helpers for server functions | `applyRecordPolicies.ts` · `sessionScope.service.ts` (dedicated `recordScopeHelpers.ts` removed — unused) |
| Explain access | `src/server/services/record-policy/explainAccess.service.ts` |
| Package export/import bits | extend `packageEdgeDataExport.service` / `packageEdgeDataRuntime.service` (RPE-9) |

**Integration touchpoints (existing):**

| Existing | Change |
|----------|--------|
| `src/server/services/data-api/dataApiExecutor.ts` | Call `applyRecordPolicies` on list/get/update/delete/create; `Op.and` merge (D5/D6) |
| `src/server/services/data-api/dataApiQuery.ts` | Reuse `buildWhereFromFilter` shape; shared merge helper |
| `src/server/services/data-api/dataApiRuntimePolicy.ts` | Force `cacheByUser` + scope/policy hash (D8) |
| `sessionContext.service` | Expose/attach scope snapshot or call `resolveSessionScope` alongside |

---

## 4. Studio UI

| Surface | pageKey (proposed) | Feature path |
|---------|-------------------|--------------|
| Scope axes | Built-in `org` / `geo` / `tenant` (no Settings page) | Memberships via Org Chart / Geo; no custom dimension UI |
| Membership assignment | (no dedicated page) | Org Chart / Geo Divisions inspectors: people **and** roles via `/api/scope-memberships` (+ `/roles`) |
| Nav group | Records (Org/Geo) + Data Studio policies | — |
| Rule Builder (model) | Data Studio model workspace panel / route segment | `src/features/record-policy/RecordPolicyRuleBuilder.tsx` |
| Explain Access (admin) | modal or `record-policy-explain` | RPE-10 |
| Cross-links | Rule Builder ↔ org-geo pages (`organization-chart`, `geographic-divisions`) | |

Reuse: Base Components · deep-linking standards · patterns from `AccessControlModal` / Entity Access · org-geo scoped Base Info CRUD.

---

## 5. Specs / standards / tests

| Kind | Path |
|------|------|
| Domain / decisions / threats / map | `specs/record-policy/01-…04-*.md` |
| Standards (draft→final) | `docs/standards/record-policy.md` + INDEX + `projectStandards.ts` |
| Unit tests | `__tests__` beside each service + contracts |
| Integration | `src/server/services/data-api/__tests__/*recordPolicy*` |
| Fixtures | seed/dev helpers under `scripts/` or service `__fixtures__` (two users, org/geo memberships) |

---

## 6. Data API dependency (hook now)

Required executor capabilities for RPE-5 (present or to harden in-place):

1. Resolve EdgeApi → `edgeModelId` + model columns  
2. List: build where from filter + `defaultWhere`  
3. Get/update/delete by id  
4. Create with field payload  
5. Response cache key builder (`cacheByUser`)  

**PO:** Do not block on full p-73 SEA-4…6; hook current executor and keep `applyRecordPolicies` as the single enforcement seam if executor internals move.

---

## 7. Exit (RPE-0-4)

- [x] Workspace paths named (policies / bindings / dimensions)  
- [x] Contracts + services + UI pageKeys proposed  
- [x] Executor + session + cache touchpoints listed  
- [x] Package + standards destinations noted  

**RPE-0 complete when** this file + threat model + PO freeze are done → start **RPE-1** schemas.

---

*Record Policy Engine · file map · RPE-0-4*
