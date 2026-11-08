import { describe, expect, it } from 'vitest';
import {
  assembleAgentContext,
  APPENDO_VIBE_PLATFORM_RULES,
  RETRIEVAL_AND_SEARCH_RULES,
  VIBE_RETRIEVAL_DEFAULTS,
  VIBE_WORKFLOW_RULES,
} from '../contextAssembly';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { AgentMessage } from '../types';

const LEGACY_RETRIEVAL_RULES_CHARS = [
  'You are in Agent mode with read-only tools.',
  'Use tools to retrieve facts before answering code or standards questions.',
  'Never claim file contents or standards you have not retrieved in this session.',
  'Hybrid codebase search: get_feature_graph (pageKey) → search_codebase ({ pageKey }) → read_file (startLine/endLine, verify).',
  'search_codebase returns path + line only by default; use includeText: true only when you need a quick peek without read_file.',
  'For studio feature work, pass pageKey to search_codebase to scope to that feature (not whole repo).',
  'Broaden with search_codebase includeShared or explicit path only when feature-scoped search is insufficient.',
  'Never cite code you have not read with read_file in this session.',
  'After search_codebase hits, always read_file the relevant line range before answering.',
].join('\n').length;

const agentModeBaseConfig = {
  mode: 'agent' as const,
  executionProfile: 'agent_implement' as const,
  agentSettings: DEFAULT_AI_AGENT_SETTINGS,
};

describe('TOK-11 system prompt compaction', () => {
  it('merges retrieval + search rules without losing key semantics', () => {
    expect(RETRIEVAL_AND_SEARCH_RULES).toContain('get_feature_graph');
    expect(RETRIEVAL_AND_SEARCH_RULES).toContain('search_codebase');
    expect(RETRIEVAL_AND_SEARCH_RULES).toContain('read_file');
    expect(RETRIEVAL_AND_SEARCH_RULES).toContain('pageKey');
    expect(RETRIEVAL_AND_SEARCH_RULES).toContain('includeText');
    expect(RETRIEVAL_AND_SEARCH_RULES).toContain('includeShared');
    // p-98 — reworded from "never cite" to a positive ground-every-claim framing; same semantics.
    expect(RETRIEVAL_AND_SEARCH_RULES).toContain('actually retrieved this session');
  });

  it('reduces retrieval rules block by at least 15% vs legacy', () => {
    const reduction = 1 - RETRIEVAL_AND_SEARCH_RULES.length / LEGACY_RETRIEVAL_RULES_CHARS;
    expect(reduction).toBeGreaterThanOrEqual(0.15);
  });

  it('uses pre-resolved history summary as an in-band reminder, keeping the system prompt stable', () => {
    const messages: AgentMessage[] = Array.from({ length: 60 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message-${index}`,
    }));

    const assembled = assembleAgentContext(messages, {
      mode: 'agent',
      agentSettings: {
        ...DEFAULT_AI_AGENT_SETTINGS,
        contextSummarizeAfterTurns: 8,
      },
    }, 'Pre-resolved segment H');

    // p-61 Phase C — the summary rides in the message stream (cache-stable system prompt).
    expect(assembled.systemPrompt).not.toContain('Pre-resolved segment H');
    expect(assembled.workingMessages[0]?.content).toContain('Pre-resolved segment H');
    expect(assembled.workingMessages.some((message) => message.content === 'message-0')).toBe(false);
  });

  it('agent mode drops redundant read_file reminder from write rules', () => {
    const assembled = assembleAgentContext([], agentModeBaseConfig);
    expect(assembled.systemPrompt).toContain(RETRIEVAL_AND_SEARCH_RULES);
    // p-98 — tool-specific routing (which draft_* tool for which case) moved to each tool's own
    // description; the prompt now only carries the general "use draft_* tools" instruction.
    expect(assembled.systemPrompt).toContain('draft_*');
    expect(assembled.systemPrompt).not.toContain('After search_codebase, verify with read_file before drafting');
    const rulesSavings = LEGACY_RETRIEVAL_RULES_CHARS + 58 - RETRIEVAL_AND_SEARCH_RULES.length;
    expect(rulesSavings).toBeGreaterThanOrEqual(LEGACY_RETRIEVAL_RULES_CHARS * 0.15);
  });

  it('plan mode includes compact plan rules and shared retrieval block', () => {
    const assembled = assembleAgentContext([], {
      mode: 'plan',
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });
    expect(assembled.systemPrompt).toContain(RETRIEVAL_AND_SEARCH_RULES);
    expect(assembled.systemPrompt).toContain('Plan mode');
    expect(assembled.systemPrompt).toContain('plans/core/');
    expect(assembled.systemPrompt).not.toContain('You are in Agent mode with read-only tools');
  });

  it('agent mode includes vibe workflow rules (VC-1.5)', () => {
    const assembled = assembleAgentContext([], agentModeBaseConfig);
    expect(assembled.systemPrompt).toContain(VIBE_WORKFLOW_RULES);
    expect(assembled.systemPrompt).toContain(VIBE_RETRIEVAL_DEFAULTS);
    expect(assembled.systemPrompt).toContain(APPENDO_VIBE_PLATFORM_RULES);
    expect(assembled.systemPrompt).toContain('vibe-operator-playbook');
    expect(assembled.systemPrompt).toContain('live running AppEndO instance');
    expect(assembled.systemPrompt).toContain('WF-1');
    expect(assembled.systemPrompt).toContain('vibe-coding-workflows');
  });

  it('agent mode surfaces server functions page context enrichment (VC-1.3)', () => {
    const assembled = assembleAgentContext([], {
      ...agentModeBaseConfig,
      pageContext: {
        path: '/server-functions/edit/list-users',
        pageLabel: 'Server Functions',
        pageKey: 'server-functions',
        functionId: 'list-users',
        functionName: 'List Users',
      },
    });
    expect(assembled.systemPrompt).toContain('Server Functions workspace');
    expect(assembled.systemPrompt).toContain('list-users');
    expect(assembled.systemPrompt).toContain('get_server_function');
  });

  it('agent mode switches to WF-2 when user asks for UI on server-functions page', () => {
    const assembled = assembleAgentContext(
      [{ role: 'user', content: 'Build a user interface' }],
      {
        ...agentModeBaseConfig,
        pageContext: {
          path: '/server-functions',
          pageLabel: 'Server Functions',
          pageKey: 'server-functions',
          functionId: 'math.sum-two-numbers',
        },
      },
    );
    expect(assembled.systemPrompt).toContain('WF-2');
    expect(assembled.systemPrompt).toContain('vibe-crud');
    expect(assembled.systemPrompt).toContain('draft_component_layout');
    expect(assembled.systemPrompt).toContain('Do NOT call draft_server_function again');
  });

  it('agent mode includes active vibe workflow block from page context (VC-6.1)', () => {
    const assembled = assembleAgentContext([], {
      ...agentModeBaseConfig,
      pageContext: {
        path: '/client-components',
        pageLabel: 'Client Components',
        pageKey: 'client-components',
      },
    });
    expect(assembled.systemPrompt).toContain('## Active vibe workflow');
    expect(assembled.systemPrompt).toContain('WF-2');
    expect(assembled.systemPrompt).toContain('vibe-crud');
    expect(assembled.systemPrompt).toContain(VIBE_WORKFLOW_RULES);
    expect(assembled.systemPrompt).toContain('draft_application_scaffold');
  });
});
