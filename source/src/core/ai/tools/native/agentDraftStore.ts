import { randomUUID } from 'crypto';
import type { DesignerBindingDefinition, DesignerDocument } from '../../../../domain/component-designer/types';
import type { DiffZone } from '../../../../shared/lib/appendoo/diffZones';

/** Optional portal menu intent — applied after the layout draft is saved (Phase 56). */
export type ComponentLayoutMenuEntry = {
  portalSegment: string;
  navLabel: string;
  path?: string;
  /** Designer identity `folder/name` — experience pageKey collapses to the name slug. */
  pageKey: string;
  loaderRef?: string;
};

export type ComponentLayoutDraft = {
  kind: 'component_layout';
  id: string;
  layoutId: string;
  name: string;
  folder: string;
  description?: string;
  document: DesignerDocument;
  bindingDefinitions: Record<string, DesignerBindingDefinition>;
  baseLayoutId?: string;
  /** Snapshot before the latest designer mutation — used for proposal preview deltas. */
  previousDocument?: DesignerDocument;
  /** When set, apply adds this page to the portal menu (DesignerAddToMenuButton parity). */
  menuEntry?: ComponentLayoutMenuEntry;
};

export type ServerFunctionDraft = {
  kind: 'server_function';
  id: string;
  functionId: string;
  name: string;
  folder?: string;
  method?: string;
  path?: string;
  testPayload?: string;
  source: string;
  /** Baseline source before this draft — for proposal diff preview (UX-7). */
  beforeSource?: string;
  baseFunctionId?: string;
  operation?: 'create' | 'update';
};

export type FilePatchDraft = {
  kind: 'file_patch';
  id: string;
  path: string;
  content: string;
  beforeContent?: string;
  beforeHash?: string;
  diffZones?: DiffZone[];
};

export type GitCommitDraft = {
  kind: 'git_commit';
  id: string;
  message: string;
  stageAll?: boolean;
  paths?: string[];
};

export type GitCheckoutDraft = {
  kind: 'git_checkout';
  id: string;
  target: string;
};

export type GitBranchDraft = {
  kind: 'git_branch';
  id: string;
  branchName: string;
  startPoint?: string;
  checkout?: boolean;
};

export type GitOperationDraft = GitCommitDraft | GitCheckoutDraft | GitBranchDraft;

export type DashboardWidgetDraft = {
  kind: 'dashboard_widget';
  id: string;
  pageId: string;
  widget: unknown;
};

export type AgentDraft =
  | ComponentLayoutDraft
  | ServerFunctionDraft
  | FilePatchDraft
  | GitOperationDraft
  | DashboardWidgetDraft;

const drafts = new Map<string, AgentDraft>();

export const createDraftId = (): string => randomUUID();

export const putAgentDraft = (draft: AgentDraft): AgentDraft => {
  drafts.set(draft.id, draft);
  return draft;
};

export const getAgentDraft = (id: string): AgentDraft | undefined => drafts.get(id);

export const listAgentDrafts = (): AgentDraft[] => [...drafts.values()];

export const findServerFunctionDraftByFunctionId = (
  functionId: string,
): ServerFunctionDraft | undefined => {
  const normalizedId = functionId.trim();
  if (!normalizedId) return undefined;

  return listAgentDrafts().find((draft): draft is ServerFunctionDraft => (
    (draft.kind === 'server_function' || draft.kind === 'edge_function')
    && draft.functionId === normalizedId
  ));
};

/** Replace an existing server-function draft for the same functionId instead of accumulating duplicates. */
export const upsertServerFunctionDraft = (draft: ServerFunctionDraft): ServerFunctionDraft => {
  const existing = findServerFunctionDraftByFunctionId(draft.functionId);
  if (existing) {
    const updated: ServerFunctionDraft = { ...draft, id: existing.id };
    drafts.set(existing.id, updated);
    return updated;
  }

  drafts.set(draft.id, draft);
  return draft;
};

export const clearAgentDrafts = (): void => {
  drafts.clear();
};

export const removeAgentDraft = (id: string): boolean => drafts.delete(id);
