import { describe, expect, it } from 'vitest';
import { createServerFunctionAgentApplyCollector } from '../lib/serverFunctionAiAgentApply';

describe('createServerFunctionAgentApplyCollector', () => {
  it('prefers function_source_patch proposal source over draft tool args', () => {
    const collector = createServerFunctionAgentApplyCollector();
    collector.ingest({
      type: 'tool_start',
      toolCallId: 't1',
      name: 'draft_server_function',
      args: { name: 'probe', source: 'edgeRes.json({ from: "tool" });' },
    });
    collector.ingest({
      type: 'proposal',
      proposalId: 'p1',
      changeSets: [{
        id: 'cs1',
        kind: 'function_source_patch',
        title: 'Function: probe',
        functionId: 'custom.probe',
        patch: { source: 'edgeRes.json({ from: "proposal" });' },
      }],
    });
    expect(collector.source()).toBe('edgeRes.json({ from: "proposal" });');
  });

  it('uses draft_server_function args when no proposal arrives', () => {
    const collector = createServerFunctionAgentApplyCollector();
    collector.ingest({
      type: 'tool_start',
      toolCallId: 't1',
      name: 'test_server_function',
      args: { source: 'edgeRes.json({ ignored: true });' },
    });
    collector.ingest({
      type: 'tool_start',
      toolCallId: 't2',
      name: 'draft_server_function',
      args: { name: 'probe', source: 'edgeRes.json({ ok: true });' },
    });
    expect(collector.source()).toBe('edgeRes.json({ ok: true });');
  });

  it('returns empty when the agent only chats', () => {
    const collector = createServerFunctionAgentApplyCollector();
    collector.ingest({ type: 'text_delta', text: 'I fixed the handler.' });
    expect(collector.source()).toBe('');
  });
});
