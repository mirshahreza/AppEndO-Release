import { describe, expect, it } from 'vitest';
import { repairToolMessageSequence, sliceAgentMessagesForContext } from '../toolMessageSequence';
import type { AgentMessage } from '../types';

describe('repairToolMessageSequence', () => {
  it('removes orphan tool messages without a preceding assistant tool_calls turn', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'Build function' },
      {
        role: 'tool',
        name: 'get_project_standards',
        content: '{"ok":false}',
        toolCallId: 'call-1',
      },
    ];

    expect(repairToolMessageSequence(messages)).toEqual([
      { role: 'user', content: 'Build function' },
    ]);
  });

  it('keeps valid assistant tool_calls + tool response pairs', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'Build function' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-1', name: 'get_project_standards', args: { shard: 'vibe-server-function' } }],
      },
      {
        role: 'tool',
        name: 'get_project_standards',
        content: '{"ok":true}',
        toolCallId: 'call-1',
      },
    ];

    expect(repairToolMessageSequence(messages)).toEqual(messages);
  });

  it('trims assistant tool_calls when a tool response was pruned', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'Explore' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-1', name: 'read_file', args: { path: 'a.ts' } },
          { id: 'call-2', name: 'read_file', args: { path: 'b.ts' } },
        ],
      },
      {
        role: 'tool',
        name: 'read_file',
        content: '{"ok":true,"summary":"same"}',
        toolCallId: 'call-1',
      },
    ];

    const repaired = repairToolMessageSequence(messages);
    expect(repaired).toHaveLength(3);
    expect(repaired[1]?.toolCalls).toEqual([
      { id: 'call-1', name: 'read_file', args: { path: 'a.ts' } },
    ]);
  });
});

describe('sliceAgentMessagesForContext', () => {
  it('does not start the tail slice on an orphan tool message', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'older' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-old', name: 'read_file', args: {} }],
      },
      {
        role: 'tool',
        name: 'read_file',
        content: '{"ok":true}',
        toolCallId: 'call-old',
      },
      { role: 'user', content: 'newer request' },
    ];

    const sliced = sliceAgentMessagesForContext(messages, 2);
    expect(sliced[0]?.role).not.toBe('tool');
    expect(sliced.some((message) => message.content === 'newer request')).toBe(true);
  });
});
