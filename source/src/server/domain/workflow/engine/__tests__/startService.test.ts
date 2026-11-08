import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance, assertRevisionIsStartable } from '../startService';
import { baseModel, decisionNode, decisionEdge, decisionDefaultEdge, endNode, workflowInputPath, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!dbReady)('startService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const decisionModel = () =>
    baseModel({
      variables: [{ key: 'seenTotal', schema: { type: 'INLINE', schema: {} }, initialValue: workflowInputPath(['total']) }],
      nodes: [decisionNode('d1'), endNode('end-high'), endNode('end-low')],
      edges: [
        decisionEdge('e-high', 'd1', 'end-high', { op: 'GTE', left: workflowInputPath(['total']), right: lit(100_000_000) }),
        decisionDefaultEdge('e-low', 'd1', 'end-low'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });

  it('atomically materializes every node PENDING, readies only the start target, initializes variables, and commits CREATED -> RUNNING', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('start-basic'), draftDefinitionJson: JSON.stringify(decisionModel()) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('PUBLISHED');

    const { instance, nodeInstances } = await startWorkflowInstance({
      workflowRevisionId: revision.id,
      input: { total: 145_000_000 },
      startedByType: 'USER',
      startedById: 1,
    });

    expect(instance.status).toBe('RUNNING');
    expect(JSON.parse(instance.contextJson!)).toEqual({ seenTotal: 145_000_000 });
    expect(JSON.parse(instance.inputJson!)).toEqual({ total: 145_000_000 });

    expect(nodeInstances).toHaveLength(3);
    const byKey = Object.fromEntries(nodeInstances.map((n) => [n.semanticNodeKey, n]));
    expect(byKey['d1'].status).toBe('READY');
    expect(byKey['end-high'].status).toBe('PENDING');
    expect(byKey['end-low'].status).toBe('PENDING');
  });

  it('rejects starting a non-startable revision (REJECTED)', async () => {
    const invalidModel = baseModel({
      nodes: [endNode('end-1')],
      edges: [{ key: 'e1', fromNodeKey: 'ghost', toNodeKey: 'end-1', selector: { type: 'UNCONDITIONAL' } }],
    });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('start-invalid'), draftDefinitionJson: JSON.stringify(invalidModel) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('REJECTED');
    expect(() => assertRevisionIsStartable(revision)).toThrow(expect.objectContaining({ code: 'WF_DEF_NOT_STARTABLE' }));
    await expect(startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER' })).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
  });

  it('rejects starting a revision that does not exist', async () => {
    await expect(startWorkflowInstance({ workflowRevisionId: 999_999_999, input: {}, startedByType: 'USER' })).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
  });

  // doc 05 section 30 — "the derived value is validated against WorkflowModel.inputSchema before
  // instance creation." Closed via the real ajv-backed validateAgainstJsonSchema (added after
  // Slice 3's original "no validator exists" finding) rather than only checking "is JSON".
  const inputSchemaModel = () =>
    baseModel({
      nodes: [endNode('end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'end-1' },
      inputSchema: { type: 'INLINE', schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number' } } } },
    });

  it('rejects Start when input violates WorkflowModel.inputSchema', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('start-schema-invalid'), draftDefinitionJson: JSON.stringify(inputSchemaModel()) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('PUBLISHED');

    await expect(
      startWorkflowInstance({ workflowRevisionId: revision.id, input: { amount: 'not-a-number' }, startedByType: 'USER' }),
    ).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE', details: expect.objectContaining({ schemaViolations: expect.any(Array) }) });

    await expect(
      startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER' }),
    ).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
  });

  it('accepts Start when input satisfies WorkflowModel.inputSchema', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('start-schema-valid'), draftDefinitionJson: JSON.stringify(inputSchemaModel()) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { amount: 42 }, startedByType: 'USER' });
    expect(instance.status).toBe('RUNNING');
  });
});
