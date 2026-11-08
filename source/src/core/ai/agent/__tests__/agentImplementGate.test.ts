import { describe, expect, it } from 'vitest';
import { AgentImplementGate } from '../agentImplementGate';
import { testAiPageContext } from './testAgentFixtures';

describe('AgentImplementGate', () => {
  it('does not treat server preload as retrieve satisfied — but never hard-blocks draft tools (p-61 Phase B)', () => {
    const gate = new AgentImplementGate(
      'agent_implement',
      testAiPageContext({ path: '/us/studio/server-functions/math/sum-two-numbers', functionId: 'math.sum-two-numbers' }),
      'Build UI for sum-two-numbers',
    );

    expect(gate.isRetrieveSatisfied()).toBe(false);
    // Retrieve guidance is advisory now: draft_* is allowed, the missing bundle is telemetry.
    expect(gate.checkPreToolUse('draft_server_function').allowed).toBe(true);
    expect(gate.getRetrieveAdvisory()).toContain('Retrieve bundle incomplete');
  });

  it('allows draft tools after agent retrieve tool calls', () => {
    const gate = new AgentImplementGate(
      'agent_implement',
      testAiPageContext({
        path: '/us/studio/server-functions/math/sum-two-numbers',
        pageKey: 'server-functions',
        functionId: 'math.sum-two-numbers',
      }),
      'Implement server function math.sum-two-numbers',
    );

    gate.recordToolResult('get_project_standards', { ok: true, summary: 'ok' }, { shard: 'vibe-server-function' });
    gate.recordToolResult('read_file', { ok: true, summary: 'ok' }, { path: 'src/foo.ts' });
    gate.recordToolResult('get_server_function', { ok: true, summary: 'ok' }, { functionId: 'math.sum-two-numbers' });

    expect(gate.isRetrieveSatisfied()).toBe(true);
    expect(gate.checkPreToolUse('draft_component_layout').allowed).toBe(true);
  });

  it('is inactive for agent_lookup profile', () => {
    const gate = new AgentImplementGate('agent_lookup', undefined, 'Where is AppTableGrid defined?');
    expect(gate.isActive()).toBe(false);
    expect(gate.checkPreToolUse('draft_file_patch').allowed).toBe(true);
  });

  it('blocks draft tools in agent_plan_review profile (C.3)', () => {
    const gate = new AgentImplementGate('agent_plan_review', undefined, 'Just review what changes are needed');
    expect(gate.isActive()).toBe(false);
    expect(gate.checkPreToolUse('draft_file_patch').allowed).toBe(false);
    expect(gate.checkPreToolUse('read_file').allowed).toBe(true);
  });
});
