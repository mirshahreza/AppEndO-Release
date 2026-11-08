import { randomUUID } from 'crypto';
import type { ChangeSet } from '../../../shared/api/contracts/ai/agentTypes';
import { buildManagedFunctionId } from '../../functions/functionNaming';
import { normalizeSandboxSource } from '../../../shared/server-functions/sandboxSourceNormalize';
import { getAgentDraft, listAgentDrafts, type AgentDraft } from '../tools/native/agentDraftStore';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const buildChangeSetsFromDrafts = (draftIds?: string[]): ChangeSet[] => {
  const drafts = draftIds?.length
    ? draftIds.map((id) => getAgentDraft(id)).filter((draft): draft is AgentDraft => Boolean(draft))
    : listAgentDrafts();

  return prepareProposalChangeSets(
    dedupeDraftsForProposal(drafts).map((draft) => draftToChangeSet(draft)),
  );
};

/** Normalize server-function sources and collapse duplicate targets before validate/apply. */
export const prepareProposalChangeSets = (changeSets: ChangeSet[]): ChangeSet[] => (
  dedupeChangeSetsForProposal(
    changeSets.map((changeSet) => normalizeFunctionSourceChangeSet(changeSet)),
  )
);

const dedupeDraftsForProposal = (drafts: AgentDraft[]): AgentDraft[] => {
  const latestByKey = new Map<string, AgentDraft>();

  drafts.forEach((draft) => {
    const key = resolveDraftDedupeKey(draft);
    latestByKey.set(key, draft);
  });

  return [...latestByKey.values()];
};

const resolveDraftDedupeKey = (draft: AgentDraft): string => {
  switch (draft.kind) {
    case 'server_function':
    case 'edge_function':
      return `server_function:${draft.functionId}`;
    case 'component_layout':
      return `component_layout:${draft.layoutId}`;
    case 'file_patch':
      return `file_patch:${draft.path}`;
    default:
      return `${draft.kind}:${draft.id}`;
  }
};

const dedupeChangeSetsForProposal = (changeSets: ChangeSet[]): ChangeSet[] => {
  const latestByKey = new Map<string, ChangeSet>();
  changeSets.forEach((changeSet) => {
    latestByKey.set(resolveChangeSetDedupeKey(changeSet), changeSet);
  });
  return [...latestByKey.values()];
};

const resolveChangeSetDedupeKey = (changeSet: ChangeSet): string => {
  switch (changeSet.kind) {
    case 'function_source_patch':
      return `function_source_patch:${changeSet.functionId}`;
    case 'component_layout_patch':
      return `component_layout_patch:${changeSet.layoutId}`;
    case 'file_patch':
      return `file_patch:${changeSet.path}`;
    default:
      return `${changeSet.kind}:${changeSet.id}`;
  }
};

const normalizeFunctionSourceChangeSet = (changeSet: ChangeSet): ChangeSet => {
  if (changeSet.kind !== 'function_source_patch') return changeSet;

  const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
  const source = typeof patch.source === 'string' ? patch.source : '';
  const normalizedSource = normalizeSandboxSource(source);
  if (normalizedSource === source) return changeSet;

  return {
    ...changeSet,
    patch: {
      ...patch,
      source: normalizedSource,
    },
  };
};

const resolveServerFunctionChangeSetId = (
  functionId: string,
  name: string,
  folder?: string,
): string => {
  if (functionId.includes('.')) return functionId;
  const folderSegment = folder?.trim().toLowerCase() || 'general';
  return buildManagedFunctionId(folderSegment, name);
};

const draftToChangeSet = (draft: AgentDraft): ChangeSet => {
  switch (draft.kind) {
    case 'component_layout':
      return {
        id: `cs-${draft.id}`,
        kind: 'component_layout_patch',
        title: `Component layout: ${draft.name}`,
        summary: draft.description,
        layoutId: draft.layoutId,
        patch: {
          name: draft.name,
          folder: draft.folder,
          document: draft.document,
          bindingDefinitions: draft.bindingDefinitions,
          baseLayoutId: draft.baseLayoutId,
          previousDocument: draft.previousDocument,
          ...(draft.menuEntry ? { menuEntry: draft.menuEntry } : {}),
        },
      };
    case 'server_function':
      return {
        id: `cs-${draft.id}`,
        kind: 'function_source_patch',
        title: `Server function: ${draft.name}`,
        functionId: resolveServerFunctionChangeSetId(draft.functionId, draft.name, draft.folder),
        patch: {
          name: draft.name,
          folder: draft.folder,
          method: draft.method,
          path: draft.path,
          testPayload: draft.testPayload,
          source: draft.source,
          operation: draft.operation ?? (draft.baseFunctionId ? 'update' : 'create'),
          ...(draft.baseFunctionId ? { baseFunctionId: draft.baseFunctionId } : {}),
          ...(draft.beforeSource ? { beforeSource: draft.beforeSource } : {}),
        },
      };
    case 'edge_function':
      return {
        id: `cs-${draft.id}`,
        kind: 'function_source_patch',
        title: `Edge function: ${draft.name}`,
        functionId: resolveServerFunctionChangeSetId(draft.functionId, draft.name, draft.folder),
        patch: {
          name: draft.name,
          folder: draft.folder,
          method: draft.method,
          path: draft.path,
          testPayload: draft.testPayload,
          source: draft.source,
          operation: draft.operation ?? (draft.baseFunctionId ? 'update' : 'create'),
          ...(draft.baseFunctionId ? { baseFunctionId: draft.baseFunctionId } : {}),
          ...(draft.beforeSource ? { beforeSource: draft.beforeSource } : {}),
        },
      };
    case 'file_patch':
      return {
        id: `cs-${draft.id}`,
        kind: 'file_patch',
        title: `File patch: ${draft.path}`,
        path: draft.path,
        beforeHash: draft.beforeHash,
        beforeContent: draft.beforeContent,
        diffZones: draft.diffZones,
        content: draft.content,
      };
    case 'git_commit':
      return {
        id: `cs-${draft.id}`,
        kind: 'git_operation',
        title: `Git commit: ${draft.message.slice(0, 80)}`,
        summary: draft.paths?.length
          ? `Stage ${draft.paths.length} path(s) and commit`
          : draft.stageAll
            ? 'Stage all changes and commit'
            : 'Commit staged changes',
        operation: 'commit',
        message: draft.message,
        stageAll: draft.stageAll,
        paths: draft.paths,
      };
    case 'git_checkout':
      return {
        id: `cs-${draft.id}`,
        kind: 'git_operation',
        title: `Git checkout: ${draft.target}`,
        operation: 'checkout',
        target: draft.target,
      };
    case 'git_branch':
      return {
        id: `cs-${draft.id}`,
        kind: 'git_operation',
        title: `Git branch: ${draft.branchName}`,
        summary: draft.checkout === false ? 'Create branch only' : 'Create and checkout branch',
        operation: 'branch',
        branchName: draft.branchName,
        startPoint: draft.startPoint,
        checkout: draft.checkout ?? true,
      };
    default:
      return {
        id: `cs-${randomUUID()}`,
        kind: 'file_patch',
        title: 'Unknown draft',
        path: 'unknown',
        content: '',
      };
  }
};

export const createProposalId = (): string => randomUUID();
