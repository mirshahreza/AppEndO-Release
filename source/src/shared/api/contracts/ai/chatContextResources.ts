import { PROJECT_STANDARDS } from '../../../../config/projectStandards';
import type { AiPageContext } from './pageContext';
import { buildAiSystemContext } from './pageContext';

export type AiChatContextResourceId =
  | 'page'
  | 'standards'
  | 'feature'
  | 'notes'
  | 'designer'
  | 'function'
  | 'settings';

export type ChatContextResourceEnv = {
  hasProjectNotes?: boolean;
};

export type AiChatContextResourceOption = {
  id: AiChatContextResourceId;
  label: string;
  description: string;
  isAvailable: (pageContext?: AiPageContext, env?: ChatContextResourceEnv) => boolean;
  badgeLabel: (pageContext?: AiPageContext) => string;
  badgeTitle: (pageContext?: AiPageContext) => string;
};

const hasPageContextBase = (pageContext?: AiPageContext): boolean => (
  Boolean(pageContext?.path?.trim() && pageContext.pageLabel?.trim())
);

export const AI_CHAT_CONTEXT_RESOURCE_OPTIONS: AiChatContextResourceOption[] = [
  {
    id: 'page',
    label: 'Current page',
    description: 'Route, title, description, and grid filters/sort when you are on a list screen.',
    isAvailable: hasPageContextBase,
    badgeLabel: (pageContext) => pageContext?.pageLabel?.trim() || 'Current page',
    badgeTitle: (pageContext) => (
      pageContext?.path
        ? `${pageContext.pageLabel} (${pageContext.path})`
        : 'Current page context'
    ),
  },
  {
    id: 'standards',
    label: 'Project standards',
    description: 'AppEndO coding standards from AGENTS.md and /api/project-standards.',
    isAvailable: () => true,
    badgeLabel: () => 'Standards',
    badgeTitle: () => `Project standards v${PROJECT_STANDARDS.version}`,
  },
  {
    id: 'feature',
    label: 'Feature graph',
    description: 'Studio pageKey and pointers to get_feature_graph for this screen.',
    isAvailable: (pageContext) => Boolean(pageContext?.pageKey?.trim()),
    badgeLabel: (pageContext) => pageContext?.pageKey?.trim() || 'Feature',
    badgeTitle: (pageContext) => (
      pageContext?.pageKey?.trim()
        ? `Feature graph: ${pageContext.pageKey.trim()}`
        : 'Feature graph context'
    ),
  },
  {
    id: 'notes',
    label: 'Project notes',
    description: 'Workspace notes from Settings → AI (operator memory).',
    isAvailable: (_pageContext, env) => Boolean(env?.hasProjectNotes),
    badgeLabel: () => 'Notes',
    badgeTitle: () => 'Workspace project notes from Settings',
  },
  {
    id: 'designer',
    label: 'Component designer',
    description: 'Active layout, selected node, viewport, and draft state.',
    isAvailable: (pageContext) => Boolean(
      pageContext?.layoutId
      || pageContext?.selectedNodeId
      || pageContext?.viewport
      || pageContext?.draftDirty !== undefined,
    ),
    badgeLabel: (pageContext) => (
      pageContext?.layoutId
        ? `Layout ${pageContext.layoutId}`
        : 'Designer'
    ),
    badgeTitle: (pageContext) => {
      const parts = [
        pageContext?.layoutId ? `Layout: ${pageContext.layoutId}` : undefined,
        pageContext?.selectedNodeId ? `Node: ${pageContext.selectedNodeId}` : undefined,
        pageContext?.draftDirty !== undefined ? `Draft dirty: ${pageContext.draftDirty ? 'yes' : 'no'}` : undefined,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : 'Component designer context';
    },
  },
  {
    id: 'function',
    label: 'Edge function',
    description: 'Open function editor name and content hash.',
    isAvailable: (pageContext) => Boolean(pageContext?.functionName || pageContext?.functionId),
    badgeLabel: (pageContext) => pageContext?.functionName || 'Function',
    badgeTitle: (pageContext) => (
      pageContext?.functionName
        ? `Function: ${pageContext.functionName}`
        : 'Edge function context'
    ),
  },
  {
    id: 'settings',
    label: 'Settings section',
    description: 'Active section in the settings workspace.',
    isAvailable: (pageContext) => Boolean(pageContext?.activeSectionId),
    badgeLabel: (pageContext) => pageContext?.activeSectionId || 'Settings',
    badgeTitle: (pageContext) => (
      pageContext?.activeSectionId
        ? `Settings section: ${pageContext.activeSectionId}`
        : 'Settings section context'
    ),
  },
];

export const DEFAULT_CHAT_CONTEXT_RESOURCE_IDS: AiChatContextResourceId[] = ['page'];

/** Agent/Plan defaults — standards + feature graph always when available (vibe-operator-playbook UX). */
export const DEFAULT_AGENT_CHAT_CONTEXT_RESOURCE_IDS: AiChatContextResourceId[] = [
  'page',
  'standards',
  'feature',
];

const VIBE_STUDIO_PAGE_KEYS = new Set([
  'server-functions',
  'client-components',
  'component-designer',
]);

export const isVibeStudioPageContext = (pageContext?: AiPageContext | null): boolean => {
  if (!pageContext) return false;
  if (pageContext.layoutId?.trim() || pageContext.selectedNodeId?.trim()) return true;
  if (pageContext.functionId?.trim() || pageContext.functionName?.trim()) return true;
  const pageKey = pageContext.pageKey?.trim();
  return pageKey ? VIBE_STUDIO_PAGE_KEYS.has(pageKey) : false;
};

export type ChatContextMode = 'ask' | 'agent' | 'plan';

const mergeContextResourceIds = (
  defaults: readonly AiChatContextResourceId[],
  userAttached: readonly AiChatContextResourceId[],
): AiChatContextResourceId[] => {
  const seen = new Set<AiChatContextResourceId>();
  const result: AiChatContextResourceId[] = [];
  for (const id of [...defaults, ...userAttached]) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

export const resolveDefaultAgentContextResourceIds = (
  pageContext?: AiPageContext,
): AiChatContextResourceId[] => {
  const ids: AiChatContextResourceId[] = ['standards'];
  if (hasPageContextBase(pageContext)) {
    ids.unshift('page');
    if (pageContext?.pageKey?.trim()) {
      ids.push('feature');
    }
  }
  if (pageContext?.functionId || pageContext?.functionName) {
    ids.push('function');
  }
  if (pageContext?.layoutId || pageContext?.selectedNodeId) {
    ids.push('designer');
  }
  return [...new Set(ids)];
};

/** Merge user toggles with mode-appropriate defaults; filter to available resources. */
export const resolveChatContextResources = (
  mode: ChatContextMode,
  userAttached: readonly AiChatContextResourceId[],
  pageContext?: AiPageContext,
  env?: ChatContextResourceEnv,
): AiChatContextResourceId[] => {
  const defaults = mode === 'ask'
    ? DEFAULT_CHAT_CONTEXT_RESOURCE_IDS
    : resolveDefaultAgentContextResourceIds(pageContext);

  return mergeContextResourceIds(defaults, userAttached).filter((id) => (
    isChatContextResourceAvailable(id, pageContext, env)
  ));
};

export const resolveDefaultChatMode = (
  pageContext?: AiPageContext | null,
): ChatContextMode => (
  isVibeStudioPageContext(pageContext) ? 'agent' : 'ask'
);

/** Ask mode system context — pointer to Agent for development work. */
export const ASK_MODE_PLATFORM_RULES = [
  'AppEndO runs as a live admin platform — Server Functions and Component Designer layouts apply on this same instance.',
  'For code changes (Server Functions, CRUD UI, layouts, patches): direct the user to switch to Agent mode — Ask has no development tools or proposal pipeline.',
  'Answer architecture and behavior questions concisely; cite get_project_standards topics when discussing UI/platform rules.',
].join('\n');

export const APPENDO_ASK_BASE_CONTEXT = [
  'You are AppEndO Assistant — technical copilot for the AppEndO admin platform.',
  'Provide concise, accurate responses about platform architecture, APIs, and behavior.',
].join('\n');

export const getChatContextResourceOption = (
  id: AiChatContextResourceId,
): AiChatContextResourceOption => (
  AI_CHAT_CONTEXT_RESOURCE_OPTIONS.find((option) => option.id === id)
  ?? AI_CHAT_CONTEXT_RESOURCE_OPTIONS[0]
);

export const isChatContextResourceAvailable = (
  id: AiChatContextResourceId,
  pageContext?: AiPageContext,
  env?: ChatContextResourceEnv,
): boolean => getChatContextResourceOption(id).isAvailable(pageContext, env);

export const getAvailableChatContextResources = (
  pageContext?: AiPageContext,
  env?: ChatContextResourceEnv,
): AiChatContextResourceOption[] => (
  AI_CHAT_CONTEXT_RESOURCE_OPTIONS.filter((option) => option.isAvailable(pageContext, env))
);

const applyGridPageContextSlice = (ctx: AiPageContext, full: AiPageContext): void => {
  const entityType = full.entityType?.trim() || full.pageKey?.trim();
  if (entityType) {
    ctx.entityType = entityType;
  }
  if (full.activeFilters && Object.keys(full.activeFilters).length > 0) {
    ctx.activeFilters = full.activeFilters;
  }
  if (full.sort?.field) {
    ctx.sort = full.sort;
  }
};

export const normalizeChatContextResourceIds = (value: unknown): AiChatContextResourceId[] => {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<AiChatContextResourceId>(
    AI_CHAT_CONTEXT_RESOURCE_OPTIONS.map((option) => option.id),
  );
  const seen = new Set<AiChatContextResourceId>();
  const result: AiChatContextResourceId[] = [];
  for (const item of value) {
    const raw = String(item ?? '').trim();
    const id = (raw === 'grid' ? 'page' : raw) as AiChatContextResourceId;
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

/** Agent runs need route/pageKey for WF-1..4 even when the user detached optional context chips. */
export const resolveAgentRunPageContext = (
  full: AiPageContext | undefined,
  attachedIds: readonly AiChatContextResourceId[],
): AiPageContext | undefined => {
  if (!hasPageContextBase(full)) return undefined;

  const effective = buildEffectivePageContext(full, attachedIds);
  if (!isVibeStudioPageContext(full)) {
    return effective;
  }

  return {
    path: full!.path,
    pageLabel: full!.pageLabel,
    pageKey: full!.pageKey,
    search: full!.search,
    functionId: full!.functionId,
    functionName: full!.functionName,
    openEditorContentHash: full!.openEditorContentHash,
    layoutId: full!.layoutId,
    selectedNodeId: full!.selectedNodeId,
    draftDirty: full!.draftDirty,
    viewport: full!.viewport,
    entityType: full!.entityType,
    activeSectionId: full!.activeSectionId,
    ...(effective ?? {}),
  };
};

export const buildEffectivePageContext = (
  full: AiPageContext | undefined,
  attachedIds: readonly AiChatContextResourceId[],
): AiPageContext | undefined => {
  if (!hasPageContextBase(full)) return undefined;

  const attached = new Set(attachedIds);
  const needsPageSlice = attached.has('page')
    || attached.has('feature')
    || attached.has('designer')
    || attached.has('function')
    || attached.has('settings');

  if (!needsPageSlice) return undefined;

  const ctx: AiPageContext = {
    path: full!.path,
    pageLabel: full!.pageLabel,
    pageKey: full!.pageKey,
  };

  if (attached.has('page')) {
    ctx.pageDescription = full!.pageDescription;
    ctx.search = full!.search;
    applyGridPageContextSlice(ctx, full!);
  }

  if (attached.has('designer')) {
    ctx.layoutId = full!.layoutId;
    ctx.selectedNodeId = full!.selectedNodeId;
    ctx.draftDirty = full!.draftDirty;
    ctx.viewport = full!.viewport;
  }

  if (attached.has('function')) {
    ctx.functionId = full!.functionId;
    ctx.functionName = full!.functionName;
    ctx.openEditorContentHash = full!.openEditorContentHash;
  }

  if (attached.has('settings')) {
    ctx.activeSectionId = full!.activeSectionId;
  }

  return ctx;
};


export const formatFeatureGraphContextBlock = (pageKey?: string): string => {
  const key = pageKey?.trim();
  if (!key) {
    return [
      '## Feature graph (on-demand)',
      'Call `get_feature_graph()` for the studio page index, or pass `{ pageKey: "<key>" }` for a single node.',
      'Index: `docs/ai/CODEBASE_INDEX.md` · machine-readable: `docs/ai/feature-graph.json`.',
    ].join('\n');
  }

  return [
    `## Feature graph — ${key}`,
    `Current page key: \`${key}\`.`,
    `Call \`get_feature_graph({ pageKey: "${key}" })\` for routes, contracts, tests, and standards for this feature.`,
    'Index: `docs/ai/CODEBASE_INDEX.md`.',
  ].join('\n');
};

export const formatProjectStandardsContextBlock = (): string => [
  '## Project standards (on-demand)',
  `Version ${PROJECT_STANDARDS.version} (${PROJECT_STANDARDS.updatedAt}) — ${PROJECT_STANDARDS.standards.length} rules total.`,
  'Standards are not inlined. Call `get_project_standards({ query: "<topic>" })` for matching rules (e.g. "grid", "dialog", "checkbox").',
  'Topic index: `docs/standards/INDEX.md` · hub: `AGENTS.md` · runtime: `/api/project-standards`.',
].join('\n');

/** Max project notes chars inlined in system prompt (TOK-10). */
export const MAX_PROJECT_NOTES_CHARS = 1_000;

export const truncateProjectNotes = (notes: string): { text: string; truncated: boolean } => {
  const trimmed = notes.trim();
  if (trimmed.length <= MAX_PROJECT_NOTES_CHARS) {
    return { text: trimmed, truncated: false };
  }

  const hint = '… [Project notes truncated — edit in Settings for full text.]';
  const sliceBudget = Math.max(0, MAX_PROJECT_NOTES_CHARS - hint.length);
  return {
    text: `${trimmed.slice(0, sliceBudget)}${hint}`,
    truncated: true,
  };
};

export const buildAiSystemContextWithResources = (
  pageContext?: AiPageContext | null,
  contextResources?: readonly AiChatContextResourceId[],
  baseContext = 'You are AppEnd OS Assistant, an elite software architect and AI orchestrator. Provide concise, highly technical responses.',
  options?: { projectNotes?: string; askMode?: boolean },
): string => {
  const attached = new Set(contextResources ?? []);
  const parts = [buildAiSystemContext(pageContext, baseContext)];

  if (options?.askMode) {
    parts.push('', ASK_MODE_PLATFORM_RULES);
  }

  if (attached.has('standards')) {
    parts.push('', formatProjectStandardsContextBlock());
  }

  if (attached.has('feature')) {
    parts.push('', formatFeatureGraphContextBlock(pageContext?.pageKey));
  }

  const projectNotes = attached.has('notes') ? options?.projectNotes?.trim() : undefined;
  if (projectNotes) {
    const { text: notesBody } = truncateProjectNotes(projectNotes);
    parts.push('', '## Workspace project notes', '', notesBody);
  }

  return parts.join('\n');
};
