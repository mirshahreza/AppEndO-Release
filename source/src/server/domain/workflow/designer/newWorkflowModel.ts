import type { WorkflowModel } from '../awm/types';

/**
 * Minimal valid canonical AWM V1 seed for `WorkflowDefinitionService.CreateDefinition` (doc 02
 * section 13) — one END node as the MANUAL_API start target, empty variables/edges, and the same
 * default policy limits `publication/__tests__/fixtures.ts::baseModel` already uses across every
 * other slice's tests (kept in sync deliberately, not copy-pasted from a different source of
 * truth).
 */
export function buildEmptyWorkflowModel(key: string, name: string): WorkflowModel {
  return {
    schemaVersion: '1',
    key,
    name,
    inputSchema: { type: 'INLINE', schema: {} },
    outputSchema: { type: 'INLINE', schema: {} },
    variables: [],
    start: { type: 'MANUAL_API', targetNodeKey: 'end' },
    nodes: [{ kind: 'END', key: 'end', output: { type: 'OBJECT', fields: {} } }],
    edges: [],
    policies: {
      recoveryDetectionBoundMs: 60_000,
      limits: {
        maxNodes: 200,
        maxEdges: 400,
        maxPayloadBytes: 1_000_000,
        maxJsonDepth: 30,
        maxExpressionNodes: 500,
        maxStructuralPathCandidates: 1000,
        maxDelayMs: 86_400_000,
        maxWaitTimeoutMs: 86_400_000,
        maxWorkItemTitleLength: 200,
      },
    },
  };
}
