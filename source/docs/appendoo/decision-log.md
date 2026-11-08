# AppEndoo Phase Decision Log

> **Purpose:** Record contract deviations, reuse decisions, and implementation choices during AppEndoo V3 delivery.  
> **Authority:** `01-MASTER-ARCHITECTURE-AND-CURSOR-PROTOCOL.md` · Decision Rule section

---

## V4 — Agent-loop corrective patch (2026-07-12)

### V4-PATCH-0 — Path A decision gate

**Decision:** Adopt **Path A (agent-loop-first)** for routine implement/plan work. Engineering pipeline stays for macro `ENGINEERING_CHANGE` only; WF-4 vertical slices (server function + UI) route through `AgentOrchestrator` with retrieve gate, not ASP finalize.

**Evidence:** `APPENDOO-V4-CORRECTIVE-PATCH-PLAN.md` · `goldenEvalAgentLoop.ts` (GE-AGENT-*, GE-UX-ACTIVITY-001).

**Impact:** P2 routing/profiles, C.3 plan/act split, C.4 token pressure, F.4 observation compression, QW-1 `contextSummarizeWithLlm: true` default, QW-2 settings UI.

### V4-PATCH-4 — Native eval gates (2026-07-12)

**Decision:** P4 routing gates stay sync in `goldenEvalAgentLoop.ts`; full orchestrator path is `GE-AGENT-WF4-001-E2E` via `goldenEvalAgentLoopE2e.ts` + `e2eAgentLoopWf4.test.ts` + `goldenEvalService.evaluateGeAgentWf4OrchestratorE2e()`.

**Evidence:** `goldenEvalAgentLoopE2e.ts` · `e2eAgentLoopWf4.test.ts` · mock provider uses `resolveDraftWorkflowTarget()` shard (WF-2 UI over server-functions page).

### V4-PATCH-4 — Proposal outcome telemetry (§13.1)

**Decision:** In-process buffer `proposalOutcomeTelemetry.ts` records `accepted` / `rejected_full` / `rejected_zone` on apply/rollback and `dismissed_pre_apply` on `POST /api/ai/agent/proposal-feedback` from panel reject.

**Evidence:** `changeSet.service.ts` · `AppEndooPanel.handleVibeReject` · `probeProposalOutcomeTelemetryHealth()` in golden closure.

**Impact:** Acceptance-rate metric can exclude pre-apply dismissals (`dismissedPreApply` separate from `rejected`).

### V4-PATCH-4 — `test:critical` MCP exit fix (2026-07-12)

**Decision:** `p18McpAccessControl.exit.test.ts` mocks `aiManager.isModelToolsCapable` → `true` so MCP access assertions run before model-capability gate (P2.5), not against missing default model in vitest.

**Evidence:** `npm run test:critical` — ۲۳۷ passed.

### V4-PATCH-4 — §13.2 automated gates

**Decision:** All nine MQA-15 prompts have automated **infrastructure** gates in `goldenEvalAcceptancePrompts.ts` (#1 E2E, #2 tool, #3 per-file preview, #4 plan gate, #5 governed routing, #6 summarize trigger, #7 standards checkbox, #8 iteration_limit event, #9 chat queue). Qualitative UI smoke with a live model remains manual in [`p-72-ai-backlog`](../../plans/core/next/p-72-ai-backlog.md) §۵.

**Evidence:** `goldenEvalAcceptancePrompts.test.ts` · `chatSubmitQueue.test.ts` · `VibeProposalPanel.test.tsx`.

### V4-PATCH-5 — Pipeline حاکمیت (۲۰۲۶-۰۷-۱۲)

**Decision:** P5.1 reverse ASP (`buildSemanticPlanFromChangeSets` + `reverse_audit` activity in governed runs). P5.2 promotion approval deferred until verify passes (`requiresPromotionApproval` + `executeApprovedPromotion`). P5.3 `classifyGovernedIntentStructured` via `invokeStructured` + Zod — only when `detectGovernedEngineeringIntent`.

**Evidence:** `semanticPlanFromChangeSets.ts` · `engineeringPipeline.service.ts` · `SemanticPlanApprovalBar.tsx` · `agent.service.approveSemanticPlan` · `goldenEvalV4Patch5.test.ts`.

### V4 closure — Perceived latency + task sign-off (۲۰۲۶-۰۷-۱۲)

**Decision:** §13.1 perceived latency instrumentation shipped (`chatPerceivedLatencyTelemetry.ts` + panel submit echo + `POST /api/ai/agent/chat-latency`). Dev-gate snapshot in `v4QualityMetricsSnapshot.ts`. Production numeric baseline deferred to post-rollout (by design). **V4 corrective patch engineering closed** — only MQA-15 live smoke remains for operator.

**Evidence:** `chatPerceivedLatencyTelemetry.test.ts` · `goldenEval.service` closure probes · `test:critical` ۲۳۸ passed.

### V4-PATCH-4 — Acceptance Prompt Suite (§13.2)

**Decision:** All nine MQA-15 prompts covered by automated infrastructure gates; DoD E2E + deadlock satisfied by `GE-AGENT-WF4-001-E2E` and `V4-DOD-NO-DEADLOCK`. Optional live-model spot-check remains in [`p-72-ai-backlog`](../../plans/core/next/p-72-ai-backlog.md) §۵ for post-release QA.

| # | Prompt (fa) | Phase | Status | Notes |
|---|-------------|-------|--------|-------|
| 1 | برای تابع `math.sum-two-numbers` یک فرم ساده با دو ورودی عددی و دکمه محاسبه بساز | فاز ۴ | ✅ auto | E2E + infra gate |
| 2 | برای تابع محاسبه قیمت یک UI بساز (بدون نام دقیق تابع) | ۲+ | ✅ auto | tool + routing |
| 3 | این سه تابع سرور اعتبارسنجی ورودی مشابه ندارند؛ هرسه را یکسان کن | ۳ | ✅ auto | per-file preview |
| 4 | فقط بررسی کن چه تغییراتی لازم است، فعلاً هیچ فایلی را عوض نکن | ۲ | ✅ auto | plan gate |
| 5 | این تابع را export کن و به پکیج X اضافه کن — با تأیید معمار | ۵ | ✅ auto | governed routing + P5.2 |
| 6 | مکالمه ۱۵+ turn روی layout پیچیده | ۳ | ✅ auto | summarize trigger |
| 7 | یک چک‌باکس ساده با `<input type="checkbox">` اضافه کن | ۳ | ✅ auto | standards validator |
| 8 | کار چندمرحله‌ای نزدیک سقف iteration | ۳ | ✅ auto | iteration_limit event |
| 9 | پیام دوم بلافاصله بعد از اول، قبل از پاسخ agent | ۲ | ✅ auto | chatSubmitQueue |

---

## AE-0 — Reality Audit (2026-07-11)

### AE-0.1 — Repository audit complete

**Decision:** Created `docs/appendoo/reality-audit.md` with verified symbol/path mappings for all `00` §8 gap areas.

**Evidence:** Parallel repository grep and file inspection; subagent audits cross-validated.

**Impact:** AE-2+ runtime coding unblocked after AE-0.2–0.4 sign-off.

---

### AE-0.2 — Spec scaffold location

**Decision:** Create `specs/appendoo/spec.md` as SDD entry point; keep `specs/vibe-coding/` until AE-22 cutover.

**Reason:** p-50 v1 remains operational; dual spec trees avoided during AE-0..AE-21; AE-1 may migrate paths if PO approves per rename map.

**Impact:** Agents read `specs/appendoo/spec.md` for V3; reference `specs/vibe-coding/` for current p-50 behavior only.

---

### AE-0.3 — Reuse matrix decisions

| Concept | Decision | Rationale |
|---------|----------|-----------|
| CODEBASE_INDEX / Feature Graph | **EXTEND** | Working codegen + tool; add validation/fingerprint in later phases |
| search_codebase | **EXTEND** | Lexical hybrid sufficient for bootstrap; true vectors in AE-4 |
| project-standards | **EXTEND** | Single canonical source; no duplicate in prompts |
| Git workspace | **EXTEND / COMPOSE** | Reuse stage/commit/branch; add isolated Engineering Workspace in AE-7 |
| Change sets (v1) | **REPLACE internal** | JSON blob + live apply insufficient; Change Graph at AE-7; disable at AE-22 |
| VibeHarness orchestration | **REPLACE internal** | p-50 loop replaced by V3 pipeline; AiPanel shell EXTEND |
| MCP packs | **EXTEND** | All 15 registrars exist; add Capability Registry layer |
| AiManager | **EXTEND / REFACTOR** | Extract Model Gateway + Router in AE-2; keep provider factory |
| AiPanel | **EXTEND** | Rebrand AE-1; engineering UX AE-10; no second panel |
| Application scope | **RESOLVE / EXTEND** | Introduce `ApplicationScopeRef` in AE-3; compose mountId + packageId + pageKey |

**Forbidden:** Parallel permanent Server Function, Component, or Package artifact types.

---

### AE-0.4 — Pre-implementation policy decisions

#### D-001: Semantic search default mode mismatch — **RESOLVED (AE-4.1)**

**Fix:** `resolveSearchMode()` now defaults to `'hybrid'` when mode omitted — aligns with tool schema and contextAssembly prompts.

#### D-002: Server Function has no code version history

**Expected:** V3 verification/promotion may need revision-scoped function snapshots.  
**Actual:** Single mutable `.ts` + metadata per function; designer has publish snapshots.  
**Decision:** **EXTEND** `FunctionFileStore` with workspace-scoped snapshots in AE-8/9, not a second artifact type.  
**Impact:** Builder protocol must define snapshot boundary.

#### D-003: Git workspace is not physical isolation

**Expected:** V3 Engineering Workspace requires isolation from active runtime.  
**Actual:** Monorepo + deny paths + protected branches only.  
**Decision:** **COMPOSE** — new workspace root (or branch-scoped checkout) in AE-7; Git REST/agent tools remain auxiliary.  
**Impact:** AE-7 must not assume Git alone satisfies isolation.

#### D-004: Agent auto-apply is active engineering bypass

**Expected:** V3 engineering mutations require ASP approval + workspace + verification.  
**Actual:** `AiPanel.executeChatTurn` auto-applies valid Agent proposals to live runtime.  
**Decision:** Disable for `ENGINEERING_CHANGE` class at AE-22; interim p-50 behavior unchanged until cutover.  
**Impact:** AE-10 UX + AE-22 server guard both required.

#### D-005: p2 MCP packs not role-seeded

**Expected:** Capability composition may need packages/memory/cache tools.  
**Actual:** `appendo-packages`, `appendo-memory`, `appendo-cache` not in USER/DEVELOPER default grants.  
**Decision:** Extend `mcpAccessSeed.ts` when Capability Registry consumes them (AE-5/10); ADMIN bypass sufficient for dev.  
**Impact:** Non-admin composition scenarios blocked until seed update.

#### D-006: ApplicationScopeRef deferred to AE-3

**Expected:** V3.4 frozen `ApplicationScopeRef` across persistence.  
**Actual:** No unified type; distributed IDs only.  
**Decision:** Implement resolver in AE-3 Application Intelligence phase; use `{ mountId, pageKey, ownerPackageId? }` tuple in AE-2 stubs if needed.  
**Impact:** AE-2 router may classify without full scope resolution.

#### D-007: EV-3 API key blocker — mock-provider baseline authorized for V5 Phase P00 (2026-07-15)

**Expected:** `PHASE-00-BASELINE-AND-TRAJECTORY.md` requires 20–30 *real*, live-model trajectories before V5 baseline freeze; `ANTI-SCAFFOLD-RULES.md` forbids presenting mock-provider trajectories as real baseline.
**Actual:** EV-3 (p-60, 2026-07-13) is still open as of 2026-07-15 — `settings.json` has no `ai` provider block configured, `logs/app.log` shows `AiManager` failing with "AI model ... is not configured or enabled" as recently as 2026-07-15T08:42:16Z. No live model call can succeed in the current environment. Fixing this requires the PO to supply real provider credentials — outside agent authority to fabricate.
**Decision:** PO explicitly authorized (2026-07-15) proceeding with `createSequentialProvider`/mock-based trajectories as the P00 baseline corpus *for now*, on the condition that every mock-derived trajectory/test is tracked and must be re-run against a real model once EV-3 is resolved. Tracked in [`p-72-ai-backlog.md`](../../plans/core/next/p-72-ai-backlog.md) § Phase D and [`specs/appendoo/spec.md`](../../specs/appendoo/spec.md) § Mock-provider debt.
**Impact:** Any later V5 phase whose exit gate depends on live-model grounding (e.g. Phase 10 replay/eval baselines, Phase 07 completion-gate acceptance evidence) must re-check this debt list before claiming `PASS`. This entry does not override D-003; it is a separate, narrower scope (model-provider grounding only).

#### D-008: T4 workspace sandbox — bounded process-level hardening, NOT full physical isolation (2026-07-15)

**Expected (p-60 T4):** Upgrade agent tool execution from D-003's "deny-path policy only" to a real sandbox — physical isolation of the working tree/process from the live runtime.
**Actual (grounded by direct inspection this session, V5 Phase P09 §V5-14 INSPECT):** Capability control today is 100% static allowlist/denylist evaluated in-process — `pathAllowlist.ts` (`AGENT_ALLOWLIST_ROOTS` root-prefix allow + `AGENT_DENY_PATTERNS` regex deny, e.g. `.env`/`settings.json`/`credentials`), `mcpPolicy.ts`'s `stdioAllowlist`, `httpTools.ts`'s `allowedHostnames` + SSRF guard + byte cap. All of it runs in the **same OS process** as the rest of the server — there is no process, filesystem-namespace, network-namespace, or container boundary between a tool call and the host. `git_commit`/`git_checkout`/`git_branch` (`gitWriteTools.ts`) already never execute git directly — they only create a draft artifact requiring a separate human-approval step before anything is applied (confirmed by direct inspection) — the strongest existing mitigation, and it is a policy-level gate, not physical isolation.
**Options considered:**
  - **A — Full physical isolation now** (container/VM per workspace or per tool-call): correctly matches the doc's literal ambition, but requires container/VM runtime provisioning, deployment-topology changes, and resource orchestration this environment does not have configured (confirmed: no container runtime dependency exists in `package.json`/deployment scripts) — genuinely a separate infrastructure phase, not a change containable within one V5 phase's blast radius.
  - **B — Do nothing, leave D-003 as-is:** rejected — the PO's Master Contract §0.3 explicitly keeps T4 in scope; silently skipping it would violate the no-scope-reduction directive for this phase.
  - **C — Bounded process-level hardening (chosen):** for the tool classes `AgentToolOperationalMetadata.mutation === 'EXTERNAL'` (network/shell-class — `http_request`, any future direct-shell tool), require the execution path to run through an explicit env/cwd-restricted invocation (no ambient credentials env vars, cwd pinned under the resolved workspace root, no access to `process.env` beyond an explicit allowlist) rather than inheriting the full server process environment — real, shippable within this phase, and does not block a later full-container migration (composes with it, same relationship D-003 already established between Git-workspace composition and a future stronger isolation layer).
**Decision:** Adopt **Option C**. This explicitly overrides D-003's boundary ("Git workspace is not physical isolation, deny-path policy only") by adding a second, independent enforcement layer (environment/cwd restriction on the highest-risk tool class) — it does **not** claim D-003 is now fully resolved, and does not claim container-grade physical isolation exists. Full physical isolation (Option A) is deferred to a dedicated infrastructure phase, named here rather than silently dropped.
**Downstream impact:** V5 Phase P09 §V5-14 may proceed implementing Option C (env/cwd-restricted invocation for `mutation: 'EXTERNAL'` tools) without further gating. Any future phase that attempts Option A (real container/VM sandbox) must open its own ADR — this entry does not pre-authorize it, since the infrastructure prerequisites are unverified and out of this phase's evidence base.

#### D-009: AppEndoo V5 Execution Pack archived to `core/done/` (2026-07-16)

**Expected:** Once a plan's engineering scope is closed (all phases at a terminal verdict), delete the plan file — no `done/` archive.
**Actual:** All 12 phases of `APPENDOO-V5-CLAUDE-EXECUTION-PACK` (P00–P11) reached a terminal verdict on 2026-07-15/16 — every one `PASS_WITH_DEBT` (P08 required one real re-attempt after an initial, correctly-triggered `FAIL`; see `PHASE-EVIDENCE-REPORT-P08.md`). A same-session follow-up pass (2026-07-16) additionally shipped V5-21 (async/background execution), V5-24 ("why this plan" data layer), and closed two of P09/P10's own named debt items (dual risk-classification unification, cross-run TaskOutcome telemetry) — see `PHASE-EVIDENCE-REPORT-P11-FOLLOWUP.md`.
**Decision:** V5 pack archived as [`specs/appendoo/spec.md`](../../specs/appendoo/spec.md) (consolidated 2026-07-18; formerly `APPENDOO-V5-CLAUDE-EXECUTION-PACK/`). Active backlog: [`p-72-ai-backlog.md`](../../plans/core/next/p-72-ai-backlog.md).
**Impact:** Remaining, genuinely-blocked work (P08's dual-completion-ownership decision, P09's T4 full physical sandbox, V5-16/19/20/22/25) is tracked in [`p-72-ai-backlog`](../../plans/core/next/p-72-ai-backlog.md) §۵ (**MQA-18**), the same pattern `AppEndWorkflowEngine`'s closure items use in § MQA-17 — archived-but-complete does not mean zero remaining work, it means the remaining work is operator/PO-scoped, not an open coding task.

---

## Template for future entries

```
### AE-X.Y — <title>

**Expected contract:** …
**Actual repository:** …
**Options:** A / B / C
**Decision:** …
**Reason:** …
**Downstream impact:** …
```

---

## AE-2 — Model Gateway + Request Router skeleton (2026-07-11)

### AE-2.1 — Gateway adapter wraps AiManager

**Decision:** Introduce `AiModelGatewayAdapter` delegating to existing `AiManager` — no second provider registry.

**Reason:** Doc `02` requires extend/refactor, not parallel configuration authority.

**Impact:** Future phases add `invokeStructured`, `invokeToolSession` on adapter; domain services import adapter only.

### AE-2.2 — Deterministic router before orchestrator

**Decision:** `routeAssistantRequest` uses mode + `TurnExecutionProfile` + page context — not model-only classification.

**Reason:** V3 trust boundary — model cannot grant tools or escalate execution class.

**Impact:** `request_routing` SSE event emitted from `agent.service`; full Intent pipeline wired in AE-11 phase doc.

### AE-3.1 — ApplicationScopeRef resolver

**Decision:** Introduce `ApplicationScopeRef` + `resolveApplicationScope()` composing `mountId`, `cultureId`, `portalSegment`, `pageKey`, and `packageId` — no new `base_applications` table.

**scopeKey format:** `platform:{mountId}:page:{pageKey}` | `package:{id}` | `vertical:{id}`

**Impact:** `request_routing` SSE now includes `applicationScopeKey` + `applicationScopeKind`.

### AE-3.2 — Feature Graph validation

**Decision:** `validateFeatureGraph()` in `featureGraphValidation.ts`; `loadFeatureGraph()` validates on read.

**Reason:** Doc `03` requires schema validation; allows empty `routePattern` for codegen compatibility.

---

### AE-5.1 — Engineering Knowledge Registry

**Decision:** `ingestProjectStandards()` normalizes `PROJECT_STANDARDS` into `EngineeringKnowledgeRecord` with `PLATFORM_VERIFIED` trust. `get_project_standards` query mode delegates to registry; shard mode unchanged.

**Impact:** Single governed source for standards retrieval — no duplicate prompt constants.

---

### AE-10.2 — ASP approval UX

**Decision:** `SemanticPlanPanel` renders `engineering_pipeline` SSE (objective, artifacts, change nodes, workspace execute counts). Shown alongside `EngineeringPipelineStatus` in AppEndooPanel.

### AE-8.2 — Builder execute scaffold

**Decision:** `runExecuteScaffold()` records workspace-scoped mutations; `EngineeringPipelineService` compiles ASP → ChangeGraph → Workspace → Builder execute for `ENGINEERING_CHANGE` runs.

### AE-6.3 — ASP approval binding

**Decision:** Immutable approval binding ties `planId + revision + contextPack revision + indexVersions`. Builder execute blocked until `/api/ai/agent/plan-approval` approves binding. Upstream drift → `CONTEXT_STALE` / `CAPABILITY_STALE`.

**Impact:** Agent run emits `engineering_pipeline` with `approvalBindingId` + `approvalStatus: pending`; AppEndooPanel shows **Approve & build** CTA.

### AE-8.3 — Builder reconcile/rollback scaffold

**Decision:** After execute, `runReconcileScaffold()` verifies workspace mutation paths; `runRollbackScaffold()` restores from execute `rollbackData`. Wired in `BuilderProtocolService.runPhase()`.

### AE-9.2/10.3 — Verification → promotion wiring

**Decision:** After approved builder execute, `EngineeringPipelineService.verifyAndPromote()` freezes revision, runs Verification Engine, and starts Promotion when `deployable=true`. Only Verification Engine sets deployable — never model/builder.

**Impact:** `EngineeringVerificationPanel` in AppEndooPanel · `GE-PIPELINE-GATE` golden eval E2E.

### AE-8.4 — Platform primitive Builder paths

**Decision:** `resolveBuilderPrimitivePaths()` maps operations to workspace-scoped runtime mirrors (`workspace/server-functions/custom`, `workspace/designer/drafts`, `workspace/platform-registry`, etc.) — never active `src/**` roots.

### AE-9.3 — Promotion staged activation scaffold

**Decision:** `executePromotionScaffold()` advances verified promotion through staged states to `DEPLOYED` with checkpoint + package snapshot id.

### AE-11.3 — Golden eval doc `13` depth

**Decision:** Added `GE-017`/`GE-018` scenarios · `evaluateDoc13EngineeringRouting()` batch · ask-mode write escalation guard in routing eval.

### AE-7.3 — Change Graph scheduler

**Decision:** `changeGraphScheduler.ts` infers dependencies (entity→function→component→page→route→permission→package), runs READY nodes in order, transitions PLANNED→READY→BUILDING→BUILT→VERIFIED.

### AE-9.4 — Runtime activation scaffold

**Decision:** `runtimeActivationScaffold.ts` maps workspace mutations to existing activation APIs (`FunctionFileStore`, Designer publish, route registry, etc.) after DEPLOYED promotion — no active-root writes.

### AE-9.5 — Workspace artifact store + activation adapters

**Decision:** Builder execute persists artifacts to in-memory `workspaceArtifactStore` (workspace-scoped paths only; rejects active `src/**` roots). `runtimeActivationAdapters.ts` validates server-function source + metadata and designer draft JSON against platform contracts before marking ACTIVATED. `runtimeActivationService` orchestrates validation-only activation — live `insertManagedFunctionToStore` / Designer publish deferred to integration flag.

**Impact:** `writeBuilderWorkspaceArtifacts()` on execute · GE-PIPELINE-GATE checks `runtimeActivatedCount > 0`.

### AE-11.4 — Doc `13` pipeline E2E batch

**Decision:** `evaluateDoc13PipelineE2E()` runs routing + GE-PIPELINE-GATE for GE-004, GE-005 and GE-018 engineering change scenarios.

### AE-9.6 — Live FunctionFileStore persistence (default-on under cutover)

**Decision:** Live runtime activation defaults **on** under V3 cutover (including vitest). Opt-out via `APPENDOO_LIVE_RUNTIME_ACTIVATION=0` or master kill switch. `runtimeActivationLive.service.ts` calls `insertManagedFunctionToStore` after workspace validation. Integration tests use isolated tmp cwd + feature-graph copy.

### AE-9.7 — Live ComponentDesigner publish (default-on cascade)

**Decision:** `isLiveDesignerPublishEnabled()` cascades from live runtime flag. `persistLiveDesignerActivationsSync()` wired in production `activateFromMutations()` path (executeApprovedBinding). Async experience-registry compile remains on `activateFromMutationsAsync()`.

### AE-7.6 — Durable Change Graph checkpoints (production path)

**Decision:** `APPENDOO_DURABLE_GRAPH_CHECKPOINTS=1` persists checkpoints through `executeApprovedBinding` scheduler batches to disk/SQLite backing. `engineeringPipeline.durableCheckpoint.test.ts` verifies restart reload via `changeGraphCheckpointStore.read()` after `resetForTests()`. `changeGraphCheckpointBackingHealth` probes disk mode; SQLite tests call `closeSharedCheckpointDb()` in afterEach.

### AE-11.9 — Doc `13` scenario eval depth + GE-021

**Decision:** `evaluateDoc13LabeledStatusGates()` adds ASP/reuse attribution depth for GE-017/GE-019 and v1-block depth for AVAILABLE_NOW scenarios. `evaluateLiveActivationRoundtripGate()` (GE-021) probes `probeLiveRuntimeActivationDepth()` + GE-PIPELINE-GATE. Golden closure includes `liveActivationProbeOk`.

### AE-Archive — p-AppEndoo moved to `core/done/`

**Decision:** Executable backlog complete (AE-0..22). Historical move to `core/done/` is obsolete — completed plans are deleted. Active work: [`p-72-ai-backlog.md`](../../plans/core/next/p-72-ai-backlog.md).

**۲۰۲۶-۰۷-۱۳ — اجرا شد:** `git mv` به `core/done/AppEndoo`. **۲۰۲۶-۰۷-۱۸:** آرشیو یکپارچه → [`specs/appendoo/spec.md`](../../specs/appendoo/spec.md). ادامه‌ی کار در [`p-72-ai-backlog.md`](../../plans/core/next/p-72-ai-backlog.md).

---

*Last updated: 2026-07-18 — consolidated archive `p-appendoo-archive.md` · active backlog `p-72-ai-backlog.md`*

### AE-11.5 — Doc `13` full golden batch

**Decision:** `evaluateDoc13FullBatch()` runs all 18 routing scenarios + GE-PIPELINE-GATE + per engineering-pipeline scenario markers. Release-blocking routing failures must be zero.

### AE-7.4 — Change Graph scheduler depth

**Decision:** `retryEligibleFailedNodes()` re-queues retryable FAILED nodes; `getRunnableNodesWithBranchLocks()` + `resolveChangeNodeBranchId()` isolate parallel branches; scheduler tracks `parallelPeakCount` and `retriedCount`.

### AE-7.5 — Change Graph checkpoint resume

**Decision:** `changeGraphCheckpointStore` persists in-memory scheduler state after each batch; `resumeChangeGraphExecution()` continues from last checkpoint without re-running VERIFIED nodes.

### AE-9.8 — Experience registry compile (opt-in)

**Decision:** `APPENDOO_LIVE_EXPERIENCE_REGISTRY=1` enables `propagateDesignerLayoutRoutes` after Designer publish and for workspace route artifacts via `activateFromMutationsAsync()`.

### AE-11.6 — Golden routing accuracy hardening

**Decision:** `detectOperationalActionIntent()` + router `OPERATIONAL_ACTION` class for platform jobs/tasks; release-blocking routing accuracy meets 0.9 threshold in full doc `13` batch.

### AE-9.9 — Package snapshot finalize

**Decision:** `finalizePackageSnapshotScaffold()` builds artifact manifest + integrity hash after DEPLOYED; `promotionService.executePromotion()` persists snapshot via `packageSnapshotStore`. GE-PIPELINE-GATE checks `packageSnapshotId`.

### AE-11.7 — Doc `13` labeled status gates

**Decision:** `catalogStatus` on each GE scenario (`AVAILABLE_NOW`, `V3_4_TARGET`, etc.); `evaluateDoc13LabeledStatusGates()` enforces routing + pipeline requirements per label.

---

*Last updated: 2026-07-11 — AE-22.7*

---

### AE-22.7 — VibeHarness symbol removal (2026-07-11)

**Decision:** Remove `VibeHarness.ts` after engineering-pipeline e2e parity (AE-22.6). Replace with minimal `AgentImplementGate` (no retrieve gate / finalize loop). Engineering finalize remains blocked via `shouldBlockV1ProposalForEngineering`.

**Registry:** V1D-04 → `REMOVED` · V1D-05 → `GUARDED` · V1D-06 → `DEPRECATED` (legacy e2e test-only).

**Red-team:** RT-08 — no legacy e2e in `test:critical`.

---

### AE-22.6 — Engineering pipeline e2e migration (2026-07-11)

**Decision:** Replace `e2eVibe*` / `e2e41*` in `test:critical` with `e2eEngineeringPipelineWf{1,3,4,41}` suites. Each scenario runs `runScaffold` → `approve` → `executeApprovedBinding` and asserts `verificationGraderSummary` (not VibeHarness).

**Registry:** `appendooV1E2eMigration.ts` marks all legacy suites `MIGRATED` with engineering-pipeline replacement ids. Legacy suites remain `@deprecated` for reference only.

**Fix:** `executeApprovedBinding` now forwards `verificationGraderSummary` from verify/promote path.

**Impact:** RT-08 gate unlocked — VibeHarness removal no longer blocked by critical-path e2e.

---

### AE-22.5 — V1 sunset safe migration (2026-07-11)

**Decision:** Complete V1D-* dead-code registry (V1D-04 VibeHarness loop, V1D-06 legacy e2e). Retain `VibeHarness` until engineering-pipeline e2e parity — do NOT delete while `e2eVibe*` / `e2e41*` suites depend on it.

**Legacy e2e policy:** Suites marked `@deprecated` + `assertV1LegacyE2eSuiteAllowed()` guard (test env only). Migration target: `engineeringPipelineService.runScaffold` / `executeApprovedBinding`.

**Symbols audited:**
| Symbol | Status | Replacement |
|--------|--------|-------------|
| `VibeHarness` | DEPRECATED (retained) | V3 Context Pack → ASP → Change Graph |
| `AgentOrchestrator` v1 finalize | GUARDED | `shouldBlockV1ProposalForEngineering` |
| Panel auto-apply | GUARDED | `shouldBlockPanelAutoApply` |

**Impact:** RT-07 red-team item tracks migration registry; full symbol removal blocked on e2e migration.
