import { describe, expect, it } from 'vitest';
import {
  workflowDefinitionLifecycleSchema,
  workflowCreationModeSchema,
  publicationStatusSchema,
  bindingStatusSchema,
  workflowInstanceStatusSchema,
  workflowNodeInstanceStatusSchema,
  workflowExecutionAttemptStatusSchema,
  workflowWaitStatusSchema,
  workflowWaitTypeSchema,
  workflowEventInboxStatusSchema,
  workItemStatusSchema,
  workItemEscalationStatusSchema,
  workflowBranchTokenStatusSchema,
  workflowSimulationRunStatusSchema,
  workflowSimulationModeSchema,
  workflowValidationStatusSchema,
  workflowActorTypeSchema,
  workflowTraceTypeSchema,
  createWorkflowDefinitionInputSchema,
  createWorkflowSimulationRunInputSchema,
  createWorkflowDesignerViewInputSchema,
} from '../schemas';
import { WORKFLOW_TRACE_TYPES } from '../traceTypes';

describe('Zod enum <-> TS union single-source-of-truth checks', () => {
  it.each([
    ['workflowDefinitionLifecycleSchema', workflowDefinitionLifecycleSchema, ['DRAFT', 'ACTIVE', 'DISABLED', 'ARCHIVED']],
    ['workflowCreationModeSchema', workflowCreationModeSchema, ['NEW', 'DUPLICATE', 'TEMPLATE', 'IMPORT']],
    ['publicationStatusSchema', publicationStatusSchema, ['VALIDATING', 'ACTIVATING_BINDING', 'PUBLISHED', 'REJECTED']],
    ['bindingStatusSchema', bindingStatusSchema, ['NOT_REQUIRED', 'PENDING', 'ACTIVE', 'FAILED', 'INACTIVE']],
    ['workflowInstanceStatusSchema', workflowInstanceStatusSchema, ['CREATED', 'RUNNING', 'SUSPENDED', 'SUCCEEDED', 'FAILED', 'CANCELLED']],
    [
      'workflowNodeInstanceStatusSchema',
      workflowNodeInstanceStatusSchema,
      ['PENDING', 'READY', 'RUNNING', 'WAITING', 'WAITING_HUMAN', 'RETRYING', 'COMPENSATING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'COMPENSATED'],
    ],
    ['workflowExecutionAttemptStatusSchema', workflowExecutionAttemptStatusSchema, ['STARTED', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'UNKNOWN', 'CANCELLED']],
    ['workflowWaitStatusSchema', workflowWaitStatusSchema, ['ACTIVE', 'SATISFIED', 'CANCELLED', 'EXPIRED']],
    ['workflowWaitTypeSchema', workflowWaitTypeSchema, ['TIMER', 'EVENT', 'HUMAN', 'SUBFLOW']],
    ['workflowEventInboxStatusSchema', workflowEventInboxStatusSchema, ['RECEIVED', 'CORRELATED', 'UNMATCHED', 'REJECTED']],
    ['workItemStatusSchema', workItemStatusSchema, ['OPEN', 'CLAIMED', 'COMPLETED', 'CANCELLED', 'FAILED']],
    ['workItemEscalationStatusSchema', workItemEscalationStatusSchema, ['STARTED', 'SUCCEEDED', 'FAILED']],
    ['workflowBranchTokenStatusSchema', workflowBranchTokenStatusSchema, ['ACTIVE', 'ARRIVED', 'FAILED', 'CANCELLED']],
    ['workflowSimulationRunStatusSchema', workflowSimulationRunStatusSchema, ['RUNNING', 'SUCCEEDED', 'FAILED']],
    ['workflowSimulationModeSchema', workflowSimulationModeSchema, ['FULL', 'NODE', 'FROM_NODE']],
    ['workflowValidationStatusSchema', workflowValidationStatusSchema, ['PASSED', 'FAILED']],
    ['workflowActorTypeSchema', workflowActorTypeSchema, ['USER', 'SYSTEM', 'WORKFLOW', 'EXTERNAL_CONSUMER']],
    ['workflowTraceTypeSchema', workflowTraceTypeSchema, [...WORKFLOW_TRACE_TYPES]],
  ] as const)('%s options exactly match its TS union', (_name, schema, expectedValues) => {
    expect(new Set(schema.options)).toEqual(new Set(expectedValues));
    expect(schema.options).toHaveLength(expectedValues.length);
  });
});

describe('createWorkflowDefinitionInputSchema', () => {
  it('accepts a valid minimal input and defaults scopeKey/creationMode', () => {
    const parsed = createWorkflowDefinitionInputSchema.parse({ key: 'invoice-approval', draftDefinitionJson: '{}' });
    expect(parsed.scopeKey).toBe('global');
    expect(parsed.creationMode).toBe('NEW');
  });

  it('rejects an empty key', () => {
    expect(() => createWorkflowDefinitionInputSchema.parse({ key: '', draftDefinitionJson: '{}' })).toThrow();
  });
});

describe('createWorkflowSimulationRunInputSchema (shape only — XOR is a repository-level WorkflowDomainError, see workflowSimulationRunRepository.test.ts)', () => {
  const base = {
    workflowDefinitionId: 1,
    simulationResolvedSnapshotFingerprint: 'fp',
    mode: 'FULL' as const,
    fixtureSetFingerprint: 'fixture-fp',
    createdByType: 'USER' as const,
  };

  it('accepts a shape-valid input regardless of source-field combination (XOR is not a Zod concern here)', () => {
    expect(() => createWorkflowSimulationRunInputSchema.parse({ ...base, sourceDraftVersion: 3 })).not.toThrow();
    expect(() => createWorkflowSimulationRunInputSchema.parse({ ...base, sourceRevisionId: 7 })).not.toThrow();
  });

  it('rejects a shape violation (invalid mode)', () => {
    expect(() => createWorkflowSimulationRunInputSchema.parse({ ...base, sourceDraftVersion: 3, mode: 'NOT_A_MODE' })).toThrow();
  });
});

describe('createWorkflowDesignerViewInputSchema (shape only — XOR is a repository-level WorkflowDomainError, see workflowDesignerViewRepository.test.ts)', () => {
  const base = { workflowDefinitionId: 1, viewJson: '{}' };

  it('accepts a shape-valid input regardless of binding-field combination (XOR is not a Zod concern here)', () => {
    expect(() => createWorkflowDesignerViewInputSchema.parse({ ...base, draftVersion: 2 })).not.toThrow();
    expect(() => createWorkflowDesignerViewInputSchema.parse({ ...base, workflowRevisionId: 9 })).not.toThrow();
  });

  it('rejects a shape violation (missing required viewJson)', () => {
    expect(() => createWorkflowDesignerViewInputSchema.parse({ workflowDefinitionId: 1, draftVersion: 2 })).toThrow();
  });
});
