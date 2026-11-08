import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import { shouldPreferUIWorkflow } from '../../../shared/lib/detectCodingIntent';
import {
  extractPromptEngineeringTargets,
  mergePromptTargetsIntoPageContext,
  resolvePromptEngineeringTargets,
} from '../../../shared/lib/appendoo/promptEngineeringTargets';

export type VibeWorkflowId = 'WF-1' | 'WF-2' | 'WF-3' | 'WF-4' | 'WF-default';

export type VibeStandardsShard =
  | 'vibe-server-function'
  | 'vibe-crud'
  | 'vibe-designer-edit'
  | 'vibe-coding-workflows';

export type VibeWorkflowContext = {
  workflowId: VibeWorkflowId;
  standardsShard: VibeStandardsShard;
  toolOrder: string[];
  limits?: string;
};

const WF1_TOOL_ORDER = [
  'get_project_standards({ shard: "vibe-server-function" })',
  'list_server_functions / get_server_function when a similar function exists',
  'read_file on related contract or example (retrieve gate)',
  'draft_server_function → test_server_function → editor AI panel writes Monaco',
];

const WF2_TOOL_ORDER = [
  'get_project_standards({ shard: "vibe-crud" })',
  'get_feature_graph({ pageKey: "client-components" })',
  'search_codebase + read_file on similar template',
  'draft_component_layout (single screen) OR draft_application_scaffold (multi-page + shell + menu) → panel auto-apply → Designer handoff',
];

const WF3_TOOL_ORDER = [
  'get_project_standards({ shard: "vibe-designer-edit" })',
  'get_page_context — layoutId, selectedNodeId',
  'designer_set_prop / designer_insert_palette_item or draft_component_layout with baseLayoutId',
  'validateProposal → panel auto-apply → Designer handoff',
];

const WF4_TOOL_ORDER = [
  'get_project_standards({ shard: "vibe-coding-workflows" })',
  'WF-1 backend (draft_server_function) then WF-2 UI (draft_component_layout)',
  'One or two proposals — respect proposal size limits',
];

const WF_DEFAULT_TOOL_ORDER = [
  'get_project_standards({ shard: "vibe-operator-playbook" })',
  'get_project_standards({ shard: "vibe-coding-workflows" })',
  'get_feature_graph + search_codebase to scope work',
  'Match WF-1..4 once intent is clear — draft_* only after retrieve gate',
];

export const resolveVibeWorkflowContext = (
  pageContext?: AiPageContext | null,
  userIntent = '',
): VibeWorkflowContext => {
  const promptTargets = resolvePromptEngineeringTargets(
    extractPromptEngineeringTargets(userIntent),
  );
  const effectivePageContext = mergePromptTargetsIntoPageContext(pageContext, promptTargets);

  const pageKey = effectivePageContext?.pageKey?.trim();
  const layoutId = effectivePageContext?.layoutId?.trim();
  const selectedNodeId = effectivePageContext?.selectedNodeId?.trim();
  const functionId = effectivePageContext?.functionId?.trim();
  const trimmedIntent = userIntent.trim();

  if (layoutId || selectedNodeId) {
    return {
      workflowId: 'WF-3',
      standardsShard: 'vibe-designer-edit',
      toolOrder: WF3_TOOL_ORDER,
    };
  }

  if (shouldPreferUIWorkflow(trimmedIntent)) {
    return {
      workflowId: 'WF-2',
      standardsShard: 'vibe-crud',
      toolOrder: WF2_TOOL_ORDER,
    };
  }

  if (pageKey === 'server-functions' || functionId) {
    return {
      workflowId: 'WF-1',
      standardsShard: 'vibe-server-function',
      toolOrder: WF1_TOOL_ORDER,
    };
  }

  if (pageKey === 'client-components') {
    return {
      workflowId: 'WF-2',
      standardsShard: 'vibe-crud',
      toolOrder: WF2_TOOL_ORDER,
    };
  }

  if (!pageKey && !functionId) {
    return {
      workflowId: 'WF-default',
      standardsShard: 'vibe-coding-workflows',
      toolOrder: WF_DEFAULT_TOOL_ORDER,
    };
  }

  return {
    workflowId: 'WF-4',
    standardsShard: 'vibe-coding-workflows',
    toolOrder: WF4_TOOL_ORDER,
    limits: 'vibeMaxFilesPerProposal (12 full-stack) · vibeMaxLinesPerProposal per agent settings',
  };
};

export const formatActiveVibeWorkflowBlock = (
  pageContext?: AiPageContext | null,
  userIntent = '',
): string => {
  const ctx = resolveVibeWorkflowContext(pageContext, userIntent);
  const lines = [
    '## Active vibe workflow',
    `Active workflow: ${ctx.workflowId} (resolved from user request and page context).`,
    `Retrieve shard: get_project_standards({ shard: "${ctx.standardsShard}" })`,
    'Tool order (summary — see shard for full detail):',
    ...ctx.toolOrder.map((step) => `- ${step}`),
  ];

  if (ctx.limits) {
    lines.push(`Proposal limits: ${ctx.limits}`);
  }

  return lines.join('\n');
};

export const buildRetrieveGateShardHint = (
  pageContext?: AiPageContext | null,
  userIntent = '',
): string => {
  const { standardsShard } = resolveVibeWorkflowContext(pageContext, userIntent);
  return `Suggested retrieve: get_project_standards({ shard: "${standardsShard}" }).`;
};

export const resolveDraftWorkflowTarget = (
  pageContext?: AiPageContext | null,
  userIntent = '',
): { draftTool: 'draft_server_function' | 'draft_component_layout'; standardsShard: VibeStandardsShard } => {
  const ctx = resolveVibeWorkflowContext(pageContext, userIntent);
  return {
    draftTool: ctx.workflowId === 'WF-1' ? 'draft_server_function' : 'draft_component_layout',
    standardsShard: ctx.standardsShard,
  };
};
