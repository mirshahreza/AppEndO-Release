import { describe, expect, it } from 'vitest';
import { AgentContextMemory } from '../contextMemory';
import type { AgentMessage } from '../types';
import {
  ReactOrchestrationPolicy,
  UtilityGuidedOrchestrationPolicy,
  createOrchestrationPolicy,
} from '../orchestrationPolicy';

describe('UtilityGuidedOrchestrationPolicy', () => {
  it('stops when utility threshold is reached after many iterations', () => {
    const policy = new UtilityGuidedOrchestrationPolicy();
    const decision = policy.decide({
      iteration: 9,
      maxIterations: 10,
      hasToolCalls: true,
      recentInvocations: [
        { tool: 'glob_files', argsHash: 'a', iteration: 7 },
        { tool: 'glob_files', argsHash: 'a', iteration: 8 },
        { tool: 'search_codebase', argsHash: 'b', iteration: 9 },
      ],
    });

    expect(decision.action).toBe('stop');
    expect(decision.reason).toBe('utility_threshold_reached');
  });

  it('factory returns react policy by default', () => {
    expect(createOrchestrationPolicy('react')).toBeInstanceOf(ReactOrchestrationPolicy);
    expect(createOrchestrationPolicy('utility-guided')).toBeInstanceOf(UtilityGuidedOrchestrationPolicy);
  });
});

describe('AgentContextMemory', () => {
  it('summarizes older messages and keeps recent tail', () => {
    const messages: AgentMessage[] = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message-${index}`,
    }));

    const memory = new AgentContextMemory(messages);
    const result = memory.summarizeHistory();

    expect(result.ok).toBe(true);
    expect(result.prunedCount).toBeGreaterThan(0);
    expect(messages.length).toBeLessThan(10);
    expect(messages[0]?.content).toContain('[Earlier conversation summary]');
  });

  it('prunes duplicate tool observations and repairs dangling tool_calls', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'Find grid rules' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-1', name: 'read_file', args: { path: 'a.ts' } },
          { id: 'call-2', name: 'read_file', args: { path: 'a.ts' } },
        ],
      },
      {
        role: 'tool',
        name: 'read_file',
        content: '{"ok":true,"summary":"same"}',
        toolCallId: 'call-1',
      },
      {
        role: 'tool',
        name: 'read_file',
        content: '{"ok":true,"summary":"same"}',
        toolCallId: 'call-2',
      },
    ];

    const memory = new AgentContextMemory(messages);
    const result = memory.pruneDuplicateToolObservations();

    expect(result.ok).toBe(true);
    expect(result.prunedCount).toBe(1);
    expect(messages.filter((message) => message.role === 'tool')).toHaveLength(1);
    expect(messages[1]?.toolCalls).toHaveLength(1);
  });

  it('prunes stale tool turns beyond maxTurns', () => {
    const messages: AgentMessage[] = [{ role: 'user', content: 'Explore' }];

    for (let turn = 0; turn < 6; turn += 1) {
      messages.push({
        role: 'assistant',
        content: '',
        toolCalls: [{ id: `call-${turn}`, name: 'read_file', args: { path: `src/file-${turn}.ts` } }],
      });
      messages.push({
        role: 'tool',
        name: 'read_file',
        content: `{"ok":true,"summary":"turn-${turn}"}`,
        toolCallId: `call-${turn}`,
      });
    }

    const memory = new AgentContextMemory(messages);
    const result = memory.pruneStaleToolObservations(4);

    expect(result.ok).toBe(true);
    expect(result.prunedCount).toBe(2);
    expect(messages.filter((message) => message.role === 'tool')).toHaveLength(4);
    expect(messages.some((message) => message.content.includes('turn-0'))).toBe(false);
    expect(messages.some((message) => message.content.includes('turn-5'))).toBe(true);
  });

  it('auto-prune combines stale and duplicate removal', () => {
    const duplicateObservation = '{"ok":true,"summary":"same-path","dataPreview":{"path":"src/a.ts"}}';
    const messages: AgentMessage[] = [{ role: 'user', content: 'Loop' }];

    for (let turn = 0; turn < 5; turn += 1) {
      messages.push({
        role: 'assistant',
        content: '',
        toolCalls: [{ id: `call-a-${turn}`, name: 'read_file', args: { path: 'src/a.ts' } }],
      });
      messages.push({
        role: 'tool',
        name: 'read_file',
        content: duplicateObservation,
        toolCallId: `call-a-${turn}`,
      });
      messages.push({
        role: 'assistant',
        content: '',
        toolCalls: [{ id: `call-b-${turn}`, name: 'read_file', args: { path: `src/b-${turn}.ts` } }],
      });
      messages.push({
        role: 'tool',
        name: 'read_file',
        content: `{"ok":true,"summary":"unique-${turn}"}`,
        toolCallId: `call-b-${turn}`,
      });
    }

    const memory = new AgentContextMemory(messages);
    const result = memory.autoPruneToolObservations(2);

    expect(result.ok).toBe(true);
    expect(result.prunedCount).toBeGreaterThan(0);
    expect(messages.filter((message) => message.role === 'tool').length).toBeLessThanOrEqual(4);
  });
});
