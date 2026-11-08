import { describe, expect, it } from 'vitest';
import { shouldBuildEngineeringContextPack, classifyAgentExecutionPath } from '../engineeringPipelineAgentRun';

/**
 * V5 Phase P08 § V5-12 — characterization tests for the routing decisions extracted from
 * `agent.service.ts`'s previously-inline conditions. `agent.service.ts`'s `runStream` had ZERO
 * direct test coverage of this branch-selection logic before this phase (confirmed by direct
 * inspection of `agent.service.test.ts`'s 5 test cases, none of which exercise it) — these tests
 * close that gap for the extracted, now-independently-callable pieces.
 */
describe('V5 P08 — shouldBuildEngineeringContextPack (extracted from agent.service.ts)', () => {
  it('builds a context pack for ENGINEERING_CHANGE when useEngineeringPipeline is true', () => {
    expect(shouldBuildEngineeringContextPack({ useEngineeringPipeline: true, requestClass: 'ENGINEERING_CHANGE' })).toBe(true);
  });
  it('builds a context pack for ENGINEERING_QUERY and CONTEXT_QUERY too', () => {
    expect(shouldBuildEngineeringContextPack({ useEngineeringPipeline: true, requestClass: 'ENGINEERING_QUERY' })).toBe(true);
    expect(shouldBuildEngineeringContextPack({ useEngineeringPipeline: true, requestClass: 'CONTEXT_QUERY' })).toBe(true);
  });
  it('does not build a context pack when useEngineeringPipeline is false, regardless of requestClass', () => {
    expect(shouldBuildEngineeringContextPack({ useEngineeringPipeline: false, requestClass: 'ENGINEERING_CHANGE' })).toBe(false);
  });
  it('does not build a context pack for a non-engineering requestClass even with useEngineeringPipeline true', () => {
    expect(shouldBuildEngineeringContextPack({ useEngineeringPipeline: true, requestClass: 'CONVERSATION' })).toBe(false);
    expect(shouldBuildEngineeringContextPack({ useEngineeringPipeline: true, requestClass: 'OPERATIONAL_ACTION' })).toBe(false);
    expect(shouldBuildEngineeringContextPack({ useEngineeringPipeline: true, requestClass: 'TOOL_QUERY' })).toBe(false);
  });
});

describe('V5 P08 — classifyAgentExecutionPath', () => {
  const base = {
    shouldBuildContextPack: true,
    contextPackBuilt: true,
    useEngineeringPipeline: true,
    shouldAutoExecutePipeline: true,
    pipelineAutoExecuted: false,
  };

  it('PIPELINE_AUTO_EXECUTED when auto-execute was requested and succeeded', () => {
    expect(classifyAgentExecutionPath({ ...base, pipelineAutoExecuted: true })).toBe('PIPELINE_AUTO_EXECUTED');
  });

  it('PIPELINE_NEEDS_MORE_CONTEXT when auto-execute was requested but the plan cannot approve', () => {
    expect(classifyAgentExecutionPath({ ...base, pipelineCanApprove: false })).toBe('PIPELINE_NEEDS_MORE_CONTEXT');
  });

  it('PIPELINE_SCAFFOLD_AWAITING_APPROVAL when the pipeline ran but auto-execute was not requested', () => {
    expect(classifyAgentExecutionPath({ ...base, shouldAutoExecutePipeline: false })).toBe('PIPELINE_SCAFFOLD_AWAITING_APPROVAL');
  });

  it('AGENT_LOOP when the pipeline never ran at all (useEngineeringPipeline false)', () => {
    expect(classifyAgentExecutionPath({ ...base, useEngineeringPipeline: false, pipelineAutoExecuted: false })).toBe('AGENT_LOOP');
  });

  it('AGENT_LOOP when shouldBuildContextPack was false (e.g. ask mode)', () => {
    expect(classifyAgentExecutionPath({ ...base, shouldBuildContextPack: false, pipelineAutoExecuted: false })).toBe('AGENT_LOOP');
  });
});
