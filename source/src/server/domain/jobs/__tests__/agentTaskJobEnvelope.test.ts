import { describe, expect, it } from 'vitest';
import { buildAgentTaskJobPayload, parseAgentTaskJobPayload } from '../jobRepository';

describe('V5 P11 § V5-21 — agent task job envelope (build/parse)', () => {
  const baseInput = {
    taskId: 'task-1',
    attemptId: 'attempt-1',
    actorUserId: 42,
    mode: 'agent' as const,
    messages: [{ role: 'user' as const, content: 'implement the export feature' }],
    executionProfile: 'agent_implement',
    useEngineeringPipeline: true,
  };

  it('round-trips a real envelope through build → parse unchanged', () => {
    const payload = buildAgentTaskJobPayload(baseInput);
    const parsed = parseAgentTaskJobPayload(payload);

    expect(parsed).not.toBeNull();
    expect(parsed?.taskId).toBe('task-1');
    expect(parsed?.attemptId).toBe('attempt-1');
    expect(parsed?.actorUserId).toBe(42);
    expect(parsed?.mode).toBe('agent');
    expect(parsed?.messages).toEqual(baseInput.messages);
    expect(parsed?.useEngineeringPipeline).toBe(true);
  });

  it('rejects a payload missing taskId/attemptId/messages', () => {
    expect(parseAgentTaskJobPayload(JSON.stringify({ mode: 'agent' }))).toBeNull();
    expect(parseAgentTaskJobPayload(null)).toBeNull();
    expect(parseAgentTaskJobPayload('not json')).toBeNull();
  });

  it('defaults an invalid mode to "agent" rather than crashing', () => {
    const parsed = parseAgentTaskJobPayload(JSON.stringify({
      taskId: 't', attemptId: 'a', messages: [], mode: 'not-a-real-mode',
    }));
    expect(parsed?.mode).toBe('agent');
  });

  it('p-102 — round-trips sessionId + capability/MCP scope fields', () => {
    const payload = buildAgentTaskJobPayload({
      ...baseInput,
      sessionId: 123,
      enabledCapabilityPackIds: ['appendo-files', 'appendo-git'],
      enabledMcpServerIds: ['mcp-1'],
    });
    const parsed = parseAgentTaskJobPayload(payload);

    expect(parsed?.sessionId).toBe(123);
    expect(parsed?.enabledCapabilityPackIds).toEqual(['appendo-files', 'appendo-git']);
    expect(parsed?.enabledMcpServerIds).toEqual(['mcp-1']);
  });

  it('p-102 — omitting sessionId/scope fields leaves them undefined, not defaulted', () => {
    const payload = buildAgentTaskJobPayload(baseInput);
    const parsed = parseAgentTaskJobPayload(payload);

    expect(parsed?.sessionId).toBeUndefined();
    expect(parsed?.enabledCapabilityPackIds).toBeUndefined();
    expect(parsed?.enabledMcpServerIds).toBeUndefined();
  });
});
