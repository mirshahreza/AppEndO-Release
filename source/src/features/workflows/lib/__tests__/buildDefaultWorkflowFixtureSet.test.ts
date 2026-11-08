import { describe, expect, it } from 'vitest';
import { buildDefaultWorkflowFixtureSet } from '../buildDefaultWorkflowFixtureSet';
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

describe('buildDefaultWorkflowFixtureSet', () => {
  it('adds WORK_ITEM_RESOLUTION using the first allowed outcome', () => {
    const model = baseModel({
      nodes: [{
        kind: 'WORK_ITEM',
        key: 'manager-approval',
        allowedOutcomes: ['APPROVE', 'REJECT'],
      }],
    });

    expect(buildDefaultWorkflowFixtureSet(model, [])).toEqual({
      fixtures: {
        'manager-approval': {
          kind: 'WORK_ITEM_RESOLUTION',
          outcomeKey: 'APPROVE',
          output: {},
        },
      },
    });
  });

  it('skips PURE actions that can execute live', () => {
    const model = baseModel({
      nodes: [{
        kind: 'ACTION',
        key: 'notify',
        actionRef: {
          action: { actionKey: 'text.template', actionVersion: '1' },
        },
      }],
    });

    expect(buildDefaultWorkflowFixtureSet(model, [{
      key: 'text.template',
      version: '1',
      availability: 'AVAILABLE',
      sideEffectClass: 'PURE',
      secretReferenceFields: [],
    }])).toEqual({ fixtures: {} });
  });
});
