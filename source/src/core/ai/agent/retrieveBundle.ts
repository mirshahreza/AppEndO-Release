import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import {
  resolveVibeWorkflowContext,
  type VibeStandardsShard,
  type VibeWorkflowId,
} from './vibeWorkflowContext';

export type RetrieveBundleFlags = {
  workflowStandards: boolean;
  playbookStandards: boolean;
  codeContext: boolean;
  functionContext: boolean;
  featureGraph: boolean;
};

/** Server page preload only — never satisfies the retrieve gate (V4-PATCH-2 / GAP-9). */
export type ServerPreloadedRetrieveFlags = Partial<RetrieveBundleFlags>;

/** @deprecated Use ServerPreloadedRetrieveFlags — preload does not count as agent retrieve. */
export type PreloadedRetrieveState = ServerPreloadedRetrieveFlags;

export const EMPTY_RETRIEVE_FLAGS: RetrieveBundleFlags = {
  workflowStandards: false,
  playbookStandards: false,
  codeContext: false,
  functionContext: false,
  featureGraph: false,
};

export const mergeRetrieveFlags = (
  base: RetrieveBundleFlags,
  patch: Partial<RetrieveBundleFlags>,
): RetrieveBundleFlags => ({
  workflowStandards: base.workflowStandards || Boolean(patch.workflowStandards),
  playbookStandards: base.playbookStandards || Boolean(patch.playbookStandards),
  codeContext: base.codeContext || Boolean(patch.codeContext),
  functionContext: base.functionContext || Boolean(patch.functionContext),
  featureGraph: base.featureGraph || Boolean(patch.featureGraph),
});

const normalizeShardKey = (shard: string): string => (
  shard.trim().toLowerCase().replace(/\.md$/, '')
);

export const applyRetrieveToolCall = (
  flags: RetrieveBundleFlags,
  toolName: string,
  args: Record<string, unknown> | undefined,
  expectedShard: VibeStandardsShard,
): RetrieveBundleFlags => {
  const next = { ...flags };

  if (toolName === 'get_project_standards') {
    const shard = typeof args?.shard === 'string' ? normalizeShardKey(args.shard) : '';
    if (shard === expectedShard) {
      next.workflowStandards = true;
    }
    if (shard === 'vibe-operator-playbook') {
      next.playbookStandards = true;
    }
    if (shard === 'vibe-coding-workflows') {
      next.workflowStandards = true;
    }
  }

  if (toolName === 'read_file' || toolName === 'search_codebase') {
    next.codeContext = true;
  }

  if (toolName === 'get_feature_graph') {
    next.featureGraph = true;
    next.codeContext = true;
  }

  if (toolName === 'get_server_function') {
    next.functionContext = true;
    next.codeContext = true;
  }

  return next;
};

export type RetrieveBundleRequirement = {
  workflowId: VibeWorkflowId;
  standardsShard: VibeStandardsShard;
  requiresFunctionContext: boolean;
};

export const resolveRetrieveBundleRequirement = (
  pageContext?: AiPageContext | null,
  userIntent = '',
): RetrieveBundleRequirement => {
  const ctx = resolveVibeWorkflowContext(pageContext, userIntent);
  const functionId = pageContext?.functionId?.trim();
  return {
    workflowId: ctx.workflowId,
    standardsShard: ctx.standardsShard,
    requiresFunctionContext: ctx.workflowId === 'WF-1' && Boolean(functionId),
  };
};

export const isRetrieveBundleSatisfied = (
  flags: RetrieveBundleFlags,
  requirement: RetrieveBundleRequirement,
): boolean => {
  if (!flags.workflowStandards && !flags.playbookStandards) {
    return false;
  }

  if (!flags.codeContext && !flags.featureGraph && !flags.functionContext) {
    return false;
  }

  if (requirement.requiresFunctionContext && !flags.functionContext) {
    return false;
  }

  return true;
};

export const buildRetrieveBundleGateMessage = (
  requirement: RetrieveBundleRequirement,
  flags: RetrieveBundleFlags,
): string => {
  const missing: string[] = [];

  if (!flags.workflowStandards && !flags.playbookStandards) {
    missing.push(`get_project_standards({ shard: "${requirement.standardsShard}" })`);
  }

  if (!flags.codeContext && !flags.featureGraph && !flags.functionContext) {
    missing.push('one of search_codebase, read_file, get_feature_graph, or get_server_function');
  }

  if (requirement.requiresFunctionContext && !flags.functionContext) {
    missing.push(`get_server_function({ functionId: "…" }) for the active function`);
  }

  return [
    'Retrieve bundle incomplete — complete these before draft_* tools:',
    ...missing.map((item) => `- ${item}`),
  ].join('\n');
};
