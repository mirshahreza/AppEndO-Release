# Vibe Coding Platform — Specification

> **Plan:** this spec is the authority (p-50 plan deleted after ship)  
> **Roadmap:** [`03-implementation-roadmap.md`](./03-implementation-roadmap.md)  
> **Status:** Approved for implementation (doc phase p-50-DOC complete; VC-1 code gated on PO sign-off)

---

## Scope

Internal vibe coding on the live AppEndO admin instance:

| Surface | Agent capabilities |
|---------|-------------------|
| Server Functions | `list/get/test_server_function`, `draft_server_function`, apply |
| Client Components | `draft_component_layout`, designer MCP tools, handoff |
| Full-stack files | `read_file`, `search_codebase`, `draft_file_patch` on expanded allowlist |

## Unified live runtime

Vibe coding runs on the **same live AppEndO instance** — no separate execution engine for generated server or client code.

| Layer | After apply | Separate engine? |
|-------|-------------|------------------|
| **Server** | Managed Server Functions under `workspace/server-functions/`; routes/API served by the existing Node process | **No** |
| **Client** | Layouts under `workspace/designer/drafts/`; Component Designer preview and routed UI in the same React app | **No** |
| **Verify (VC-4)** | `run_tests` and post-apply checks against the live runtime | **No** — not a new sandbox/container per draft |

Implications for p-50:

- `test_server_function` exercises the **production runtime path**, not an isolated interpreter.
- Designer handoff opens the **same app** the operator is already using.
- VC-4 adds verification hooks on this runtime; it does **not** introduce a vibe-only execution engine.

## Non-goals

- Public vibe-coding SaaS
- External agent orchestration (A2A / aweb mesh) in v1
- Auto-apply without user confirm
- Legacy dual pipelines
- Zed ACP registry / GPUI integration
- **Separate vibe execution engine** (sidecar, VM sandbox, or per-draft deploy pipeline)

---

## Baseline gaps (before VC-1)

Known gaps in current code — closed by VC-1..4. Executable tasks in [`03-implementation-roadmap.md`](./03-implementation-roadmap.md).

| Gap | Current state | VC |
|-----|---------------|-----|
| `server_function` draft → changeSet | [`changeSetBuilder.ts`](../../src/core/ai/validation/changeSetBuilder.ts) maps only `edge_function`; `server_function` → «Unknown draft» | VC-1.2 |
| Allowlist full-stack | [`pathAllowlist.ts`](../../src/core/ai/tools/pathAllowlist.ts) missing `src/server/`, `src/domain/`, `src/components/`, `workspace/server-functions/` | VC-1.1 |
| Default session packs | [`capabilityPacks.ts`](../../src/shared/api/contracts/ai/capabilityPacks.ts): `appendo-designer` and `appendo-server-functions` not `defaultEnabled` (DEVELOPER RBAC in [`mcpAccessSeed.ts`](../../src/server/services/ai/mcpAccessSeed.ts) is separate) | VC-1.4 |
| VibeHarness | file does not exist; harness not enforced at runtime | VC-2 |
| post-apply verify UI | [`changeSet.service.ts`](../../src/server/services/ai/changeSet.service.ts) calls `verifyAppliedChangeSets`; [`AiPanel.tsx`](../../src/components/AiPanel.tsx) does not render `verification` | VC-4.2 |
| `run_tests` tool | not implemented | VC-4.1 |
| `changeSetBuilder` test | only `component_layout` covered | VC-1.2 |

---

## Related documentation (p-50-DOC)

| Document | Purpose |
|----------|---------|
| [`docs/architecture/vibe-coding-benchmarks.md`](../../docs/architecture/vibe-coding-benchmarks.md) | Platform comparison matrix |
| [`docs/architecture/zed-lessons-for-appendo.md`](../../docs/architecture/zed-lessons-for-appendo.md) | Zed ACP · AcpThread · tools · mentions |
| [`docs/standards/vibe-coding-workflows.md`](../../docs/standards/vibe-coding-workflows.md) | WF-1..4 operational workflows |
| [`02-zed-acp-mapping.md`](./02-zed-acp-mapping.md) | Zed concept → AppEndO mapping |
| [`03-implementation-roadmap.md`](./03-implementation-roadmap.md) | VC-0..7 phases · dependencies · tests · gate |
| [`docs/archive/internal/vibe-coding-howto-fa.md`](../../docs/archive/internal/vibe-coding-howto-fa.md) | Internal team how-to (FA) |

---

## Workflow A — New service + UI

1. User on **Server Functions** → Agent mode
2. Agent: standards → list/get functions → `draft_server_function` → `test_server_function`
3. User confirms apply
4. User on **Client Components** → Agent drafts layout with bindings
5. Apply → open Designer handoff

See **WF-1 + WF-2** in [`vibe-coding-workflows.md`](../../docs/standards/vibe-coding-workflows.md).

## Workflow B — Modify existing UI

1. User in Designer with `layoutId` in page context
2. Agent: `get_page_context` → read sources → `designer_set_prop` / `draft_component_layout`
3. Validate against project standards → confirm → apply

See **WF-3** in [`vibe-coding-workflows.md`](../../docs/standards/vibe-coding-workflows.md).

**WF-4** covers full-stack (Server Function + UI) with harness gates.

---

## Harness phases

`retrieve` → `plan` → `draft` → `finalize`

- **retrieve:** `get_feature_graph`, `search_codebase`, `read_file`, `get_server_function`, `get_project_standards`
- **plan:** structured plan artifact (intent, target files, steps)
- **draft:** `draft_*` tools only after retrieval gate satisfied
- **finalize:** `buildChangeSetsFromDrafts` → `validateProposal` → repair (max 2) → proposal UI

Target implementation: VC-2 `VibeHarness.ts` (not yet enforced at runtime).

---

## VC-6 split (doc vs runtime)

| Track | Status | Content |
|-------|--------|---------|
| **VC-6-doc** | Done (p-50-DOC) | workflows shard · how-to FA · `ai.vibe.*` in `projectStandards.ts` |
| **VC-6-runtime** | Pending v1 | WF-1..4 rules in `contextAssembly.ts`; shard keys `vibe-server-function` / `vibe-crud` / `vibe-designer-edit` in retrieve gate (VC-1.5 + VC-2) |

---

## Security and observability

- All writes via proposal + confirm (`writeRequiresConfirm: true`)
- Rollback snapshots on apply; `/api/ai/agent/rollback` from AiPanel
- `src/server/` writes subject to proposal limits (files/lines) + optional `run_tests` (VC-4)
- SSRF/MCP policies unchanged
- **RBAC:** DEVELOPER role receives vibe packs (`appendo-designer`, `appendo-server-functions`) via [`mcpAccessSeed.ts`](../../src/server/services/ai/mcpAccessSeed.ts); USER role does not — document in VC-1.6a
- **Trace:** proposal, apply, and verify results must remain visible in agent run trace (VC-1.6b — existing trace fields)

---

## Cross-plan dependencies

| Plan | Relationship to p-50 |
|------|----------------------|
| Shell Studio (cancelled) | **Parallel** — generated app/site shells are not required for WF-2 CRUD in v1 |
| Redis cache testing | ✅ done — RCT integration |
| Workflow engine | ✅ shipped — WF-4 harness ≠ workflow engine |

---

## Testing (v1)

Per-phase tests and WF E2E matrix: [`03-implementation-roadmap.md`](./03-implementation-roadmap.md) § Testing strategy.

| WF | E2E scenario |
|----|--------------|
| WF-1 | `draft_server_function` → apply → `test_server_function` |
| WF-2 | `draft_component_layout` → Designer handoff |
| WF-3 | modify existing layout with `baseLayoutId` |
| WF-4 | WF-1 + WF-2 in one proposal or two sequential applies |

**v1 gate:** `npm run test:critical` green.

---

## Product success metrics (v1)

- Internal dev (DEVELOPER role) completes WF-1 end-to-end without Cursor in **< 30 minutes** (including confirm)
- WF-3: change an existing grid column via Agent + successful apply
- Zero applies without confirm in E2E tests
- Rollback of last apply from AiPanel works (regression)
- `get_project_standards({ shard: "vibe-coding-workflows" })` called in retrieve gate before `draft_*`

---

## Implementation gate

**VC-1 code** starts only after PO sign-off — checklist in [`03-implementation-roadmap.md`](./03-implementation-roadmap.md) § PO sign-off gate and [`03-implementation-roadmap.md`](./03-implementation-roadmap.md) § Gate.

---

## References

- Orchestrator: `src/core/ai/agent/AgentOrchestrator.ts`
- Harness (planned): `src/core/ai/agent/VibeHarness.ts`
- Standards: `docs/standards/vibe-coding-workflows.md`
- Zed mapping: `specs/vibe-coding/02-zed-acp-mapping.md`
- Post-v1 backlog: roadmap § VC-7 (subagents · mentions · Zed-grade diff · full semantic index)
