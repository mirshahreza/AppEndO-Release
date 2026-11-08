# Workflow Engine — testing boundary

> **Shard key:** `get_project_standards({ shard: "workflow-engine-testing" })`  
> **Applies while:** evaluating, scenario-testing, or hardening the Workflow Engine (AWM + runtime + Work Items).

## Principle

**A workflow is data.** During engine testing, prefer changing **workflow design / published revision / runtime payload / DB rows** over changing application code.

Touch **platform code** only for a **real engine bug** or a **generic capability** that any workflow can use — never for one workflow’s business scenario.

## Decision tree

1. **Does the issue reproduce for every workflow of that kind, or only one scenario?**  
   - Only one scenario → fix **design/data** first (Designer, publish, input mapping, assignment, edges, seed/instance rows).
2. **Would the fix mention a specific `WorkflowDefinition.key`, node key, or outcome string?**  
   - Yes → **do not** hardcode in app source; change the workflow model or instance data.
3. **Would another unrelated workflow need the same code path?**  
   - No → not a platform feature; stay in workflow data.
4. **Does behavior contradict normative engine docs** (AWM types, inbox contract, this shard)?  
   - Yes → **engine bug** → fix `src/server/domain/workflow/**` (with tests).

## Allowed without PO platform sign-off (data / design)

| Change | Examples |
|--------|----------|
| AWM draft / published model | nodes, edges, `start`, `WORK_ITEM` assignment, outcomes, `input` mappings |
| Publication lifecycle | publish, disable, new revision |
| Runtime input | `startWorkflowInstance` input JSON (via admin runtime API or test script) |
| Instance / Work Item rows | patch `inputJson`, re-run scenario, complete/claim in UI |
| Example seeds | `scripts/seed-example-workflows.ts`, one-off `scripts/*.ts` — **not** server bootstrap |

## Allowed in code (platform only)

| Category | Examples |
|----------|----------|
| **Engine bug** | dispatch, correlation, wait races, publication validation, inbox eligibility |
| **Generic primitive** | `startWorkflowInstance` by `definitionKey`, EVENT bus ingress, webhook adapter, inbox bucket semantics for **all** `ROLE` assignments |
| **Generic Work Item UX** | render `inputJson` from schema; inbox “open tasks” merge for all buckets — **not** `if (workItemType === 'REVIEW' && title includes 'profile image')` |
| **Generic trigger hook** | documented platform API: “start workflow X with input Y” called from domain code **only after** PO approves integration pattern (not per-scenario special cases in engine test phase) |

## Forbidden during engine testing

- Hardcoding a **specific** workflow key (`user-profile-image-review`, `employee-leave-request`, …) in `src/**` bootstrap, services, or UI.
- Feature-specific files such as `definitions/<one-scenario>.ts` wired into `bootstrapFullRuntime.ts`.
- Domain hooks named after one scenario (`notifyUserCreatedForProfileImageReview`, …) unless promoted to an approved **generic** lifecycle/event contract.
- Work Item UI branches keyed on one workflow’s title, node key, or magic `input` fields.
- “Fixing” wrong frozen runtime input by patching app code when **re-publish + re-start** or **input mapping in AWM** would suffice.

## Start / trigger during tests

| Approach | Engine-test phase |
|----------|-------------------|
| `MANUAL_API` + admin runtime API / test script | **Preferred** — no domain coupling |
| `POST /api/workflow-runtime/definitions/:id/start` with `{ input }` | OK |
| Domain hook on user insert / CRUD | **Out of scope** for engine-only testing unless building an approved **generic** event primitive |
| Polling DB for conditions | **Rejected** |

## Examples

### ✅ Data fix (preferred)

- Profile review shows wrong flag → remove `hasProfileImage` from workflow `inputSchema`; pass only `userId`; use generic inbox JSON panel or a **generic** “user avatar by id” renderer spec’d for all `WORK_ITEM` types that carry `userId`.
- Admin does not see role queue → fix **generic** inbox bucket query (platform) — not one workflow’s assignment.

### ❌ Scenario hardcode (reject)

- `if (definition.key === 'user-profile-image-review')` in UI or bootstrap.
- `ensureUserProfileImageReviewWorkflowDefinition()` on every server boot.
- `ProfileImageReviewPreview` only for one workflow’s input shape.

## Related

- Engine types: `src/server/domain/workflow/awm/types.ts`
- Remaining AI/workflow items: [`p-72-ai-backlog.md`](../../plans/core/next/p-72-ai-backlog.md) §۴
- Scenario harness: [`scripts/build-workflow-20-scenarios.ts`](../../scripts/build-workflow-20-scenarios.ts)

## Change management

If this boundary changes (e.g. approved generic trigger bus), update this shard + `projectStandards.ts` id `workflow.engine.testing-boundary`.

**IDs:** `workflow.engine.testing-boundary`.
