import { AgentImplementGate } from '../../../core/ai/agent/agentImplementGate';
import { routeAssistantRequest } from '../../../server/domain/ai/assistantRequestRouter';
import { formatAgentActivityLabel } from './agentActivityLabels';

export const GE_AGENT_WF4_001_SCENARIO_ID = 'GE-AGENT-WF4-001';
export const GE_AGENT_RETRIEVE_001_SCENARIO_ID = 'GE-AGENT-RETRIEVE-001';
export const GE_UX_ACTIVITY_001_SCENARIO_ID = 'GE-UX-ACTIVITY-001';

export const GE_AGENT_WF4_001_PROMPT = 'Build a simple two-input form for math.sum-two-numbers';

export type GoldenAgentLoopEvalResult = {
  scenarioId: string;
  passed: boolean;
  failures: string[];
};

export const evaluateGeAgentWf4_001 = (): GoldenAgentLoopEvalResult => {
  const failures: string[] = [];
  const routing = routeAssistantRequest({
    mode: 'agent',
    userPrompt: GE_AGENT_WF4_001_PROMPT,
    executionProfile: 'agent_implement',
  });

  if (routing.useEngineeringPipeline) {
    failures.push('Expected direct agent-loop — engineering pipeline must stay off for normal implement.');
  }
  if (routing.taskProfile !== 'TOOL_SESSION') {
    failures.push(`Expected TOOL_SESSION task profile, got ${routing.taskProfile}.`);
  }

  return {
    scenarioId: GE_AGENT_WF4_001_SCENARIO_ID,
    passed: failures.length === 0,
    failures,
  };
};

/**
 * p-61 Phase B — the retrieve bundle is advisory now: the gate must never deny draft_* calls,
 * and the missing-bundle signal must be visible for telemetry until retrieve tools run.
 */
export const evaluateGeAgentRetrieve_001 = (): GoldenAgentLoopEvalResult => {
  const failures: string[] = [];
  const gate = new AgentImplementGate(
    'agent_implement',
    {
      path: '/us/studio/server-functions/math/sum-two-numbers',
      pageKey: 'server-functions',
      functionId: 'math.sum-two-numbers',
    },
    'Implement server function math.sum-two-numbers',
  );

  if (gate.isRetrieveSatisfied()) {
    failures.push('Retrieve must not be satisfied before agent tool calls (GAP-9).');
  }
  if (!gate.checkPreToolUse('draft_component_layout').allowed) {
    failures.push('draft_* must never be hard-blocked by the retrieve gate (p-61 Phase B).');
  }
  if (!gate.getRetrieveAdvisory()) {
    failures.push('Retrieve advisory must report the missing bundle before retrieve tools run.');
  }

  gate.recordToolResult('get_project_standards', { ok: true, summary: 'ok' }, { shard: 'vibe-server-function' });
  gate.recordToolResult('read_file', { ok: true, summary: 'ok' }, { path: 'src/foo.ts' });
  gate.recordToolResult('get_server_function', { ok: true, summary: 'ok' }, { functionId: 'math.sum-two-numbers' });
  if (!gate.checkPreToolUse('draft_component_layout').allowed) {
    failures.push('draft_* should be allowed after get_server_function retrieve.');
  }
  if (gate.getRetrieveAdvisory() !== null) {
    failures.push('Retrieve advisory should clear after the bundle is satisfied.');
  }

  return {
    scenarioId: GE_AGENT_RETRIEVE_001_SCENARIO_ID,
    passed: failures.length === 0,
    failures,
  };
};

export const evaluateGeUxActivity_001 = (): GoldenAgentLoopEvalResult => {
  const failures: string[] = [];
  const retrieveLabel = formatAgentActivityLabel(
    'get_server_function',
    { functionId: 'math.sum-two-numbers' },
    'fa',
  );
  const searchLabel = formatAgentActivityLabel(
    'search_codebase',
    { query: 'SumTwoNumbers' },
    'fa',
  );

  if (!retrieveLabel.title.includes('math.sum-two-numbers')) {
    failures.push('Activity label must surface retrieve target (functionId).');
  }
  if (!searchLabel.title.includes('SumTwoNumbers')) {
    failures.push('Activity label must surface search query.');
  }
  if (!retrieveLabel.intention?.trim()) {
    failures.push('Activity label must include intention (F.2).');
  }

  return {
    scenarioId: GE_UX_ACTIVITY_001_SCENARIO_ID,
    passed: failures.length === 0,
    failures,
  };
};

export const evaluateAllV4AgentLoopGoldenScenarios = (): GoldenAgentLoopEvalResult[] => ([
  evaluateGeAgentWf4_001(),
  evaluateGeAgentRetrieve_001(),
  evaluateGeUxActivity_001(),
]);
