import type { AgentMessage, AgentRunConfig } from './types';
import { buildAiSystemContextWithResources } from '../../../shared/api/contracts/ai/chatContextResources';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../shared/api/contracts/ai/constants';
import type { McpAccessContextSnapshot } from '../../../shared/api/contracts/ai/mcpAccess';
import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import { shouldPreferUIWorkflow, detectContinuationIntent, resolveEffectiveUserIntent, isServerFunctionsPageContext } from '../../../shared/lib/detectCodingIntent';
import {
  extractPromptEngineeringTargets,
  hasPromptEngineeringTargets,
  promptTargetsConflictWithPage,
  resolvePromptEngineeringTargets,
} from '../../../shared/lib/appendoo/promptEngineeringTargets';
import { formatTaskDecompositionForSystemPrompt } from './promptTaskDecomposition';
import { aiManager } from '../AiManager';
import { formatActiveVibeWorkflowBlock } from './vibeWorkflowContext';
import { sliceAgentMessagesForContext } from './toolMessageSequence';
import { listDesignerDrafts } from '../../../server/domain/component-designer/drafts';
import type { DesignerDraftSummary } from '../../../server/domain/component-designer/draftTypes';
import { buildDesignerComponentPath } from '../../../shared/lib/designerComponentPath';

/** AppEndO Agent identity — live runtime, platform-constrained development (VC-6). */
export const APPENDO_AGENT_IDENTITY = [
  'You are AppEndO — the internal admin-platform development copilot.',
  'You operate on a live running AppEndO instance: applied Server Functions and Component Designer layouts take effect immediately on this same runtime (no separate sandbox or deploy pipeline).',
  'Build with AppEndO\'s own standards, templates, and agent tools — that\'s what keeps changes safe and consistent on a live instance, rather than ad-hoc patterns or outside frameworks.',
].join('\n');

/** Compact platform rules inlined in Agent system prompt; full detail in vibe-operator-playbook shard. */
export const APPENDO_VIBE_PLATFORM_RULES = [
  'Retrieve project facts and standards before any code change — this codebase moves fast, so verify against current state rather than memory.',
  'First retrieve on coding tasks: get_project_standards({ shard: "vibe-operator-playbook" }) plus the active workflow shard from ## Active vibe workflow.',
  'When the user message already specifies what to build, retrieve then go straight to draft_* for it — a clear ask is ready to execute.',
  'After draft_* tools, let the proposal carry the implementation — summarize in chat, do not paste full source there.',
  'draft_* tools are the only write path. AppEndoo auto-applies valid proposals in Agent mode on its own — the result is already in motion once the proposal validates, no Create/Apply click or manual save needed.',
  'Manual operator parity: simulate the admin UI when drafting — each draft_* tool\'s own description states exactly what it is for; follow those.',
  'When the user names a function, layout, or feature that differs from the current page, execute on that named target — current page context is only a hint.',
  'Match AppEndO templates: HeroUI v3, AppTableGrid, UiCheckbox, CreateEditModalShell, AppButton intents, surfaceClasses — load topic shards via get_project_standards.',
  'Generated visual controls need a label plus a plain-language hint so the studio page guide can explain them (FormField hint, or designer_set_prop hint after insert).',
  'Greenfield only — build with current patterns, not legacy parsers, dual formats, or deprecated approaches.',
].join('\n');

/** F.2 — model supplies `_intention` on each tool call (one-liner why, in the user's language). */
export const TOOL_INTENTION_RULES = [
  'On every tool call include optional `_intention`: one short sentence, in the same language as the user\'s request, explaining why you call this tool now.',
  'Example: search_codebase({ query: "AppButton", _intention: "to find the button pattern used in this project" }).',
  'Keep `_intention` to purpose only — not a restatement of the args.',
].join('\n');

const STANDARDS_POINTER = [
  'Project coding standards are enforced via AGENTS.md and the runtime API.',
  'When the user asks about UI/grid/form/button/dialog rules, call get_project_standards before answering.',
  'Answer standards questions by citing what get_project_standards actually returns.',
].join('\n');

/** Merged agent/plan retrieval + hybrid search rules (TOK-11 — no duplicate cite/read_file semantics). */
export const RETRIEVAL_AND_SEARCH_RULES = [
  'Retrieve facts with tools before answering — ground every claim about file contents, standards, or code in something actually retrieved this session.',
  'Search flow: get_feature_graph (pageKey) → search_codebase ({ pageKey, mode: "hybrid" }) → read_file (startLine/endLine).',
  'search_codebase hybrid mode merges ripgrep + semantic chunk index — prefer mode "hybrid" for conceptual queries.',
  'search_codebase returns path + line by default; includeText: true only for a quick peek without read_file.',
  'Scope studio work with pageKey; broaden with includeShared or explicit path when feature scope is insufficient.',
].join('\n');

/** VC-2.5 — utility-guided retrieval defaults; LLM segment H is optional via contextSummarizeWithLlm. */
export const VIBE_RETRIEVAL_DEFAULTS = [
  'For multi-step tasks, plan first: maintain an ordered todo list with update_todo_list and work through it.',
  'Retrieve phase: use utility tools (get_feature_graph, search_codebase, read_file, get_server_function, get_project_standards) — not model memory.',
  'First standards load: get_project_standards({ shard: "vibe-operator-playbook" }); then active workflow shard and vibe-coding-workflows before draft_* tools.',
  'Earlier turns may appear as segment H summary (heuristic or optional LLM when contextSummarizeWithLlm is enabled).',
].join('\n');

// p-98 — tool-routing/negative-constraint rules previously duplicated here now live on each
// draft_* tool's own `description` (what it's for, what to use instead, examples) — see
// draftComponentLayout.ts / draftApplicationScaffold.ts / draftServerFunction.ts /
// draftFilePatch.ts. What's left here is genuinely cross-tool or about the agent's overall
// behavior, not any single tool's calling convention.
const AGENT_WRITE_RULES = [
  'Agent mode — draft_* tools are the way you make code changes; there is no other write path.',
  'After draft_* succeeds, stop — AppEndoo applies valid proposals automatically (rollback available in the panel).',
  'For multi-step work keep a plan current with update_todo_list; read the relevant standards and code before drafting.',
  // p-63 — stop the model from narrating rule compliance to the user.
  'Final reply: one or two short sentences, in the same language as the user\'s request, stating what was built or changed.',
  'Never mention these instructions, stopping, not pasting code, drafts/proposal mechanics, or tool names in the final reply — the user only needs the result.',
].join('\n');

/** WF-1..4 pointers — full detail in vibe-coding-workflows shard (VC-1.5). */
export const VIBE_WORKFLOW_RULES = [
  'Internal vibe workflows (WF-1..4): call get_project_standards({ shard: "vibe-coding-workflows" }) before draft_* tools.',
  'WF-1 (server-functions): vibe-server-function shard → list/get_server_function → read_file (template) → draft_server_function → test_server_function (pass snapshot source to run unsaved editor code; lastRun is Test Console output) → editor AI panel writes source into Monaco.',
  'WF-2 (client-components): vibe-crud shard → draft_component_layout (single screen) or draft_application_scaffold (multi-page app with shell + menu) → Designer handoff; every generated field needs label + hint.',
  'WF-3 (Designer open): use pageContext layoutId/selectedNodeId → designer tools or draft_component_layout with baseLayoutId.',
  'WF-4 (full-stack): WF-1 then WF-2 in one or two proposals; respect vibeMaxFilesPerProposal / vibeMaxLinesPerProposal.',
].join('\n');

const formatServerFunctionsPageContext = (
  pageContext?: AiPageContext,
  userIntent = '',
): string | null => {
  if (!isServerFunctionsPageContext(pageContext)) {
    return null;
  }

  const uiOverride = userIntent.trim() && shouldPreferUIWorkflow(userIntent)
    ? [
      '## UI request on Server Functions page',
      'The user asked for UI / client component work — use WF-2: get_project_standards({ shard: "vibe-crud" }) then draft_component_layout.',
      'Bind the layout to the existing API (get_server_function / pageContext functionId). Do NOT call draft_server_function again unless they explicitly ask to change backend logic.',
    ].join('\n')
    : null;

  const lines: string[] = [];
  if (pageContext.functionId?.trim()) {
    lines.push(`- Active function id: ${pageContext.functionId.trim()}`);
  }
  if (pageContext.functionName?.trim()) {
    lines.push(`- Active function name: ${pageContext.functionName.trim()}`);
  }

  if (lines.length === 0) {
    const base = [
      '## Server Functions workspace',
      'User is on managed Server Functions. Use list_server_functions / get_server_function when they refer to a function.',
      'Simulate manual UI Save: draft_server_function only — functionId folder.name, path /api/{folder}/{name}, files under workspace/server-functions/custom/. Never draft_file_patch to workspace/server-functions/.',
      'When the user already described the function (method, inputs, logic): after retrieve call draft_server_function — do NOT ask them to repeat what to build or to save/apply manually.',
      'When the user asks for UI, CRUD page, or user interface (in any language): switch to WF-2 draft_component_layout — do NOT draft_server_function again.',
      'Load shard: get_project_standards({ shard: "vibe-server-function" }).',
    ].join('\n');
    return uiOverride ? `${base}\n\n${uiOverride}` : base;
  }

  const base = [
    '## Server Functions workspace',
    ...lines,
    'Prefer get_server_function({ functionId }) for the open function before draft_server_function.',
    'Simulate manual UI Save: draft_server_function with canonical folder.name id, HTTP method, and /api/{folder}/{name} path — never draft_file_patch under workspace/server-functions/.',
    'When user intent is clear: draft_server_function → test_server_function (pass snapshot source + testPayload to match Test Console Execute) → proposal (Server Functions editor AI panel writes Monaco; AppEndoo persists valid proposals; never ask to click Create).',
    'When the user asks for a NEW function (new name/slug), draft that new functionId even if another function is open in the editor — do not overwrite the open function unless they asked to change it.',
    'When the user asks for UI, CRUD page, or user interface (in any language): switch to WF-2 draft_component_layout — do NOT draft_server_function again.',
    'Load shard: get_project_standards({ shard: "vibe-server-function" }).',
  ].join('\n');
  return uiOverride ? `${base}\n\n${uiOverride}` : base;
};

const formatCrossPageEngineeringHint = (
  pageContext?: AiPageContext,
  userIntent = '',
): string | null => {
  const promptTargets = resolvePromptEngineeringTargets(
    extractPromptEngineeringTargets(userIntent),
  );
  if (!hasPromptEngineeringTargets(promptTargets)) {
    return null;
  }
  if (!promptTargetsConflictWithPage(pageContext, promptTargets)) {
    return null;
  }

  const lines = [
    '## Cross-page engineering request',
    'The user named explicit targets in their message. Ignore unrelated current page context and complete the request on those targets.',
  ];

  if (promptTargets.functionId?.trim()) {
    lines.push(`- Target functionId: ${promptTargets.functionId.trim()}`);
    lines.push('- Call get_server_function({ functionId }) before draft_component_layout or draft_server_function.');
    lines.push('- Search workspace/server-functions and workspace/designer — not only the current pageKey.');
  }

  if (promptTargets.layoutId?.trim()) {
    lines.push(`- Target layoutId: ${promptTargets.layoutId.trim()}`);
    lines.push('- Use draft_component_layout or designer tools for that layout.');
  }

  return lines.join('\n');
};

/** Ask mode with read-only tools — investigation without drafts. */
export const ASK_MODE_AGENT_RULES = [
  'Ask mode — read-only investigation with tools (no code changes, no proposals, no apply).',
  'Answer the user question using get_project_standards, search_codebase ({ mode: "hybrid" }), read_file, get_feature_graph.',
  'Ask mode has no draft_* tools and produces no proposals — for implementation, point the user to Agent mode.',
  'Answer what/where/how questions directly from retrieval — building UI or server functions is Agent mode\'s job.',
  'Ignore earlier implementation tasks in this chat unless the user explicitly continues them.',
].join('\n');

/** Agent Plan/Act review — strategize before any draft (C.3). */
export const AGENT_PLAN_REVIEW_RULES = [
  'Agent mode — plan review only (Plan/Act toggle). Investigate and explain what you would change.',
  'Use read-only tools: get_server_function, search_codebase, read_file, get_project_standards, get_feature_graph.',
  'This review turn has no draft_* tools and creates no proposals or auto-apply — it is investigation only, until the user switches to Implement.',
  'When the plan is clear, tell the user (in their language) to confirm execution or switch to Implement.',
].join('\n');

/** Agent mode but this turn is a question — same read-only contract as Ask. */
export const AGENT_LOOKUP_RULES = [
  'Agent mode — this turn is a question, not a build request; investigate and answer, don\'t implement.',
  'Investigate with read-only tools and answer in chat.',
  'This turn has no draft_* tools, proposals, or auto-apply — it is answer-only.',
  'There is no capability-pack, role-permission, or "Designer / Server Functions / Files write" activation screen for the user to visit — never suggest one.',
  'If they want you to build or change something, ask for one clear sentence with an action verb (e.g. create, fix, build) — not a meta question about tools or modes.',
  'Keep internal profile names (lookup-only, Ask mode) out of the reply — just explain you need a concrete build/fix request to act.',
  'Ignore earlier implementation tasks in this chat unless the user explicitly continues them.',
].join('\n');

const PLAN_MODE_RULES = [
  'Plan mode — evolve structured design docs in plans/core/ or plans/packages/ only.',
  'Write clear markdown: goals, decisions, open questions, implementation notes.',
  'draft_file_patch here is scoped to .md files under plans/core/ or plans/packages/ — application code, Designer layouts, and settings are out of scope for this mode.',
].join('\n');

const ENGINEERING_PIPELINE_RULES = [
  'V3 engineering pipeline is active for this turn — Agent mode auto-builds after the semantic plan (no manual Approve & build step).',
  'When the Semantic plan (ASP) already includes a page/UI artifact for a server function, the pipeline publishes that canonical UI automatically — draft_component_layout is not needed for it.',
  'Agent mode is authorized to execute this turn on its own — proceed directly, no permission or confirmation step needed from the operator.',
  'Execute the workflow: retrieve standards → draft_server_function only when needed → stop. Designer and write tools are available here; treat them as present.',
  'The build proceeds on its own — there is no Approve & build click, permission toggle, or confirmation step for the user in this flow.',
].join('\n');

/** Max chars for segment H summary in system prompt. */
export const HISTORY_SUMMARY_MAX_CHARS = 4_000;
/** p-61 Phase C — verbatim tail kept alongside a compaction summary (mirrors historySegmentSummary). */
export const SUMMARY_TAIL_MIN_MESSAGES = 24;
const TOOL_OBSERVATION_SNIPPET = 240;
const MESSAGE_SNIPPET = 320;

/** Max plan document chars inlined in system prompt (TOK-9). */
export const MAX_PLAN_DOC_CHARS = 6_000;

export const truncatePlanDocument = (
  content: string,
  planPath?: string,
): { text: string; truncated: boolean } => {
  const trimmed = content.trim();
  if (trimmed.length <= MAX_PLAN_DOC_CHARS) {
    return { text: trimmed, truncated: false };
  }

  const pointer = planPath?.trim()
    ? `Use read_file on \`${planPath.trim()}\` for the full document.`
    : 'Use read_file on the plan document path for the full content.';
  const footer = `\n\n---\n[Truncated — first ${MAX_PLAN_DOC_CHARS} chars shown. ${pointer}]`;
  const sliceBudget = Math.max(0, MAX_PLAN_DOC_CHARS - footer.length);
  const text = `${trimmed.slice(0, sliceBudget)}…${footer}`;
  return { text, truncated: true };
};

export type AssembledContext = {
  systemPrompt: string;
  workingMessages: AgentMessage[];
  historySummary?: string;
};

const summarizeMessage = (message: AgentMessage): string => {
  if (message.role === 'tool') {
    const label = message.name ? `Tool ${message.name}` : 'Tool result';
    const snippet = message.content.slice(0, TOOL_OBSERVATION_SNIPPET);
    return `[${label}: ${snippet}${message.content.length > TOOL_OBSERVATION_SNIPPET ? '…' : ''}]`;
  }

  const prefix = message.role === 'user' ? 'User' : 'Assistant';
  const snippet = message.content.slice(0, MESSAGE_SNIPPET);
  return `${prefix}: ${snippet}${message.content.length > MESSAGE_SNIPPET ? '…' : ''}`;
};

export const summarizeHistorySegment = (messages: AgentMessage[]): string => {
  const lines = messages.map(summarizeMessage);
  let summary = lines.join('\n');
  if (summary.length > HISTORY_SUMMARY_MAX_CHARS) {
    summary = `${summary.slice(0, HISTORY_SUMMARY_MAX_CHARS)}…`;
  }
  return summary;
};

const formatMcpAccessContext = (snapshot: McpAccessContextSnapshot): string => {
  const packLines = snapshot.packLabels.length > 0
    ? snapshot.packLabels.map((label) => `- ${label}`).join('\n')
    : '- (none)';
  const serverLines = snapshot.mcpServerLabels.length > 0
    ? snapshot.mcpServerLabels.map((label) => `- ${label}`).join('\n')
    : '- (none)';

  return [
    '## Authorized MCP capabilities (role-based)',
    'You may only use tools from these built-in capability packs and external MCP servers for this user.',
    'Do not call tools outside this authorized list.',
    '',
    'Built-in packs:',
    packLines,
    '',
    'External MCP servers:',
    serverLines,
  ].join('\n');
};

const MAX_APPLICATION_STRUCTURE_LINES = 80;

/**
 * Phase 56 — folder/application inventory for multi-page scaffold context.
 * Pure formatter; pass drafts from listDesignerDrafts (or a test double).
 */
export const formatDesignerApplicationStructure = (
  drafts: readonly DesignerDraftSummary[],
  options?: { maxLines?: number },
): string | null => {
  const usable = drafts.filter((draft) => !draft.isBuiltIn);
  if (usable.length === 0) return null;

  const byFolder = new Map<string, DesignerDraftSummary[]>();
  for (const draft of usable) {
    const folder = (draft.folder || 'general').trim() || 'general';
    const bucket = byFolder.get(folder) ?? [];
    bucket.push(draft);
    byFolder.set(folder, bucket);
  }

  const maxLines = options?.maxLines ?? MAX_APPLICATION_STRUCTURE_LINES;
  const lines: string[] = [
    '## Existing Designer application structure',
    'Use this inventory when placing new pages (folder + menu). Prefer draft_application_scaffold for multi-page apps so shell, pages, and menu stay consistent.',
    `Folders: ${byFolder.size}; layouts: ${usable.length}.`,
  ];

  const folderNames = [...byFolder.keys()].sort((a, b) => a.localeCompare(b));
  for (const folder of folderNames) {
    if (lines.length >= maxLines) {
      lines.push('… (truncated — more folders exist)');
      break;
    }
    const items = byFolder.get(folder) ?? [];
    lines.push(`### folder: ${folder} (${items.length})`);
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    for (const draft of sorted) {
      if (lines.length >= maxLines) {
        lines.push('… (truncated)');
        break;
      }
      const path = buildDesignerComponentPath(draft.folder || 'general', draft.name);
      lines.push(`- ${draft.name} · id=${draft.id} · path=${path}`);
    }
  }

  return lines.join('\n');
};

/** Loads live designer drafts and formats the application structure block (best-effort). */
export const buildDesignerApplicationStructureContext = (): string | null => {
  try {
    return formatDesignerApplicationStructure(listDesignerDrafts());
  } catch {
    return null;
  }
};

const shouldIncludeApplicationStructure = (
  pageContext?: AiPageContext,
  userIntent = '',
): boolean => {
  const pageKey = pageContext?.pageKey?.trim();
  if (pageKey === 'client-components' || pageKey === 'component-designer') return true;
  if (pageContext?.layoutId?.trim()) return true;
  const intent = userIntent.toLowerCase();
  return (
    intent.includes('app')
    || intent.includes('application')
    || intent.includes('scaffold')
    || intent.includes('multi-page')
    || intent.includes('multipage')
    || intent.includes('portal')
    || /\b(\u0627\u067e|\u0627\u067e\u0644\u06cc\u06a9\u06cc\u0634\u0646|\u0686\u0646\u062f \u0635\u0641\u062d\u0647|\u0627\u0633\u06a9\u0644\u062a|scaffold)\b/i.test(userIntent)
  );
};

export const assembleAgentContext = (
  messages: AgentMessage[],
  config: AgentRunConfig,
  resolvedHistorySummary?: string,
): AssembledContext => {
  const agentSettings = config.agentSettings ?? DEFAULT_AI_AGENT_SETTINGS;
  const workingTurns = config.contextWorkingTurns ?? agentSettings.contextWorkingTurns ?? 8;

  const agentBaseContext = config.mode === 'agent'
    ? APPENDO_AGENT_IDENTITY
    : 'You are AppEndO Assistant — a technical admin-platform copilot.';

  const lastUserIntent = [...messages].reverse().find((message) => message.role === 'user')?.content?.trim() ?? '';
  const effectiveUserIntent = resolveEffectiveUserIntent(messages, config.pageContext) || lastUserIntent;
  const workflowUserIntent = detectContinuationIntent(lastUserIntent) ? effectiveUserIntent : lastUserIntent;

  const systemParts = [
    buildAiSystemContextWithResources(
      config.pageContext,
      config.contextResources,
      agentBaseContext,
      { projectNotes: aiManager.getSettings()?.projectNotes },
    ),
    '',
    STANDARDS_POINTER,
  ];

  if (config.mode === 'agent' || config.mode === 'plan') {
    systemParts.push('', RETRIEVAL_AND_SEARCH_RULES, '', TOOL_INTENTION_RULES);
  }

  if (config.mode === 'ask') {
    systemParts.push('', ASK_MODE_AGENT_RULES, '', RETRIEVAL_AND_SEARCH_RULES);
    if (config.pageContextPreload?.trim()) {
      systemParts.push('', config.pageContextPreload.trim());
    }
  }

  if (config.mode === 'agent' && config.executionProfile === 'agent_lookup') {
    // p-98 — RETRIEVAL_AND_SEARCH_RULES already pushed above for any mode==='agent'; don't repeat it.
    systemParts.push('', AGENT_LOOKUP_RULES);
    if (config.pageContextPreload?.trim()) {
      systemParts.push('', config.pageContextPreload.trim());
    }
  }

  if (config.mode === 'agent' && config.executionProfile === 'agent_plan_review') {
    // p-98 — RETRIEVAL_AND_SEARCH_RULES already pushed above for any mode==='agent'; don't repeat it.
    systemParts.push('', AGENT_PLAN_REVIEW_RULES);
    if (config.pageContextPreload?.trim()) {
      systemParts.push('', config.pageContextPreload.trim());
    }
  }

  if (
    (
      (config.mode === 'agent' && (
        config.executionProfile === 'agent_implement'
        || config.executionProfile === 'agent_implement_governed'
      ))
      || config.mode === 'plan'
    )
    && config.mcpAccessContext
  ) {
    systemParts.push('', formatMcpAccessContext(config.mcpAccessContext));
  }

  if (config.mode === 'agent' && config.executionProfile === 'agent_implement') {
    // p-98 — TOOL_INTENTION_RULES already pushed above for any mode==='agent'; don't repeat it.
    systemParts.push('', APPENDO_VIBE_PLATFORM_RULES, '', AGENT_WRITE_RULES, '', VIBE_WORKFLOW_RULES, '', VIBE_RETRIEVAL_DEFAULTS);
    if (config.useEngineeringPipeline) {
      systemParts.push('', ENGINEERING_PIPELINE_RULES);
    }
    systemParts.push('', formatActiveVibeWorkflowBlock(config.pageContext, workflowUserIntent));

    if (config.pageContextPreload?.trim()) {
      systemParts.push('', config.pageContextPreload.trim());
    }

    if (shouldIncludeApplicationStructure(config.pageContext, workflowUserIntent)) {
      const applicationStructure = buildDesignerApplicationStructureContext();
      if (applicationStructure) {
        systemParts.push('', applicationStructure);
      }
    }

    const serverFunctionsContext = formatServerFunctionsPageContext(config.pageContext, workflowUserIntent);
    if (serverFunctionsContext) {
      systemParts.push('', serverFunctionsContext);
    }

    const crossPageHint = formatCrossPageEngineeringHint(config.pageContext, workflowUserIntent);
    if (crossPageHint) {
      systemParts.push('', crossPageHint);
    }

    if (config.taskDecomposition) {
      systemParts.push('', formatTaskDecompositionForSystemPrompt(config.taskDecomposition));
    }
  }

  if (config.mode === 'plan') {
    systemParts.push('', PLAN_MODE_RULES, '', VIBE_RETRIEVAL_DEFAULTS);

    if (config.planDocumentContent?.trim()) {
      const { text: planBody } = truncatePlanDocument(
        config.planDocumentContent,
        config.planDocumentPath,
      );
      systemParts.push(
        '',
        '## Active session plan document (persisted on this chat session)',
        'Evolve this document via draft_file_patch proposals under plans/core/ or plans/packages/.',
        '',
        planBody,
      );
    } else if (config.planDocumentPath?.trim()) {
      systemParts.push('', `## Active plan document`, `\`${config.planDocumentPath.trim()}\``);
    }
  }

  if (config.mode === 'agent' && config.planDocumentContent?.trim()) {
    const { text: planBody } = truncatePlanDocument(
      config.planDocumentContent,
      config.planDocumentPath,
    );
    systemParts.push(
      '',
      '## Plan document context (read-only — from Plan mode)',
      'Use this design context when implementing code changes. Do not treat it as a file to patch in Agent mode.',
      '',
      planBody,
    );
  }

  // p-61 Phase C — flat history is the default. The old path sliced context to the last
  // `workingTurns * 2` (≈16) messages on every assembly, which made the model forget its own
  // tool results mid-task. Now the full history rides along untouched until a compaction
  // summary exists (built by the orchestrator only under real token pressure); even then a
  // generous verbatim tail is kept. The summary is delivered as a tagged in-band message,
  // not in the system prompt, so the system prompt stays byte-stable across iterations of a
  // run and provider prompt-prefix caching can work.
  const nonSystem = messages.filter((message) => message.role !== 'system');
  const turnCount = Math.max(SUMMARY_TAIL_MIN_MESSAGES, workingTurns * 2);

  const historySummary: string | undefined = resolvedHistorySummary?.trim() || undefined;
  let workingMessages: AgentMessage[];

  if (historySummary && nonSystem.length > turnCount) {
    const splitAt = Math.max(0, nonSystem.length - turnCount);
    workingMessages = sliceAgentMessagesForContext(nonSystem.slice(splitAt), turnCount);
  } else {
    workingMessages = nonSystem;
  }

  if (historySummary) {
    workingMessages = [
      {
        role: 'user',
        content: [
          '<system-reminder>',
          'Earlier conversation summary (compacted by the harness — older turns were removed to fit the context budget):',
          historySummary,
          '</system-reminder>',
        ].join('\n'),
      },
      ...workingMessages,
    ];
  }

  return {
    systemPrompt: systemParts.join('\n'),
    workingMessages,
    historySummary,
  };
};

import { estimateTokens as estimateTokensForModel } from './tokenEstimator';

export { estimateTokensForModel as estimateTokens };

export const estimateMessagesTokens = (
  messages: AgentMessage[],
  systemPrompt: string,
  modelId?: string,
): number => {
  const messageTokens = messages.reduce(
    (sum, message) => sum + estimateTokensForModel(message.content, modelId),
    0,
  );
  return estimateTokensForModel(systemPrompt, modelId) + messageTokens;
};
