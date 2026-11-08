export type AiPageContextViewport = {
  preset?: string;
  width?: number;
  height?: number;
  fillMode?: string;
};

export type AiPageContextSort = {
  field?: string;
  direction?: 'asc' | 'desc';
};

export type AiPageContext = {
  path: string;
  pageLabel: string;
  /** Studio pageKey for feature-scoped search (e.g. users, edge, settings). */
  pageKey?: string;
  pageDescription?: string;
  search?: string;
  /** Component Designer — active layout/draft id */
  layoutId?: string | null;
  selectedNodeId?: string | null;
  draftDirty?: boolean;
  viewport?: AiPageContextViewport;
  /** Edge / managed server functions editor */
  functionId?: string;
  functionName?: string;
  openEditorContentHash?: string;
  /** CRUD grids */
  entityType?: string;
  activeFilters?: Record<string, unknown>;
  sort?: AiPageContextSort;
  /** Settings workspace */
  activeSectionId?: string;
};

export type AiPageContextEnrichment = Omit<AiPageContext, 'path' | 'pageLabel' | 'pageDescription' | 'search'>;

const formatRecord = (value: Record<string, unknown> | undefined): string | null => {
  if (!value || Object.keys(value).length === 0) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

export const buildAiSystemContext = (
  pageContext?: AiPageContext | null,
  baseContext = 'You are AppEnd OS Assistant, an elite software architect and AI orchestrator. Provide concise, highly technical responses.',
): string => {
  if (!pageContext?.path) {
    return baseContext;
  }

  const lines = [
    baseContext,
    '',
    'Current admin page context (use when the user asks about the screen they are on):',
    `- Path: ${pageContext.path}`,
    `- Page: ${pageContext.pageLabel}`,
  ];

  if (pageContext.pageKey?.trim()) {
    lines.push(`- Page key: ${pageContext.pageKey.trim()}`);
  }

  if (pageContext.pageDescription?.trim()) {
    lines.push(`- Description: ${pageContext.pageDescription.trim()}`);
  }

  if (pageContext.search?.trim()) {
    lines.push(`- Query: ${pageContext.search.trim()}`);
  }

  if (pageContext.layoutId) {
    lines.push(`- Layout ID: ${pageContext.layoutId}`);
  }

  if (pageContext.selectedNodeId) {
    lines.push(`- Selected node: ${pageContext.selectedNodeId}`);
  }

  if (pageContext.draftDirty !== undefined) {
    lines.push(`- Draft dirty: ${pageContext.draftDirty ? 'yes' : 'no'}`);
  }

  if (pageContext.viewport) {
    const viewportParts = [
      pageContext.viewport.preset,
      pageContext.viewport.width !== undefined ? `${pageContext.viewport.width}px` : undefined,
      pageContext.viewport.height !== undefined ? `${pageContext.viewport.height}px` : undefined,
      pageContext.viewport.fillMode,
    ].filter(Boolean);
    if (viewportParts.length > 0) {
      lines.push(`- Viewport: ${viewportParts.join(' · ')}`);
    }
  }

  if (pageContext.functionId) {
    lines.push(`- Function ID: ${pageContext.functionId}`);
  }

  if (pageContext.functionName) {
    lines.push(`- Function: ${pageContext.functionName}`);
  }

  if (pageContext.openEditorContentHash) {
    lines.push(`- Editor content hash: ${pageContext.openEditorContentHash}`);
  }

  if (pageContext.entityType) {
    lines.push(`- Entity: ${pageContext.entityType}`);
  }

  const filters = formatRecord(pageContext.activeFilters);
  if (filters) {
    lines.push(`- Active filters: ${filters}`);
  }

  if (pageContext.sort?.field) {
    lines.push(`- Sort: ${pageContext.sort.field} ${pageContext.sort.direction ?? 'asc'}`);
  }

  if (pageContext.activeSectionId) {
    lines.push(`- Settings section: ${pageContext.activeSectionId}`);
  }

  return lines.join('\n');
};

export const mergeAiPageContext = (
  base: AiPageContext,
  enrichment?: AiPageContextEnrichment | null,
): AiPageContext => ({
  ...base,
  ...enrichment,
});

/** Infer studio pageKey from route path when workspace enrichment omitted it. */
export const enrichPageContextFromPath = (pageContext: AiPageContext): AiPageContext => {
  if (pageContext.pageKey?.trim()) {
    return pageContext;
  }

  const path = pageContext.path ?? '';
  if (/\/server-functions(?:\/|$)/i.test(path) || pageContext.functionId?.trim()) {
    return { ...pageContext, pageKey: 'server-functions' };
  }
  if (/\/client-components(?:\/|$)/i.test(path) || pageContext.layoutId) {
    return { ...pageContext, pageKey: 'client-components' };
  }
  if (/\/component-designer(?:\/|$)/i.test(path)) {
    return { ...pageContext, pageKey: 'component-designer' };
  }

  return pageContext;
};
