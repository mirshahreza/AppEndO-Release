export type AgentActivityKind = 'retrieve' | 'draft' | 'test' | 'repair' | 'git' | 'other';

export type AgentActivityLabel = {
  kind: AgentActivityKind;
  title: string;
  titleEn: string;
  detail?: string;
  intention?: string;
};

const readStringArg = (args: Record<string, unknown>, key: string): string => {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
};

const SECRET_ARG_KEYS = new Set(['apikey', 'api_key', 'token', 'password', 'secret', 'authorization']);

export const formatAgentActivityArgsOneLiner = (
  toolName: string,
  args: Record<string, unknown>,
): string | undefined => {
  const parts: string[] = [];
  const push = (label: string, value: string) => {
    if (value) parts.push(`${label}: ${value}`);
  };

  switch (toolName) {
    case 'read_file':
    case 'draft_file_patch':
      push('path', readStringArg(args, 'path'));
      break;
    case 'search_codebase':
      push('query', readStringArg(args, 'query'));
      if (readStringArg(args, 'pageKey')) push('pageKey', readStringArg(args, 'pageKey'));
      break;
    case 'get_server_function':
    case 'test_server_function':
      push('functionId', readStringArg(args, 'functionId'));
      break;
    case 'get_project_standards':
      if (readStringArg(args, 'shard')) push('shard', readStringArg(args, 'shard'));
      else if (readStringArg(args, 'query')) push('query', readStringArg(args, 'query'));
      break;
    case 'draft_server_function':
      push('name', readStringArg(args, 'name') || readStringArg(args, 'functionId'));
      break;
    case 'draft_component_layout':
      push('name', readStringArg(args, 'name') || readStringArg(args, 'layoutId'));
      break;
    case 'glob_files':
      push('pattern', readStringArg(args, 'pattern'));
      break;
    case 'list_dir':
      push('path', readStringArg(args, 'path'));
      break;
    case 'get_feature_graph':
      if (readStringArg(args, 'pageKey')) push('pageKey', readStringArg(args, 'pageKey'));
      break;
    default:
      for (const [key, value] of Object.entries(args)) {
        if (SECRET_ARG_KEYS.has(key.toLowerCase())) {
          parts.push(`${key}: [redacted]`);
          continue;
        }
        if (typeof value === 'string' && value.trim() && value.length <= 120) {
          parts.push(`${key}: ${value.trim()}`);
        }
      }
  }

  if (parts.length === 0) return undefined;
  return parts.join(' · ');
};

const toolKind = (toolName: string): AgentActivityKind => {
  if (toolName.startsWith('draft_')) return 'draft';
  if (toolName === 'test_server_function' || toolName === 'run_tests') return 'test';
  if (toolName.startsWith('git_')) return 'git';
  if (toolName === 'search_codebase' || toolName === 'read_file' || toolName === 'glob_files'
    || toolName === 'list_dir' || toolName === 'get_feature_graph' || toolName === 'get_project_standards'
    || toolName === 'get_server_function' || toolName === 'get_page_context') {
    return 'retrieve';
  }
  return 'other';
};

const formatEn = (toolName: string, args: Record<string, unknown>): AgentActivityLabel => {
  const kind = toolKind(toolName);

  switch (toolName) {
    case 'get_server_function': {
      const functionId = readStringArg(args, 'functionId') || '…';
      return {
        kind,
        title: `Reading server function ${functionId}`,
        titleEn: `Reading server function ${functionId}`,
        detail: functionId,
        intention: 'To inspect the function contract and source before drafting',
      };
    }
    case 'search_codebase': {
      const query = readStringArg(args, 'query') || '…';
      return {
        kind,
        title: `Searching: "${query}"`,
        titleEn: `Searching: "${query}"`,
        detail: query,
        intention: 'To find related code in the repository',
      };
    }
    case 'read_file': {
      const path = readStringArg(args, 'path') || '…';
      return {
        kind,
        title: `Reading ${path}`,
        titleEn: `Reading ${path}`,
        detail: path,
        intention: 'To review file contents before editing',
      };
    }
    case 'get_project_standards': {
      const shard = readStringArg(args, 'shard');
      const query = readStringArg(args, 'query');
      const target = shard || query || 'standards';
      return {
        kind,
        title: `Loading standards ${target}`,
        titleEn: `Loading standards ${target}`,
        detail: target,
        intention: 'To follow project conventions before implementing',
      };
    }
    case 'draft_server_function': {
      const name = readStringArg(args, 'name') || readStringArg(args, 'functionId') || '…';
      return {
        kind,
        title: `Drafting server function ${name}`,
        titleEn: `Drafting server function ${name}`,
        detail: name,
        intention: 'To register a draft in the official Server Functions path',
      };
    }
    case 'draft_component_layout': {
      const name = readStringArg(args, 'name') || readStringArg(args, 'layoutId') || '…';
      return {
        kind,
        title: `Drafting layout ${name}`,
        titleEn: `Drafting layout ${name}`,
        detail: name,
        intention: 'To build or update a page in Component Designer',
      };
    }
    case 'draft_file_patch': {
      const path = readStringArg(args, 'path') || '…';
      return {
        kind,
        title: `Drafting file patch ${path}`,
        titleEn: `Drafting file patch ${path}`,
        detail: path,
        intention: 'To apply a code change in an allowlisted file',
      };
    }
    case 'test_server_function': {
      const functionId = readStringArg(args, 'functionId') || '…';
      return {
        kind,
        title: `Testing server function ${functionId}`,
        titleEn: `Testing server function ${functionId}`,
        detail: functionId,
        intention: 'To verify the function works before approval',
      };
    }
    case 'get_feature_graph': {
      const pageKey = readStringArg(args, 'pageKey') || 'index';
      return {
        kind,
        title: pageKey === 'index' ? 'Loading feature graph index' : `Feature graph: ${pageKey}`,
        titleEn: pageKey === 'index' ? 'Loading feature graph index' : `Feature graph: ${pageKey}`,
        detail: pageKey,
        intention: 'To locate the feature in the codebase',
      };
    }
    case 'get_page_context': {
      return {
        kind,
        title: 'Reading current page context',
        titleEn: 'Reading current page context',
        intention: 'To understand the open page or function in the studio',
      };
    }
    case 'ask_clarifying_question': {
      const question = readStringArg(args, 'question') || '…';
      return {
        kind: 'other',
        title: 'Asking a clarifying question',
        titleEn: 'Asking a clarifying question',
        detail: question,
        intention: 'To confirm the exact goal instead of guessing',
      };
    }
    case 'update_todo_list': {
      return {
        kind: 'other',
        title: 'Updating todo list',
        titleEn: 'Updating todo list',
        intention: 'To track multi-step work separately from the tool log',
      };
    }
    case 'glob_files': {
      const pattern = readStringArg(args, 'pattern') || '…';
      return {
        kind,
        title: `Globbing files: ${pattern}`,
        titleEn: `Globbing files: ${pattern}`,
        detail: pattern,
        intention: 'To find related file paths',
      };
    }
    case 'list_dir': {
      const path = readStringArg(args, 'path') || 'root';
      return {
        kind,
        title: `Listing directory ${path}`,
        titleEn: `Listing directory ${path}`,
        detail: path,
        intention: 'To explore folder structure',
      };
    }
    default:
      return {
        kind,
        title: `Running ${toolName}`,
        titleEn: `Running ${toolName}`,
        intention: 'Continuing agent work',
      };
  }
};

export const formatAgentActivityLabel = (
  toolName: string,
  args: Record<string, unknown>,
  _locale: 'fa' | 'en' = 'en',
  modelIntention?: string,
): AgentActivityLabel => {
  const label = formatEn(toolName, args);
  const intention = modelIntention?.trim() || label.intention;
  const argsLine = formatAgentActivityArgsOneLiner(toolName, args);
  return {
    ...label,
    intention,
    detail: argsLine ?? label.detail,
  };
};

export const formatAgentRepairLabel = (
  violations: { ruleId?: string; message: string }[],
  _locale: 'fa' | 'en' = 'en',
): AgentActivityLabel => {
  const count = violations.length;
  const title = `Repairing draft (${count} issue${count === 1 ? '' : 's'})`;
  return {
    kind: 'repair',
    title,
    titleEn: title,
    detail: violations.map((item) => item.message).join('; '),
    intention: 'Fix validation issues before proposing changes',
  };
};

export const formatAgentPlanningStatus = (_locale: 'fa' | 'en' = 'en'): string => (
  'Planning next step…'
);

export const formatAgentAnalyzingStatus = (_locale: 'fa' | 'en' = 'en'): string => (
  'Analyzing request…'
);

export const formatScaffoldSeedActivity = (
  sources: string[],
  _locale: 'fa' | 'en' = 'en',
): AgentActivityLabel => ({
  kind: 'retrieve',
  title: 'Starting idea from server seed',
  titleEn: 'Starting idea from server seed',
  detail: sources.length ? sources.join(', ') : undefined,
  intention: 'Verify with retrieve tools — seed does not replace them',
});

export const formatContextCompressionActivity = (
  prunedCount: number,
  _locale: 'fa' | 'en' = 'en',
): AgentActivityLabel => ({
  kind: 'other',
  title: `Compressed ${prunedCount} older tool observation(s)`,
  titleEn: `Compressed ${prunedCount} older tool observation(s)`,
  intention: 'Keeping context within token budget',
});

export const formatAgentTurnSummaryMessage = (input: {
  retrievalOperationCount: number;
  draftToolCount: number;
  changeSetCount: number;
  changeSetTitles?: string[];
  locale?: 'fa' | 'en';
}): string => {
  const titles = input.changeSetTitles?.filter(Boolean) ?? [];
  const lines = [
    'Summary:',
    `• Retrieved via tools: ${input.retrievalOperationCount} step(s)`,
    `• Draft tools: ${input.draftToolCount}`,
  ];
  if (input.changeSetCount > 0) {
    lines.push(`• Proposed changes: ${input.changeSetCount}`);
    titles.slice(0, 4).forEach((title) => lines.push(`  - ${title}`));
  }
  return lines.join('\n');
};

/** Display locale is always English per ui.copy.english-only. */
export const resolveUserDisplayLocale = (_userText: string): 'fa' | 'en' => 'en';

export const formatIterationLimitMessage = (
  _locale: 'fa' | 'en',
  variant: 'with_continue_hint' | 'final',
): string => (
  variant === 'with_continue_hint'
    ? 'Reached the step limit for this turn. Say "continue" if you want me to keep going.'
    : 'Reached the step limit for this turn. Say "continue" to resume.'
);

export const formatTokenPressureCompressionDetail = (
  intention: string,
  pressurePercent: number,
  _locale: 'fa' | 'en',
): string => (
  `${intention} (~${pressurePercent}% of token budget)`
);

export const formatEmergencyCondenseDetail = (
  intention: string,
  _locale: 'fa' | 'en',
): string => (
  `${intention} (token budget reached — emergency condensation)`
);

export const formatDirectRetrieveNote = (
  _locale: 'fa' | 'en',
): { title: string; detail: string } => ({
  title: 'Direct retrieve — verified with tools',
  detail: 'Preload seed was not enough; the agent retrieved directly.',
});

export const formatProposalFinalizeMessage = (
  summary: string,
  validationOk: boolean,
  _locale: 'fa' | 'en',
): string => (
  validationOk
    ? `${summary}\n\nChanges are built and will be applied automatically.`
    : `${summary}\n\nThe proposal has validation errors — fix them before approving.`
);

/**
 * p-98 — live-model eval baseline found the model's own final reply (per AGENT_WRITE_RULES,
 * "state what was built or changed") narrates completion positively even when repair attempts
 * were exhausted and validation errors remain — formatProposalFinalizeMessage above only ever
 * runs when the model produced no text of its own, so this case slipped through silently.
 * Appended to the model's own text, never silently dropped.
 */
export const formatUnresolvedValidationNotice = (_locale: 'fa' | 'en'): string => (
  'Note: this proposal has unresolved validation errors — review before approving.'
);

export const formatTurnProfileLabel = (
  profile: string,
  _locale: 'fa' | 'en' = 'en',
): string => {
  switch (profile) {
    case 'ask_lookup':
      return 'Answering (read-only)';
    case 'agent_lookup':
      return 'Investigating your question (no code changes)';
    case 'agent_plan_review':
      return 'Reviewing and planning — no file changes';
    case 'agent_implement':
      return 'Implementing your request';
    case 'agent_implement_governed':
      return 'Governed engineering path (architect approval)';
    case 'plan_authoring':
      return 'Updating plan document';
    default:
      return 'Working';
  }
};

export const formatEngineeringPipelineStatus = (
  kind: 'understanding_contract' | 'designing_and_building' | 'needs_more_context' | 'awaiting_approval',
  _locale: 'fa' | 'en',
): string => {
  switch (kind) {
    case 'understanding_contract':
      return 'Understanding target and server function contract…';
    case 'designing_and_building':
      return 'Designing UI layout and building…';
    case 'needs_more_context':
      return 'Engineering plan needs more context — continuing with AI tools…';
    case 'awaiting_approval':
      return 'Engineering plan ready — review below and approve to build.';
  }
};

export const formatReverseAuditNote = (
  artifactCount: number,
  objective: string,
  _locale: 'fa' | 'en',
): { title: string; detail: string } => ({
  title: 'Governance reverse-audit plan',
  detail: `${artifactCount} artifact(s) · ${objective}`,
});

export const describePreloadedRetrieveSources = (
  preloaded: {
    playbookStandards?: boolean;
    workflowStandards?: boolean;
    functionContext?: boolean;
    codeContext?: boolean;
  },
  _locale: 'fa' | 'en' = 'en',
): string[] => {
  const sources: string[] = [];
  if (preloaded.playbookStandards) sources.push('playbook');
  if (preloaded.workflowStandards) sources.push('workflow standards');
  if (preloaded.functionContext) sources.push('open server function');
  if (preloaded.codeContext && !preloaded.functionContext) sources.push('designer layout');
  return sources;
};
