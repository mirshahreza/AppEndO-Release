/**
 * @vitest-environment jsdom
 */
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NodeKindForm } from '../NodeKindForm';
import { INTERNAL_API_CALL_ACTION_KEY, type ActionCatalogEntry } from '../actionCatalogUtils';
import type { WorkflowModel, WorkflowNode } from '../../types';

vi.mock('../../../../shared/api/queries/server-functions', () => ({
  useServerFunctionsCatalogQuery: () => ({
    isLoading: false,
    data: {
      functions: [
        {
          id: 'math.sum-two-numbers',
          name: 'sum-two-numbers',
          folder: 'math',
          method: 'POST',
          path: '/api/math/sum-two-numbers',
          code: '',
          testPayload: '{"a":1,"b":2}',
          memoryLimit: 128,
          timeoutMs: 1500,
          runtimeVersion: 'v20.x',
          useGlobalConfig: true,
          enableLogs: false,
          accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
          metadataJson: {
            apiDoc: { summary: 'Add two numbers', description: 'Returns a + b.' },
          },
        },
      ],
    },
  }),
}));

afterEach(cleanup);

const catalogEntry: ActionCatalogEntry = {
  key: INTERNAL_API_CALL_ACTION_KEY,
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass: 'WRITE_EXTERNAL',
  tags: ['integration'],
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        functionId: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['functionId'],
    },
  },
};

const model: WorkflowModel = {
  schemaVersion: '1',
  key: 'wf',
  name: 'wf',
  start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
  nodes: [],
  edges: [],
};

const node: WorkflowNode = {
  key: 'a1',
  kind: 'ACTION',
  actionRef: { action: { actionKey: INTERNAL_API_CALL_ACTION_KEY, actionVersion: '1' } },
  input: { type: 'OBJECT', fields: {} },
  config: { type: 'OBJECT', fields: {} },
};

describe('Internal API call node form', () => {
  it('searches server functions and shows sample/docs helpers', () => {
    const Harness: React.FC = () => {
      const [current, setCurrent] = useState(node);
      return (
        <NodeKindForm
          node={current}
          model={model}
          definitionId={1}
          actionCatalog={[catalogEntry]}
          onChange={setCurrent}
        />
      );
    };

    render(<Harness />);

    expect(screen.getByLabelText('Search server functions')).toBeInTheDocument();
    expect(screen.getByText('math.sum-two-numbers')).toBeInTheDocument();
    expect(screen.getByText('Add two numbers')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /math\.sum-two-numbers/i }));

    expect(screen.getByText('Use sample payload')).toBeInTheDocument();
    expect(screen.getByText('Open documentation')).toBeInTheDocument();
    expect(screen.getByText('Returns a + b.')).toBeInTheDocument();
    expect(screen.getAllByText('POST /api/math/sum-two-numbers').length).toBeGreaterThan(0);
  });
});
