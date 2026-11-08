/**
 * Canonical catalog for built-in AI capability packs (MCP bundled servers).
 * Single source for Agent Capability dropdown UI and runtime pack registration.
 */

export type AiCapabilityPackTier = 'p0' | 'p1' | 'p2' | 'deferred';

/** Built-in capability pack identifier — maps 1:1 to an in-process MCP bundle. */
export type AiCapabilityPackId =
  | 'appendo-files'
  | 'appendo-web'
  | 'appendo-http'
  | 'appendo-git'
  | 'appendo-codebase'
  | 'appendo-standards'
  | 'appendo-data'
  | 'appendo-context'
  | 'appendo-designer'
  | 'appendo-server-functions'
  | 'appendo-jobs'
  | 'appendo-packages'
  | 'appendo-memory'
  | 'appendo-cache'
  | 'appendo-openapi'
  | 'appendo-workflow';

/** Session-scoped agent capability selection (persisted on `base_ai_chat_sessions`). */
export type AiAgentCapabilityScope = {
  packIds: AiCapabilityPackId[];
  mcpServerIds: string[];
};

export type AiCapabilityPack = {
  id: AiCapabilityPackId;
  label: string;
  description: string;
  tier: AiCapabilityPackTier;
  /** Lucide icon name (kebab-case) for UI rendering via `BaseInfoUiIcon` or direct Lucide lookup. */
  icon: string;
  toolNames: readonly string[];
  /** Pack exposes write or git-write tools that require user confirmation. */
  hasWriteTools: boolean;
  /** Default enabled when a new chat session is created. */
  defaultEnabled: boolean;
};

const pack = (
  id: AiCapabilityPackId,
  label: string,
  description: string,
  tier: AiCapabilityPackTier,
  icon: string,
  toolNames: readonly string[],
  options: { hasWriteTools?: boolean; defaultEnabled?: boolean } = {},
): AiCapabilityPack => ({
  id,
  label,
  description,
  tier,
  icon,
  toolNames,
  hasWriteTools: options.hasWriteTools ?? false,
  defaultEnabled: options.defaultEnabled ?? false,
});

/** Full built-in pack catalog — UI dropdown and runtime registry consume this list. */
export const AI_CAPABILITY_PACK_CATALOG: readonly AiCapabilityPack[] = [
  // P0 — M2g-1
  pack(
    'appendo-files',
    'Files / Workspace',
    'Read, list, and search workspace files; propose file patches (confirm required).',
    'p0',
    'folder-open',
    ['read_file', 'list_dir', 'glob_files', 'draft_file_patch'],
    { hasWriteTools: true, defaultEnabled: true },
  ),
  pack(
    'appendo-codebase',
    'Code Search',
    'Semantic and text search across the repository.',
    'p0',
    'search-code',
    ['search_codebase', 'get_feature_graph'],
    { defaultEnabled: true },
  ),
  pack(
    'appendo-git',
    'Git',
    'Git inspection plus commit, checkout, and branch (write requires confirm).',
    'p0',
    'git-branch',
    [
      'git_status',
      'git_diff',
      'git_log',
      'git_show',
      'git_blame',
      'git_commit',
      'git_checkout',
      'git_branch',
    ],
    { hasWriteTools: true, defaultEnabled: true },
  ),
  pack(
    'appendo-web',
    'Web / Search',
    'Web search, fetch public pages as markdown, and screenshot URLs (SSRF-protected).',
    'p0',
    'globe',
    ['web_search', 'fetch_url', 'screenshot_url'],
  ),
  pack(
    'appendo-http',
    'API Call',
    'HTTP requests to allowlisted hostnames only.',
    'p0',
    'send',
    ['http_request'],
  ),
  // P1 — M2g-1.1
  pack(
    'appendo-standards',
    'Project Standards',
    'Fetch canonical vibe-coding and project standards for the agent.',
    'p1',
    'book-open',
    ['get_project_standards', 'get_operator_page_edit_locks', 'run_tests'],
    { defaultEnabled: true },
  ),
  pack(
    'appendo-context',
    'Context',
    'Page context and conversation summarization helpers.',
    'p1',
    'layout-dashboard',
    ['get_page_context', 'summarize_context', 'ask_clarifying_question', 'update_todo_list'],
    { defaultEnabled: true },
  ),
  pack(
    'appendo-data',
    'Data Sources',
    'List data sources, describe schemas, and run read-only queries.',
    'p1',
    'database',
    ['list_data_sources', 'describe_schema', 'query_readonly', 'query_dashboard_domain'],
    { defaultEnabled: true },
  ),
  pack(
    'appendo-designer',
    'Designer',
    'Draft component layouts and related designer artifacts.',
    'p1',
    'blocks',
    ['draft_component_layout', 'draft_application_scaffold', 'draft_server_function', 'designer_insert_palette_item', 'designer_set_prop', 'draft_dashboard_widget'],
    { hasWriteTools: true, defaultEnabled: true },
  ),
  // P2 — later milestones
  pack(
    'appendo-server-functions',
    'Server Functions',
    'Browse and test managed server function routes.',
    'p1',
    'braces',
    ['list_server_functions', 'get_server_function', 'test_server_function'],
    { defaultEnabled: true },
  ),
  pack(
    'appendo-jobs',
    'Jobs',
    'Inspect and trigger background jobs.',
    'p1',
    'calendar-clock',
    ['list_jobs', 'get_job', 'run_job'],
  ),
  pack(
    'appendo-packages',
    'Plugins',
    'Package manifest and runtime inspection.',
    'p2',
    'puzzle',
    ['list_packages', 'get_package_manifest'],
    { defaultEnabled: true },
  ),
  pack(
    'appendo-memory',
    'Memory',
    'Session and long-term agent memory tools.',
    'p2',
    'brain',
    ['read_memory', 'write_memory'],
    { hasWriteTools: true },
  ),
  pack(
    'appendo-cache',
    'Cache',
    'Cache key inspection and eviction (admin).',
    'p2',
    'hard-drive',
    ['list_cache_keys', 'get_cache_entry', 'evict_cache_key'],
    { hasWriteTools: true },
  ),
  pack(
    'appendo-openapi',
    'OpenAPI',
    'Browse aggregated and per-route OpenAPI specs.',
    'p1',
    'file-json',
    ['list_openapi_routes', 'get_openapi_spec'],
    { defaultEnabled: true },
  ),
  pack(
    'appendo-workflow',
    'Workflow Actions',
    'List and invoke the workflow engine\'s read-only/computational Action toolbox (data, text, crypto, identity, web, AI, ...) directly — actions with external write effects are excluded.',
    'p1',
    'workflow',
    ['list_workflow_actions', 'invoke_workflow_action'],
    // Some invocable actions reach external systems (web.*, data.db-query) — same "real
    // external-egress risk, opt-in" policy as appendo-web/appendo-http, not default-enabled.
  ),
] as const;

export const AI_CAPABILITY_PACK_IDS = AI_CAPABILITY_PACK_CATALOG.map((item) => item.id);

export const P0_CAPABILITY_PACK_IDS: readonly AiCapabilityPackId[] = AI_CAPABILITY_PACK_CATALOG
  .filter((item) => item.tier === 'p0')
  .map((item) => item.id);

export const P1_CAPABILITY_PACK_IDS: readonly AiCapabilityPackId[] = AI_CAPABILITY_PACK_CATALOG
  .filter((item) => item.tier === 'p1')
  .map((item) => item.id);

export const AI_CAPABILITY_PACK_BY_ID: Readonly<Record<AiCapabilityPackId, AiCapabilityPack>> =
  Object.fromEntries(AI_CAPABILITY_PACK_CATALOG.map((item) => [item.id, item])) as Record<
    AiCapabilityPackId,
    AiCapabilityPack
  >;

export const AI_CAPABILITY_PACK_LABELS: Readonly<Record<AiCapabilityPackId, string>> =
  Object.fromEntries(AI_CAPABILITY_PACK_CATALOG.map((item) => [item.id, item.label])) as Record<
    AiCapabilityPackId,
    string
  >;

export const AI_CAPABILITY_PACK_ICONS: Readonly<Record<AiCapabilityPackId, string>> =
  Object.fromEntries(AI_CAPABILITY_PACK_CATALOG.map((item) => [item.id, item.icon])) as Record<
    AiCapabilityPackId,
    string
  >;

/** Pack IDs enabled by default for new agent sessions. */
export const DEFAULT_ENABLED_CAPABILITY_PACK_IDS: readonly AiCapabilityPackId[] =
  AI_CAPABILITY_PACK_CATALOG.filter((item) => item.defaultEnabled).map((item) => item.id);

/** Built-in packs shown in Agent Capability dropdown and Settings MCP grid (P0 + P1). */
export const AGENT_CAPABILITY_UI_PACKS: readonly AiCapabilityPack[] = AI_CAPABILITY_PACK_CATALOG.filter(
  (item) => item.tier === 'p0' || item.tier === 'p1',
);

export const resolveDefaultCapabilityPackIds = (
  configured?: readonly string[] | null,
): AiCapabilityPackId[] => {
  if (configured?.length) {
    const packIds = configured.filter(isAiCapabilityPackId);
    if (packIds.length > 0) {
      return packIds;
    }
  }
  return [...DEFAULT_ENABLED_CAPABILITY_PACK_IDS];
};

/** Default session capability scope — built-in packs only; external MCP servers start empty. */
export const DEFAULT_AGENT_CAPABILITY_SCOPE: AiAgentCapabilityScope = {
  packIds: [...DEFAULT_ENABLED_CAPABILITY_PACK_IDS],
  mcpServerIds: [],
};

/** Read-only Ask mode — search, standards, files, context, server function inspect. */
export const ASK_AGENT_CAPABILITY_SCOPE: AiAgentCapabilityScope = {
  packIds: [
    'appendo-files',
    'appendo-codebase',
    'appendo-standards',
    'appendo-context',
    'appendo-server-functions',
    'appendo-openapi',
  ],
  mcpServerIds: [],
};

const AI_CAPABILITY_PACK_ID_SET = new Set<string>(AI_CAPABILITY_PACK_IDS);

export const isAiCapabilityPackId = (value: string): value is AiCapabilityPackId =>
  AI_CAPABILITY_PACK_ID_SET.has(value);

export const getAiCapabilityPack = (id: AiCapabilityPackId): AiCapabilityPack =>
  AI_CAPABILITY_PACK_BY_ID[id];

export const getAiCapabilityPacksByTier = (
  tier: AiCapabilityPackTier,
): readonly AiCapabilityPack[] => AI_CAPABILITY_PACK_CATALOG.filter((item) => item.tier === tier);

/** Native tools always listed for the LLM when filtering by active pack (TOK-14). */
export const ALWAYS_EXPOSED_NATIVE_TOOL_NAMES = ['prune_tool_observations'] as const;

/** Resolve built-in tool names enabled for the given capability pack ids. */
export const resolveToolNamesForCapabilityPackIds = (
  packIds: readonly AiCapabilityPackId[],
): ReadonlySet<string> => {
  const names = new Set<string>(ALWAYS_EXPOSED_NATIVE_TOOL_NAMES);
  for (const packId of packIds) {
    const pack = AI_CAPABILITY_PACK_BY_ID[packId];
    if (!pack) continue;
    for (const toolName of pack.toolNames) {
      names.add(toolName);
    }
  }
  return names;
};
