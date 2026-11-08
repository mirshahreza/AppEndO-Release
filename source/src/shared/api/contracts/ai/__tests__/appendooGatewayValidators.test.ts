import { describe, expect, it } from 'vitest';
import { normalizeAgentStreamEvent } from '../agentValidators';

describe('request_routing stream event', () => {
  it('normalizes a valid request_routing event', () => {
    const event = normalizeAgentStreamEvent({
      type: 'request_routing',
      requestClass: 'ENGINEERING_CHANGE',
      taskProfile: 'INTENT_COMPILE',
      routerVersion: '1.0.0',
      routingReason: 'Agent mode with implementation intent',
      useEngineeringPipeline: true,
    });

    expect(event).toEqual({
      type: 'request_routing',
      requestClass: 'ENGINEERING_CHANGE',
      taskProfile: 'INTENT_COMPILE',
      routerVersion: '1.0.0',
      routingReason: 'Agent mode with implementation intent',
      useEngineeringPipeline: true,
    });
  });
});

describe('engineering_pipeline stream event', () => {
  it('normalizes a valid engineering_pipeline event', () => {
    const event = normalizeAgentStreamEvent({
      type: 'engineering_pipeline',
      planId: 'asp:demo:1',
      planRevision: 1,
      planObjective: 'Add users export',
      artifactCount: 2,
      capabilityGapCount: 0,
      changeGraphId: 'cg:demo:1',
      changeNodeCount: 2,
      contextPackRevision: 1,
      approvalBindingId: 'asp-approval:demo:1',
      approvalStatus: 'pending',
      workspaceId: 'ws:demo:1',
      revisionId: 'rev:demo:1',
      executedNodeCount: 0,
      failedNodeCount: 0,
      reconciledNodeCount: 0,
      requiresApproval: true,
    });

    expect(event.type).toBe('engineering_pipeline');
    if (event.type !== 'engineering_pipeline') {
      throw new Error('expected engineering_pipeline event');
    }
    expect(event.planId).toBe('asp:demo:1');
    expect(event.approvalStatus).toBe('pending');
    expect(event.executedNodeCount).toBe(0);
  });

  it('normalizes package snapshot and activation telemetry fields', () => {
    const event = normalizeAgentStreamEvent({
      type: 'engineering_pipeline',
      planId: 'asp:demo:2',
      planRevision: 1,
      planObjective: 'Deploy export',
      artifactCount: 1,
      capabilityGapCount: 0,
      changeGraphId: 'cg:demo:2',
      changeNodeCount: 1,
      verificationRunId: 'verify:demo:2',
      deployable: true,
      promotionState: 'DEPLOYED',
      packageSnapshotId: 'pkg-snap:demo:2',
      packageRoundtripValidated: true,
      runtimeActivatedCount: 1,
      checkpointId: 'cg:demo:2:123',
      executedNodeCount: 1,
      failedNodeCount: 0,
      requiresApproval: true,
    });

    expect(event.type).toBe('engineering_pipeline');
    if (event.type !== 'engineering_pipeline') {
      throw new Error('expected engineering_pipeline event');
    }
    expect(event.packageSnapshotId).toBe('pkg-snap:demo:2');
    expect(event.packageRoundtripValidated).toBe(true);
    expect(event.runtimeActivatedCount).toBe(1);
    expect(event.checkpointId).toBe('cg:demo:2:123');
  });
});
