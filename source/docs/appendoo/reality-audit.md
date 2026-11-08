# AppEndoo Reality Audit

> **HISTORICAL (۲۰۲۶-۰۷-۱۵):** Snapshot at AE-0 (۲۰۲۶-۰۷-۱۱). Gaps in §20 closed by AE-1..AE-22 ([`decision-log.md`](decision-log.md)). **Spec:** [`specs/appendoo/spec.md`](../../specs/appendoo/spec.md).

> **Phase:** AE-0.1  
> **Date:** 2026-07-11  
> **Authority:** [`specs/appendoo/spec.md`](../../specs/appendoo/spec.md)  
> **Status:** Complete — gate for AE-2+ runtime coding

---

## Purpose

Freeze exact repository symbols, paths, and contracts for the areas listed in doc `00` §8 before AppEndoo V3 implementation. Architectural meaning is preserved when names differ from V3 plans; actual mappings are recorded here.

**Brand note (pre-AE-1):** UI still shows **AppEndO Chat**; component `AiPanel`; hooks `useAppEndOChatShell`, `ShellAppEndOChatControl`. AE-1 renames to **AppEndoo** per `p-appendoo.md` § AE-1. Platform name **AppEndO** and `appendo-*` MCP pack IDs remain unchanged.

---

## 1. CODEBASE_INDEX schema

| Role | Path | Symbol |
|------|------|--------|
| npm script | `package.json` | `codegen:ai-index` |
| CLI | `scripts/codegen-ai-index.ts` | `writeAiIndexArtifacts(rootDir)` |
| Schema (TS) | `src/shared/lib/aiIndexCodegen.ts` | `FeatureGraph`, `FeatureGraphNode`, `StudioNavItem`, `PageModuleRecord` |
| Graph builder | same | `buildFeatureGraph(rootDir)` |
| Markdown | same | `renderCodebaseIndexMarkdown(graph)` |
| Cursor rules | `src/shared/lib/cursorRuleCodegen.ts` | `writeCursorFeatureRules` |
| Generated MD | `docs/ai/CODEBASE_INDEX.md` | Human nav map |
| Generated JSON | `docs/ai/feature-graph.json` | Machine-readable graph |
| Tests | `src/shared/lib/__tests__/aiIndexCodegen.test.ts` | |

**`FeatureGraph` shape:** `version` (hardcoded `'1'`), `generatedAt`, `source`, `nodes[]` where each node has `pageKey`, `label`, `menuGroup`, `routePattern`, `inStudioMenu`, `ui{pageModule,loaderRef,page,feature,domain,workspace}`, `api{routes,apiPrefixes,contracts,services}`, `tests`, `notes`.

**Inputs:** `src/config/platform-registry/navigation/studio.json`, `src/config/platform-registry/page-modules/*.json`.

**Gaps:** No JSON Schema file; no content-hash fingerprint beyond `generatedAt`; `ORPHAN_FEATURES` unused (`[]`).

---

## 2. Feature Graph schema & `get_feature_graph`

| Role | Path | Symbol |
|------|------|--------|
| Schema | `src/shared/lib/aiIndexCodegen.ts` | `FeatureGraph`, `FeatureGraphNode` |
| Store | `src/shared/lib/featureGraphStore.ts` | `loadFeatureGraph()`, `findFeatureGraphNode()`, `summarizeFeatureGraph()`, `buildFeatureGraphSearchContext()`, `resolveFeatureSearchRoots()` |
| Tool | `src/core/ai/tools/native/getFeatureGraph.ts` | `GET_FEATURE_GRAPH_TOOL_NAME` = `'get_feature_graph'` |
| Pack | `src/server/services/ai/mcp/builtin/codebasePack.ts` | `appendo-codebase` |
| Search merge | `src/core/ai/tools/native/searchCodebase.ts` | `resolveScopedFeatureGraph()`, `annotateMatchesWithFeatureGraph()` |
| PageKey resolver | `src/shared/lib/resolvePageKeyFromPath.ts` | `resolvePageKeyFromPath()` |

**Tool modes:** index (no `pageKey`) returns summary; scoped returns node + `searchContext`. Errors: `feature_graph_missing`, `page_key_not_found`.

**Gaps:** No runtime validation on JSON load; `searchContext.searchRoots` derived heuristically.

---

## 3. AiPanel orchestration state machine

**No client-side FSM.** Orchestration is server-side p-50 v1:

| Role | Path | Symbol |
|------|------|--------|
| UI monolith | `src/components/AiPanel.tsx` | `AiPanel` — Plan/Ask/Agent, sessions, vibe proposals, apply/rollback |
| Lazy host | `src/components/LazyAiPanel.tsx` | `LazyAiPanel` |
| App host | `src/shared/ui/shell/AppEndOChatHost.tsx` | `AppEndOChatHost` |
| Orchestrator | `src/core/ai/AgentOrchestrator.ts` | iteration loop: LLM → policy → tools → finalize |
| Phase gate | `src/core/ai/agent/VibeHarness.ts` | `VibePhase`: `'analyze' \| 'retrieve' \| 'plan' \| 'draft' \| 'finalize'` |
| Policy | `src/core/ai/agent/orchestrationPolicy.ts` | `OrchestrationPolicy`, `createOrchestrationPolicy` |
| Workflow | `src/core/ai/agent/vibeWorkflowContext.ts` | `VibeWorkflowId`, WF-1..4 routing |
| Turn profile | `src/core/ai/agent/turnExecutionProfile.ts` | `TurnExecutionProfile`, `resolveTurnExecutionProfile` |
| Prompts | `src/core/ai/agent/contextAssembly.ts` | system prompt + vibe rules |
| Gateway | `src/core/ai/AiManager.ts` | `processAgentRun` |
| Service | `src/server/services/ai/agent.service.ts` | `runStream`, `apply`, `rollback` |
| Stream contract | `src/shared/api/contracts/ai/agentTypes.ts` | `AgentStreamEvent` union |
| Draft bridge | `src/core/ai/tools/native/agentDraftStore.ts` | in-memory `AgentDraft` map |
| Proposal build | `src/core/ai/validation/changeSetBuilder.ts` | `buildChangeSetsFromDrafts` |
| Validation | `src/core/ai/validation/proposalValidator.ts` | `validateProposal` |

**Gaps vs V3:** No Assistant Request Router, Intent Compiler, ASP, Change Graph, Workspace Revision, or Verification Engine. `VibeHarness` phases are p-50 retrieve→plan→draft→finalize, not V3 engineering lifecycle.

---

## 4. Change-set persistence schema

| Role | Path | Symbol |
|------|------|--------|
| Prisma model | `prisma/schema.prisma` | `BaseAiAgentApplySnapshot` → `base_ai_agent_apply_snapshots` |
| Fields | same | `changeSetsJson`, `snapshotsJson`, `proposalId`, `sessionId`, `appliedAt`, `rolledBackAt` |
| Repository | `src/server/domain/ai/agentApplyRepository.ts` | `insertAgentApplySnapshot`, `getLatestAgentApplySnapshot`, etc. |
| Contract types | `src/shared/api/contracts/ai/agentTypes.ts` | `ChangeSet`, `ChangeSetKind`, `AgentApplyRequest`, `AgentApplyResult` |
| Kinds | same | `component_layout_patch`, `function_source_patch`, `settings_block_patch`, `file_patch`, `git_operation` |

**Gaps:** JSON blob only — no normalized Change Graph nodes or Workspace Revision IDs. `settings_block_patch` in types but apply throws in v1.

---

## 5. Confirmed write pipeline

```
draft_* tools → agentDraftStore (memory)
  → buildChangeSetsFromDrafts → validateProposal
  → SSE proposal + validation_result
  → AiPanel handleVibeApply → POST /api/ai/agent/apply
  → AgentService.apply → ChangeSetService.apply
  → insertAgentApplySnapshot + verifyAppliedChangeSets
```

| Role | Path | Symbol |
|------|------|--------|
| Core writer | `src/server/services/ai/changeSet.service.ts` | `ChangeSetService.apply`, per-kind writers |
| Git ops | `src/server/services/ai/gitOperationApply.ts` | `applyGitOperationChangeSet` |
| Post-verify | `src/server/services/ai/postApplyVerify.service.ts` | `verifyAppliedChangeSets` |
| Routes | `src/server/routes/ai.routes.ts` | `POST /agent/apply`, `/agent/rollback` |
| Gate | `src/shared/api/contracts/ai/constants.ts` | `writeRequiresConfirm` default `true` |

**Gaps vs V3:** Writes go directly to live runtime roots (designer drafts, `workspace/server-functions/`, allowlisted files). V3 requires Workspace-bound Builders; active-root direct writes forbidden after AE-22.

---

## 6. MCP server/tool authorization boundary

| Stage | Path | Key symbols |
|-------|------|-------------|
| Catalog | `src/shared/api/contracts/ai/capabilityPacks.ts` | `AI_CAPABILITY_PACK_CATALOG`, `DEFAULT_AGENT_CAPABILITY_SCOPE` |
| Registration | `src/server/services/ai/mcp/builtin/index.ts` | `BUILTIN_CAPABILITY_PACK_REGISTRARS` (15 packs) |
| Enabled | `AiMcpServerConfig.enabled`, session defaults | `defaultEnabled`, `DEFAULT_ENABLED_CAPABILITY_PACK_IDS` |
| Grant (RBAC) | `src/server/services/ai/mcpAccess.service.ts` | `resolveEffectiveMcpAccessForUser`, `buildEffectiveMcpAccessFromGrants` |
| DB grants | `src/server/domain/ai/mcpAccessRepository.ts` | `base_role_mcp_grants` |
| Seed | `src/server/services/ai/mcpAccessSeed.ts` | `USER_DEFAULT_BUILTIN_PACK_IDS`, `DEVELOPER_EXTRA_BUILTIN_PACK_IDS` |
| Resource ACL | `mcpAccess.service.ts` | `filterEffectiveMcpAccessByResourcePolicy` |
| Session scope | `src/server/domain/ai/chatHistoryRepository.ts` | `agentCapabilityScopeJson` on `BaseAiChatSession` |
| Run enforcement | `agent.service.ts` | `intersectAgentRunCapabilityScope`, `assertAgentRunWithinMcpAccess` |
| Mode gate | `src/core/ai/tools/ToolRegistry.ts` | `isToolAllowed` — ask/plan/agent profiles |
| Inbound MCP | `src/server/routes/mcp.routes.ts`, `mcpInboundAuth.ts` | API key + pack clamp |

**Gaps:** `appendo-memory`, `appendo-cache`, `appendo-packages` (p2) not in default role seeds; Ask mode uses fixed `ASK_AGENT_CAPABILITY_SCOPE` independent of user grants intersection.

---

## 7. Git workspace physical isolation

| Role | Path | Symbol |
|------|------|--------|
| Repo root | `src/core/ai/tools/pathAllowlist.ts` | `getRepoRoot()` → `process.cwd()` |
| Deny patterns | same | `AGENT_DENY_PATTERNS`, `isDeniedPath()` |
| Git guard | `src/core/ai/tools/native/git/gitRunner.ts` | `validateGitPath()`, `PROTECTED_BRANCH_NAMES` |
| Gitignore | `src/server/services/git/gitNativeConfig.ts` | `STANDARD_WORKSPACE_GITIGNORE` |
| REST ops | `src/server/services/git/gitWorkspace.ts` | stage, unstage, checkout, diff |
| Commit | `src/server/services/git/gitRemoteOps.ts` | `commitGitChanges()` |
| Agent git | `src/core/ai/tools/native/git/gitTools.ts`, `gitWriteTools.ts` | read + draft write tools |
| UI | `src/features/git/` | `GitWorkspace.tsx`, `GitPageView.tsx` |

**Isolation reality:** Single host monorepo at CWD. Isolation = path deny-list + gitignore + protected-branch policy. **No** per-session engineering sandbox or branch-isolated workspace.

---

## 8. Component Designer draft/publish artifacts

| Artifact | Path |
|----------|------|
| Draft JSON | `workspace/designer/drafts/<folder>/<name>.json` |
| Companion TSX | `workspace/designer/drafts/<folder>/<name>.tsx` |
| Draft index | `workspace/designer/index.json` |
| Publish index | `workspace/designer/publish/index.json` |
| Version snapshots | `workspace/designer/snapshots/<folder>/<draftId>/<n>.json` |
| Types | `src/server/domain/component-designer/draftTypes.ts` — `DesignerDraftRecord` |
| Publish | `src/server/services/component-designer/publishCoordinator.service.ts` |
| Loader ref | `src/domain/component-designer/publishLoaderRef.ts` — `<folder>/<name>@v<n>` |

**Gaps:** File-backed only (no DB); dual identity (draft `id` vs `componentPath` vs `loaderRef`).

---

## 9. Server Function version storage and registry

| Artifact | Path |
|----------|------|
| Source | `workspace/server-functions/custom/<folder>.<name>.ts` |
| Metadata | `workspace/server-functions/custom/<folder>.<name>.metadata.json` |
| Index | `workspace/server-functions/index.json` |
| Store | `src/core/functions/FunctionFileStore.ts` |
| Route registry | `src/server/services/managedFunctionRouteRegistry.ts` |
| Compile cache | `src/core/api/sandboxCompileCache.ts` |

**Version semantics:** `runtimeVersion` = Node target; `schemaVersion` = file format. **No code version history** — single mutable `.ts` per function (unlike designer publish snapshots).

---

## 10. Package manifest / internal artifact contracts

| Role | Path |
|------|------|
| Extension manifest | `src/core/packages/PackageManifestValidator.ts` |
| Vertical manifest | `src/core/packages/verticalAppManifestValidator.ts` |
| API types | `src/shared/api/contracts/package-manifest/types.ts` |
| Object registry | `src/server/domain/package-domain/types.ts` — `PluginObjectRegistry` |
| Registry builder | `src/server/domain/package-domain/registryBuilder.ts` |
| Storage | `src/core/packages/PackageFileStore.ts` — `packages-storage/` |

**Gaps:** Two manifest type systems (core vs API DTO); vertical vs extension registry paths differ.

---

## 11. Runtime registry compilation / hot-load

| Subsystem | Mechanism |
|-----------|-----------|
| Platform registry | `PlatformRegistryFileStore` — JSON under `workspace/platform-registry/`; `invalidatePlatformRuntimeConfig` |
| Server Functions | `managedFunctionRouteRegistry.invalidate()` → `scheduleReload()` |
| Package APIs | `packageApiRuntime.service.ts` — extract to `packages-storage/runtimes/` |
| Designer publish | JSON snapshot served to `DesignerPublishedPage` — no Vite rebuild |
| Experience manifest | `compileExperienceManifest.ts` — manifest → registry rows |

**Pattern:** Invalidate + lazy reload per subsystem. No single global activation API.

---

## 12. Project standards response schema

| Role | Path | Symbol |
|------|------|--------|
| Canonical data | `src/config/projectStandards.ts` | `PROJECT_STANDARDS`, `ProjectStandardsResource` |
| HTTP | `src/server/bootstrapFullRuntime.ts` | `GET /api/project-standards` → `{ success, resource }` |
| Tool | `src/core/ai/tools/native/getProjectStandards.ts` | `get_project_standards` |
| Shard loader | `src/core/ai/tools/native/standardsShardLoader.ts` | topic shards |

**Shape:** `{ version, updatedAt, standards: ProjectStandard[] }` where `ProjectStandard = { id, title, value, appliesTo[] }`.

**Gaps:** No Zod/OpenAPI contract in `shared/api/contracts/`; tool returns filtered/truncated shape vs raw GET.

---

## 13. AI model configuration / provider internals

| Role | Path | Symbol |
|------|------|--------|
| Gateway | `src/core/ai/AiManager.ts` | singleton; `reloadFromSettings`, `processAgentRun` |
| Provider contract | `src/core/ai/IAiProvider.ts` | `chat`, `streamChat`, `chatWithTools` |
| Factory | `src/core/ai/providers/providerFactory.ts` | `createProviderForModel`, `createProviderForSettingsModel` |
| Settings | `src/server/services/ai/aiSettings.service.ts` | `AiSettingsService` |
| Persistence | `src/server/db/aiSettingsStore.ts` | platform blob `'ai'` |
| Contracts | `src/shared/api/contracts/ai/types.ts` | `AiSettings`, `AiModelEntry`, `AiProviderConfig` |
| Providers | `src/core/ai/providers/*.ts` | OpenAI, Azure, Anthropic, Gemini, Ollama, OpenAI-compatible |

**Gaps:** Monolithic `AiManager`; tool capability declared (`capabilities.tools`) and runtime-checked (`chatWithTools`) but not validated at settings save.

---

## 14. `search_codebase` semantic/hybrid implementation

| Role | Path |
|------|------|
| Tool | `src/core/ai/tools/native/searchCodebase.ts` |
| Chunk index | `src/core/ai/tools/native/codeChunkIndex.ts` — lexical TF over 80-line chunks |
| Merge | `searchCodebase.ts` — `mergeHybridMatches` (RRF-style) |
| Exact | ripgrep → Node walk fallback |

**Modes:** `exact` (code default), `semantic` (chunks only), `hybrid` (both).

**Gaps:** No embeddings/vectors — "semantic" is lexical only. Default mismatch: code defaults `exact`; prompts/schema text say hybrid. 5-min TTL chunk cache.

---

## 15. Canonical application scope identity

| Finding |
|---------|
| **No** `ApplicationScope`, `ApplicationScopeRef`, or `ApplicationScopeResolver` in `src/` — V3 design only |

**Distributed primitives today:**

| Concept | Path | ID |
|---------|------|-----|
| Studio mount | `src/shared/api/contracts/platform/mountConstants.ts` | `STUDIO_MOUNT_ID` = `'studio'` |
| Platform mount | `src/shared/api/contracts/platform/types.ts` | `PlatformMount.id`, `ownerPackageId` |
| Route binding | same | `PlatformRouteBinding.pageKey`, `routePattern` |
| Package | `src/core/packages/PackageManifestValidator.ts` | `PackageManifest.id` |
| Feature graph | `aiIndexCodegen.ts` | `pageKey` |

**Closest runtime tuple:** `{ cultureId, mountId, portalSegment, pageKey }` — not unified under one scope ref.

---

## 16. AiPanel auto-apply behavior

| Location | Behavior |
|----------|----------|
| `src/components/AiPanel.tsx` `executeChatTurn` | After agent stream: if Agent mode + valid proposal + not informational query → `handleVibeApply` **without user click** |
| `src/shared/lib/vibeProposalUi.ts` | Typed confirm fallback via regex |
| `src/config/projectStandards.ts` | rule `ai.vibe.confirm-and-rollback` documents auto-apply |
| `AgentOrchestrator.ts` finalize | text assumes panel auto-applies |

**Exclusions:** validation errors, informational queries, Plan mode.

**Gap vs V3:** Auto-apply bypasses ASP approval, Change Graph, Workspace, Verification — direct to `changeSet.service.apply`. Must be unreachable after AE-22 for engineering branch.

---

## 17. p-50 v1 implementation map (superseded at AE-22)

| Area | Path |
|------|------|
| Spec | `specs/vibe-coding/01-spec.md` |
| Harness | `src/core/ai/agent/VibeHarness.ts` |
| Draft tools | `draftServerFunction.ts`, `draftComponentLayout.ts`, `draftFilePatch.ts` |
| Apply | `changeSet.service.ts` |
| UI | `AiPanel.tsx`, `VibeProposalPanel.tsx` |
| Standards shard | `vibe-coding-workflows` in `getProjectStandards.ts` |

---

## 18. AE-1 rename inventory (grep evidence 2026-07-11)

| Pattern | Hit count (approx) | Primary locations |
|---------|-------------------|-------------------|
| `AppEndO Chat` | ~15 files | `AiPanel.tsx`, shell headers, `contextAssembly.ts`, plans |
| `useAppEndOChatShell` | 4+ | `useAppEndOChatShell.ts`, tests, layouts |
| `ShellAppEndOChatControl` | 6+ | component + layout imports |
| `APPENDO_CHAT_SETUP_TOAST` | 4+ | shell hook + test |

Symbols pending AE-1: `AiPanel`, `aiPanelPreferences`, `aiPanelDock`, `AppEndOChatHost`, `LazyAiPanel`.

---

## 19. Mandatory reuse decision matrix (AE-0.3)

| Required concept | Existing primitive | Decision | Evidence |
|------------------|-------------------|----------|----------|
| Code intelligence | `CODEBASE_INDEX` + Feature Graph + `get_feature_graph` | **EXTEND** | Mature codegen (`aiIndexCodegen.ts`), tool surface, tests; add schema validation + hash fingerprint in AE-3/4 |
| Semantic search | `appendo-codebase` / `search_codebase` | **EXTEND** | Ripgrep + lexical chunks work; add true vector leg in AE-4; fix default-mode mismatch |
| Standards | `/api/project-standards` + `get_project_standards` | **EXTEND** | Canonical `PROJECT_STANDARDS`; ingest into Knowledge Registry in AE-5 |
| Workspace | Git monorepo + deny paths | **EXTEND / COMPOSE** | `gitWorkspace.ts` + REST + agent git tools exist; add isolated Engineering Workspace in AE-7 — Git alone insufficient |
| Change sets | AiPanel change sets + `BaseAiAgentApplySnapshot` | **REPLACE** (internal) | JSON blobs + live apply; V3 Change Graph + Workspace Revision replaces persistence model at AE-7/22; v1 path disabled at cutover |
| Orchestration | AiPanel Agent + `VibeHarness` | **REPLACE** (internal) | p-50 loop active; V3 Intent→ASP→Builders pipeline replaces at AE-2..8; UI shell **EXTEND** |
| Tools | 15 `appendo-*` MCP packs | **EXTEND** | Full registrar in `builtin/index.ts`; add capability registry layer in AE-5/10 |
| AI runtime | `AiManager` + `IAiProvider` | **EXTEND / REFACTOR** | Working multi-provider gateway; extract Model Gateway + Request Router in AE-2 without provider SDK in domain |
| Assistant | AppEndoo (`AiPanel`) | **EXTEND** | Rich UI exists; rename AE-1; add engineering views AE-10; cutover AE-22 |
| App scope | mountId + packageId + pageKey (distributed) | **RESOLVE / EXTEND** | No `ApplicationScopeRef` yet; introduce resolver in AE-3 per V3 contract |

**Rule:** `REPLACE` applies to p-50 **execution internals** only — not platform primitives (Server Functions, Designer, packages, MCP pack IDs).

---

## 20. Cross-cutting gaps summary

1. No V3 engineering pipeline (Router, Intent, ASP, Change Graph, Workspace, Verification, Promotion).
2. p-50 v1 write path active — direct live-root apply + Agent auto-apply.
3. No `ApplicationScopeRef` — scope distributed across platform registry + packages + pageKey.
4. Semantic search naming oversells lexical implementation.
5. Server Functions lack code version history (designer has publish snapshots).
6. Git workspace is monorepo policy, not isolated engineering sandbox.
7. AE-1 rebrand not started — legacy symbols throughout UI/code.

---

*Next: `specs/appendoo/spec.md` (AE-0.2) · `docs/appendoo/decision-log.md` (AE-0.4)*
