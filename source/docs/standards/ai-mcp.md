# AI agent MCP platform

> **Shard:** `mcp-servers` · **In-app playbooks:** [`vibe-operator-playbook.md`](./vibe-operator-playbook.md)

## Product name — AppEndO

The built-in in-app AI assistant is branded **AppEndO** (not Copilot, AI Chat, or generic “assistant” in shell chrome). Do not put a chat trigger in the main shell header. `ShellAppEndOButton` remains the Bot control (Designer overlay). Screen-reader labels use culture keys `shell.openAppendo` / `shell.closeAppendo`. Occasional subtle attention cues on the closed trigger are allowed (`useAppEndOAttentionCue`) and must respect `prefers-reduced-motion`.

- Built-in packs: in-process under `src/server/services/ai/mcp/builtin/`; catalog `capabilityPacks.ts`.
- MCP tools **Agent mode only**; Plan/Ask must not expose them.
- Scope UI: `AgentCapabilityDropdown.tsx`; persists `agent_capability_scope_json`.
- Default scope: `DEFAULT_AGENT_CAPABILITY_SCOPE` in `capabilityPacks.ts`.
- Write/git-write tools require confirm gate.
- External MCP: SSRF guard (`validateMcpRemoteUrl`); stdio allowlist `ai.mcp.stdioAllowlist[]`; surface errors in trace/UI.
- `appendo-web`: `web_search` · `fetch_url` (readable markdown by default) · `screenshot_url` (Playwright JPEG, SSRF-protected).
- `appendo-http`: only `ai.http.allowedHostnames[]`.
- Inbound host: `GET/POST/DELETE /api/mcp`; API key auth; packs from `ai.mcp.defaultCapabilityPackIds` (draft/git-write excluded).
- Settings: `src/features/settings/components/mcpServers/`.
- Greenfield only — no dual registration paths.
- **Token runtime (p-39):** Agent loop compacts tool observations before they enter LLM history (`toolObservationCompact.ts`); full payloads stay in per-run store for trace/UI. Auto-prune removes duplicate and stale tool messages each iteration (`contextToolObservationMaxTurns`). `listDefinitions({ activePackIds })` limits native tool schema to session-enabled packs. Segment H: heuristic or optional `contextSummarizeWithLlm`; persisted on `base_ai_chat_sessions.context_history_summary`. Token budget uses model-aware `tokenEstimator.ts`.

## Internal vibe coding

In-app **AppEndO Agent** (Server Functions · Component Designer · file patches). Playbooks: `vibe-operator-playbook` + `vibe-coding-workflows`. Spec: `specs/vibe-coding/`.

Unified live runtime: generated functions/layouts run on **this same instance** after apply.

## End-user AI assist (EUA)

In-app field help for end users — **separate from** the AppEndO Agent panel (`AiPanel`). Shipped.

| Capability | Settings key (EUA-14) | Implementation |
|------------|----------------------|----------------|
| Textarea context menu + diff/undo | `eua.contextMenu` · `eua.diffUndo` | `src/shared/ui/ai-field-assist/` |
| Field assist on forms (context suggest, structured extract) | `eua.contextSuggest` · `eua.structuredExtract` | `AiAssistFormField` · `AiFieldAssistSectionProvider` · [`ui-core.md`](./ui-core.md) §EUA fields |
| **Image editor AI** (EUA-1) | `eua.imageEditorAi` | [`ImageEditorAiPanel.tsx`](../../src/shared/ui/image-editor/ImageEditorAiPanel.tsx) · [`ImageEditorModal.tsx`](../../src/shared/ui/image-editor/ImageEditorModal.tsx) |
| Semantic field validation (LLM rubric) | `eua.semanticValidation` | `POST /api/eua/field-assist/semantic-validate` · `SemanticAssistTextarea` · `useSemanticFieldValidation` · rubric on `Base Info` metadata (`userGuidance`, `semanticRubric`) or static/`cultureKey`/`vocabOption` policy · Component Designer textarea Advanced: **Semantic rubric** (static or culture key) exports as `SemanticAssistTextarea` |
| In-page vocab guidance edit (admin) | `eua.vocabContextAuthoring` | `PATCH /api/eua/vocab-context/:id` (ADMIN/DEVELOPER) · `ContextVocabSemanticEditDialog` |

Full end-user how-to docs: deferred to [`p-44-platform-documentation.md`](../../plans/core/next/p-44-platform-documentation.md) when active.

**IDs:** `ai.assistant.product-name`, `ai.mcp.*`, `ai.vibe.*`.
