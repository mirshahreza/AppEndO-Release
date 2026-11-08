import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import { findManagedFunctionById } from '../../domain/functions/functionRepository';
import { listDesignerDrafts, readDraftRecord } from '../../domain/component-designer/draftIo';
import { loadStandardsShardContent } from '../../../core/ai/tools/native/standardsShardLoader';
import {
  resolveRetrieveBundleRequirement,
  type PreloadedRetrieveState,
} from '../../../core/ai/agent/retrieveBundle';
import type { TurnExecutionProfile } from '../../../core/ai/agent/turnExecutionProfile';
import { isLookupProfile } from '../../../core/ai/agent/turnExecutionProfile';
import {
  extractPromptEngineeringTargets,
  mergePromptTargetsIntoPageContext,
  resolvePromptEngineeringTargets,
} from '../../../shared/lib/appendoo/promptEngineeringTargets';
import { formatDesignerApplicationStructure } from '../../../core/ai/agent/contextAssembly';

const PLAYBOOK_SHARD = 'vibe-operator-playbook';
const MAX_PLAYBOOK_CHARS = 2_400;
const MAX_WORKFLOW_SHARD_CHARS = 3_200;
const MAX_FUNCTION_SOURCE_CHARS = 3_500;
const MAX_LAYOUT_SUMMARY_CHARS = 2_000;

const truncateBlock = (title: string, body: string, maxChars: number): string => {
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxChars) {
    return `## ${title}\n${trimmed}`;
  }
  return [
    `## ${title}`,
    `${trimmed.slice(0, maxChars)}…`,
    '[Truncated — use tools for full content.]',
  ].join('\n');
};

const summarizeLayout = (
  layoutId: string,
  record: NonNullable<ReturnType<typeof readDraftRecord>>,
  selectedNodeId?: string,
): string => {
  const nodeCount = Array.isArray(record.document?.nodes) ? record.document.nodes.length : 0;
  const rootType = record.document?.root?.type ?? 'unknown';
  const lines = [
    `- layoutId: ${layoutId}`,
    `- name: ${record.name}`,
    `- folder: ${record.folder}`,
    `- root: ${rootType}`,
    `- nodeCount: ${nodeCount}`,
  ];
  if (selectedNodeId?.trim()) {
    lines.push(`- selectedNodeId: ${selectedNodeId.trim()}`);
  }
  return lines.join('\n');
};

export type PageContextPreloadResult = {
  block: string | null;
  preloadedRetrieve: PreloadedRetrieveState;
};

export const buildPageContextPreload = async (
  pageContext?: AiPageContext | null,
  userIntent = '',
  executionProfile: TurnExecutionProfile = 'agent_implement',
): Promise<PageContextPreloadResult> => {
  if (isLookupProfile(executionProfile)) {
    return buildLookupPageContextPreload(pageContext);
  }

  const promptTargets = resolvePromptEngineeringTargets(
    extractPromptEngineeringTargets(userIntent),
  );
  const effectivePageContext = mergePromptTargetsIntoPageContext(pageContext, promptTargets);

  const requirement = resolveRetrieveBundleRequirement(effectivePageContext, userIntent);
  const parts: string[] = [];
  const preloadedRetrieve: PreloadedRetrieveState = {};

  const playbook = loadStandardsShardContent(PLAYBOOK_SHARD, MAX_PLAYBOOK_CHARS);
  if (playbook.ok) {
    const block = truncateBlock('Suggested seed — vibe-operator-playbook', playbook.content, MAX_PLAYBOOK_CHARS);
    if (block) {
      parts.push(block);
      preloadedRetrieve.playbookStandards = true;
    }
  }

  const workflowShard = loadStandardsShardContent(requirement.standardsShard, MAX_WORKFLOW_SHARD_CHARS);
  if (workflowShard.ok) {
    const block = truncateBlock(
      `Suggested seed — workflow standards (${requirement.standardsShard})`,
      workflowShard.content,
      MAX_WORKFLOW_SHARD_CHARS,
    );
    if (block) {
      parts.push(block);
      preloadedRetrieve.workflowStandards = true;
    }
  }

  const functionId = effectivePageContext?.functionId?.trim();
  if (functionId) {
    try {
      const fn = await findManagedFunctionById(functionId);
      if (fn) {
        const source = fn.code.length > MAX_FUNCTION_SOURCE_CHARS
          ? `${fn.code.slice(0, MAX_FUNCTION_SOURCE_CHARS)}\n/* …truncated… */`
          : fn.code;
        parts.push([
          '## Suggested seed — active server function',
          'Verify with get_server_function before drafting.',
          `- functionId: ${fn.id}`,
          `- method: ${fn.method}`,
          `- path: ${fn.path}`,
          '',
          '```typescript',
          source,
          '```',
        ].join('\n'));
        preloadedRetrieve.functionContext = true;
        preloadedRetrieve.codeContext = true;
      }
    } catch {
      // Best-effort preload.
    }
  }

  const layoutId = effectivePageContext?.layoutId?.trim();
  if (layoutId) {
    try {
      const record = readDraftRecord(layoutId);
      if (record) {
        const summary = summarizeLayout(layoutId, record, effectivePageContext?.selectedNodeId);
        parts.push(truncateBlock('Suggested seed — designer layout', summary, MAX_LAYOUT_SUMMARY_CHARS));
        preloadedRetrieve.codeContext = true;
      }
    } catch {
      // Best-effort preload.
    }
  }

  const pageKey = effectivePageContext?.pageKey?.trim();
  if (
    pageKey === 'client-components'
    || pageKey === 'component-designer'
    || layoutId
  ) {
    try {
      const structure = formatDesignerApplicationStructure(listDesignerDrafts(), { maxLines: 40 });
      if (structure) {
        parts.push(structure);
        preloadedRetrieve.codeContext = true;
      }
    } catch {
      // Best-effort preload.
    }
  }

  if (parts.length === 0) {
    return { block: null, preloadedRetrieve };
  }

  return {
    block: [
      '## Suggested seed (server-side — verify before using)',
      'Starting hints only — this does NOT satisfy retrieve. Call retrieve tools for anything you will edit.',
      '',
      ...parts,
    ].join('\n'),
    preloadedRetrieve,
  };
};

const buildLookupPageContextPreload = (
  pageContext?: AiPageContext | null,
): PageContextPreloadResult => {
  const lines: string[] = [];
  if (pageContext?.pageLabel?.trim()) {
    lines.push(`- Page: ${pageContext.pageLabel.trim()}`);
  }
  if (pageContext?.pageKey?.trim()) {
    lines.push(`- pageKey: ${pageContext.pageKey.trim()}`);
  }
  if (pageContext?.functionId?.trim()) {
    lines.push(`- Open function id: ${pageContext.functionId.trim()}`);
  }
  if (pageContext?.functionName?.trim()) {
    lines.push(`- Open function name: ${pageContext.functionName.trim()}`);
  }
  if (pageContext?.layoutId?.trim()) {
    lines.push(`- Open layout id: ${pageContext.layoutId.trim()}`);
  }

  if (lines.length === 0) {
    return { block: null, preloadedRetrieve: {} };
  }

  return {
    block: [
      '## Page context (lookup only — no implementation preload)',
      'Answer the user question; do not draft or modify unless they send an implementation request.',
      '',
      ...lines,
    ].join('\n'),
    preloadedRetrieve: {},
  };
};
