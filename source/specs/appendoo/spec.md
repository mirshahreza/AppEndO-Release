# AppEndoo Intelligent Engineering — Specification

> **Plan:** this spec is the authority (AppEndoo archive plan deleted after ship)
> **Architecture:** V3 compact manifest (see archive) · docs `00`–`13` (historical — summarized in archive)
> **Reality audit:** [`docs/appendoo/reality-audit.md`](../../docs/appendoo/reality-audit.md)  
> **Supersedes internals:** [`specs/vibe-coding/01-spec.md`](../vibe-coding/01-spec.md) (p-50 v1 — cutover AE-22)  
> **Status:** Complete (archived) — AE-0..22 · this spec · golden closure green

---

## Metadata

| Field | Value |
| --- | --- |
| **Feature slug** | `appendoo` |
| **Author** | AppEndoo implementation agent |
| **Status** | `Complete` |
| **Created** | 2026-07-11 |
| **Last updated** | 2026-07-11 |
| **Constitution version** | per `.specify/memory/constitution.md` |

---

## Feature Goal

**AppEndoo** is the platform AI assistant (evolved from AppEndO Chat / `AiPanel`) that serves general conversation, bounded context queries, authorized tool sessions, and a privileged **Intelligent Engineering** branch. Intelligent Engineering lets System Analysts, Software Architects, and System Designers describe application changes at analysis/architecture level; AppEndO then understands, plans, builds in an isolated workspace, verifies independently, and promotes only verified output.

**Product principle:** Understand → Compose → Evolve.

### Problem Statement

p-50 v1 (`VibeHarness` + direct live-root apply + Agent auto-apply) provides weak reasoning, no plan-first ASP approval, no Change Graph, no isolated workspace, and no independent verification authority. The platform already has rich primitives (Designer, Server Functions, packages, MCP packs, Feature Graph, Git) that V3 must compose rather than replace.

### Desired Outcome

A single AppEndoo assistant surface where:
- Ordinary chat and read-only tool use never escalate into engineering mutations.
- Engineering requests follow Intent → Context → ASP → Approval → Change Graph → Workspace → Builders → Verification → Promotion.
- All generated artifacts remain real AppEndO-compatible source, package-portable, and standards-compliant.

### Success Criteria

- [x] AE-0 Reality Audit + this spec approved; decision log maintained
- [x] AE-1 rebrand complete — zero `AppEndO Chat` in codebase
- [x] AE-2 Model Gateway + Assistant Request Router operational (scaffold + routing suite)
- [x] AE-22.5 v1 sunset safe — V1D registry · legacy e2e `@deprecated` + guard
- [x] AE-22.6 engineering-pipeline e2e parity — `e2eEngineeringPipelineWf*` in `test:critical` · legacy suites `MIGRATED`
- [x] AE-22.7 VibeHarness removed — `AgentImplementGate` · V1D-04 `REMOVED` · RT-08 no legacy e2e in critical path
- [x] AE-3.2–6.2 context pack enrichment — application intelligence · codebase retrieval · memory/capabilities · ASP approval binding validation
- [x] AE-3.3–6.3 production depth — incremental ASG reindex · runtime scopePaths retrieval · decision promotion · attribution validation before execute
- [x] AE-7..9 pipeline wire — change graph drift · builder orchestration errors · grader matrix in pipeline status panel
- [x] AE-10/11 UX/eval — context pack enrichment explanations · GE-020 recall@K · GE-021 live activation roundtrip · strict drift badge
- [x] AE-9.6/9.7 live runtime activation — default-on under cutover (incl. vitest) · executeApprovedBinding full wire · tmp cwd integration tests
- [x] AE-7.6 durable graph checkpoints — production path via executeApprovedBinding · restart reload test
- [x] AE-3..11 phase Definition of Done met per architecture docs (production ops + context pack enrichment closure)
- [x] AE-22 cutover — p-50 v1 write path guarded; V3 pipeline default for engineering
- [x] `npm run test:critical` green
- [x] Golden eval scenarios from doc `13` (20 scenarios · GE-020 recall@K · GE-021 live roundtrip · `evaluateDoc13GoldenClosure`)

### Out of Scope

- Renaming platform **AppEndO** or `appendo-*` MCP pack IDs
- End-User Assist (EUA) session merge with AppEndoo
- Generic autonomous coding swarm
- Whole-repository prompt stuffing
- Permanent dual p-50/V3 execution engines
- Model self-approval or unverified active-root writes

---

## Brand and Naming

| Name | Meaning | Change in AE-1 |
|------|---------|----------------|
| **AppEndO** | Platform | Unchanged |
| **AppEndoo** | AI assistant product | Replaces "AppEndO Chat" in UI/copy |
| **appendo-*** | MCP capability packs | Unchanged |

See `p-appendoo.md` § AE-1 rename map.

---

## User Stories (summary)

### US-1: General assistant chat

**As a** platform user  
**I want** to ask ordinary questions in AppEndoo  
**So that** I get helpful answers without triggering engineering writes

**Priority:** Must Have — execution class `CONVERSATION`

### US-2: Context-aware queries

**As a** Builder on a studio page  
**I want** AppEndoo to answer questions about the current page/artifact  
**So that** I get accurate scoped help

**Priority:** Must Have — execution class `CONTEXT_QUERY`

### US-3: Authorized tool sessions

**As an** operator with grants  
**I want** read-only or operational MCP tools when authorized  
**So that** I can query data or run jobs without engineering pipeline

**Priority:** Must Have — classes `TOOL_QUERY`, `OPERATIONAL_ACTION`

### US-4: Macro engineering request

**As a** Software Architect  
**I want** to describe a CRM-like application at domain level  
**So that** AppEndoo decomposes capabilities, composes packages, and produces an executable ASP for approval

**Priority:** Must Have — class `ENGINEERING_CHANGE`

### US-5: Micro engineering change

**As a** System Analyst  
**I want** to modify one field or Server Function with minimal blast radius  
**So that** verified change applies without rebuilding unrelated artifacts

**Priority:** Must Have — class `ENGINEERING_CHANGE`

### US-6: Plan-first approval

**As an** architect  
**I want** to review and revise ASP before any Builder runs  
**So that** I retain authority over material mutations

**Priority:** Must Have

### US-7: Isolated build and verification

**As a** platform owner  
**I want** engineering mutations in an isolated workspace with independent verification  
**So that** active runtime is never corrupted by unverified agent output

**Priority:** Must Have

---

## Architecture Contract (frozen upstream)

Canonical flows per `01-MASTER-ARCHITECTURE-AND-CURSOR-PROTOCOL.md`:

**Assistant:** User Prompt → Model Gateway → Request Router → Capability/Auth Resolution → bounded session OR engineering pipeline

**Engineering:** Intent → Context → ASP → Approval → Change Graph → Workspace Revision → Builders → Verification → Promotion → Package Snapshot → Intelligence reindex

Implementation order: phases 03–22 in architecture docs `02`–`11`, `10` §22.

---

## Existing Primitives to Extend (verified paths)

| Primitive | Repository anchor | V3 use |
|-----------|-------------------|--------|
| Assistant UI | `src/components/AiPanel.tsx` → `AppEndooPanel` | Shell, modes, sessions |
| Model gateway | `src/core/ai/AiManager.ts` | Refactor to provider-neutral gateway (AE-2) |
| MCP packs | `src/server/services/ai/mcp/builtin/index.ts` | Capability catalog (AE-5/10) |
| Feature Graph | `docs/ai/feature-graph.json`, `getFeatureGraph.ts` | Application intelligence (AE-3/4) |
| Project standards | `src/config/projectStandards.ts` | Knowledge registry source (AE-5) |
| Designer artifacts | `workspace/designer/`, `publishCoordinator.service.ts` | Page/Component Builders (AE-8) |
| Server Functions | `FunctionFileStore.ts`, `managedFunctionRouteRegistry.ts` | ServerFunctionBuilder (AE-8) |
| Packages | `PackageManifestValidator.ts`, `registryBuilder.ts` | Package DNA, portability (AE-9) |
| Git workspace | `gitWorkspace.ts`, `gitOperationApply.ts` | Workspace composition (AE-7) |

Full symbol audit: [`docs/appendoo/reality-audit.md`](../../docs/appendoo/reality-audit.md).

---

## p-50 v1 Cutover (AE-22)

At cutover:
- `POST /api/ai/agent/apply` engineering path disabled or routed through Workspace promotion only
- Agent-mode panel auto-apply for engineering unreachable
- `VibeHarness` execution replaced by V3 orchestration for `ENGINEERING_CHANGE`
- `specs/vibe-coding/` references migrate to `specs/appendoo/`; shard `appendoo-workflows` replaces `vibe-coding-workflows` (alias one release)

Until AE-22, p-50 v1 remains operational for development continuity.

---

## Non-Functional Requirements

- FSD client · Clean Architecture server · HeroUI v3 · AGENTS.md standards
- Zod versioned contracts at service boundaries
- `correlationId` on end-to-end workflows
- Server-side authorization for every tool and mutation
- Control-plane `base_*` never via `EdgeDbRouter`
- Vitest + `npm run test:critical` gate per phase

---

## Phase Traceability

| Phase | Doc | Spec sections |
|-------|-----|---------------|
| AE-0 | `00` | This doc + reality-audit |
| AE-1 | `p-appendoo` § AE-1 | Brand and Naming |
| AE-2 | `02-AI-RUNTIME-AND-INTENT.md` | Architecture Contract, US-1..3 |
| AE-3–6 | `03`–`06` | US-4, US-5, Deep Application Understanding |
| AE-7–9 | `07`–`09` | US-6, US-7, Isolated build |
| AE-10–11 | `10`–`11` | Architect UX, Evaluation |
| AE-22 | `10` §22 | p-50 Cutover |

---

## V4 Corrective Patch — Agent-loop-first (2026-07-12)

**Path A (approved):** Normal implement/plan flows stay on the direct agent loop (`AgentOrchestrator` + native/MCP tools). The engineering pipeline (`ENGINEERING_CHANGE`) remains for macro ASP scenarios only — not for routine WF-4 server-function + UI work.

| Area | Contract |
|------|----------|
| Routing | `agent_implement` / `agent_plan_review` profiles; engineering pipeline off for TOOL_SESSION implement |
| Retrieve gate (GAP-9) | `draft_*` blocked until `get_server_function` + standards shard satisfied |
| Plan mode | `agent_plan_review` — retrieve/lookup tools only; no draft until user approves plan |
| Context | Segment history summary (TOK-15); `contextSummarizeWithLlm` default **on**; token-pressure prune + observation compression |
| UX | Activity feed labels with intention; checkpoint diff zones; turn telemetry (Ctx/Ret/Draft) |
| Eval | `GE-AGENT-WF4-001`, `GE-AGENT-RETRIEVE-001`, `GE-UX-ACTIVITY-001` (routing gates) · `GE-AGENT-WF4-001-E2E` (orchestrator in `goldenEvalAgentLoopE2e` + `test:critical`) |
| Telemetry (§13.1) | Per-turn `retrievalOperationCount` / `draftToolCount`; proposal outcomes via `proposalOutcomeTelemetry`; perceived latency via `chatPerceivedLatencyTelemetry` + `POST /api/ai/agent/chat-latency` |
| API | `POST /api/ai/agent/proposal-feedback` — pre-apply dismiss from `VibeProposalPanel` |
| Governed (V4-PATCH-5) | Reverse ASP from agent `ChangeSet[]` (`buildSemanticPlanFromChangeSets`); promotion approval before export (`requiresPromotionApproval`); structured intent (`classifyGovernedIntentStructured`) only for governed prompts |

Plan: this spec § V4. **Status:** phases 1–5 complete · DoD §13 green.

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [`docs/appendoo/reality-audit.md`](../../docs/appendoo/reality-audit.md) | Verified symbols/paths |
| [`docs/appendoo/decision-log.md`](../../docs/appendoo/decision-log.md) | Phase decisions |
| this spec | Product requirements (V3/V4/V5 archive) |
| [`specs/vibe-coding/01-spec.md`](../vibe-coding/01-spec.md) | Legacy p-50 spec (reference until AE-22) |

---

*Status: Complete (archived) — this spec · AE-0..22 · golden eval closure green.*
