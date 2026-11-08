import { describe, expect, it } from 'vitest';
import { buildDefaultWorkflowInputJson } from '../buildDefaultWorkflowInput';
import type { WorkflowModel } from '../../types';

const baseModel = (overrides: Partial<WorkflowModel> = {}): WorkflowModel => ({
  schemaVersion: '1',
  key: 'sample',
  name: 'Sample',
  inputSchema: { type: 'INLINE', schema: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  variables: [],
  start: { type: 'MANUAL_API', targetNodeKey: 'end' },
  nodes: [{ kind: 'END', key: 'end', output: { type: 'OBJECT', fields: {} } }],
  edges: [],
  policies: { limits: {} },
  ...overrides,
});

describe('buildDefaultWorkflowInputJson', () => {
  it('returns an empty object for workflows without input references', () => {
    expect(buildDefaultWorkflowInputJson(baseModel())).toBe('{}');
  });

  it('seeds placeholders for workflow input paths referenced in the model', () => {
    const model = baseModel({
      nodes: [{
        kind: 'ACTION',
        key: 'a1',
        actionRef: {},
        config: { type: 'OBJECT', fields: {} },
        input: {
          type: 'OBJECT',
          fields: {
            amount: {
              type: 'EXPRESSION',
              expression: { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: ['amount'] } },
            },
          },
        },
      }],
    });

    expect(JSON.parse(buildDefaultWorkflowInputJson(model))).toEqual({ amount: 0 });
  });
});
