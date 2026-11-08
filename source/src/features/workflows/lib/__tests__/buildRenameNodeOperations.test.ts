import { describe, expect, it } from 'vitest';
import { buildRenameNodeOperations, validateRenameNodeKey } from '../buildRenameNodeOperations';
import type { WorkflowModel } from '../../types';

const baseModel: WorkflowModel = {
  schemaVersion: '1',
  key: 'wf',
  name: 'Workflow',
  start: { type: 'NODE', targetNodeKey: 'action-1' },
  nodes: [
    {
      kind: 'ACTION',
      key: 'action-1',
      actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
      config: { type: 'OBJECT', fields: {} },
      input: { type: 'OBJECT', fields: {} },
    },
    {
      kind: 'END',
      key: 'end-1',
      output: {
        type: 'OBJECT',
        fields: {
          text: {
            expression: {
              op: 'PATH',
              path: {
                root: { type: 'NODE_OUTPUT', nodeKey: 'action-1' },
                segments: ['output'],
              },
            },
          },
        },
      },
    },
  ],
  edges: [{ key: 'edge-1', fromNodeKey: 'action-1', toNodeKey: 'end-1', selector: { type: 'UNCONDITIONAL' } }],
  variables: [],
  policies: {},
  inputSchema: {},
  outputSchema: {},
};

describe('buildRenameNodeOperations', () => {
  it('rejects duplicate keys', () => {
    expect(validateRenameNodeKey(baseModel, 'action-1', 'end-1')).toMatch(/already exists/i);
  });

  it('builds add/modify-edge/modify-node/remove operations', () => {
    const operations = buildRenameNodeOperations(baseModel, 'action-1', 'send-email');
    const types = operations.map((op) => (op as { type: string }).type);
    expect(types).toEqual(['MODIFY_NODE', 'ADD_NODE', 'MODIFY_EDGE', 'CHANGE_START', 'REMOVE_NODE']);

    const endReplacement = operations[0] as { replacement: WorkflowModel['nodes'][number] };
    const outputField = endReplacement.replacement.output as {
      fields: { text: { expression: { path: { root: { nodeKey: string } } } } };
    };
    expect(outputField.fields.text.expression.path.root.nodeKey).toBe('send-email');

    const added = operations[1] as { node: { key: string } };
    expect(added.node.key).toBe('send-email');

    const edgeReplacement = operations[2] as { replacement: { fromNodeKey: string } };
    expect(edgeReplacement.replacement.fromNodeKey).toBe('send-email');

    const startChange = operations[3] as { start: { targetNodeKey: string } };
    expect(startChange.start.targetNodeKey).toBe('send-email');
  });
});
