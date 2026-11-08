// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../api/workflowsApi', () => ({
  workflowsApi: {
    getReferenceCatalog: vi.fn().mockResolvedValue({
      descriptors: [{ type: 'NODE_OUTPUT', nodeKey: 'email1', label: 'email1.output' }],
    }),
  },
}));

import { NodeKindForm } from '../NodeKindForm';
import { buildOutputFieldsIndex } from '../actionCatalogUtils';
import type { ActionCatalogEntry } from '../actionCatalogUtils';
import type { WorkflowModel, WorkflowNode } from '../../types';

afterEach(cleanup);

/** Mirrors exactly what `communicationEmailSendDefinition` (corePack) now sends over the wire. */
const emailSendCatalogEntry: ActionCatalogEntry = {
  key: 'communication.email-send',
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass: 'WRITE_EXTERNAL',
  tags: ['communication', 'email'],
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: { to: { type: 'string' }, subject: { type: 'string' }, text: { type: 'string' } },
      required: ['to', 'subject', 'text'],
    },
  },
  outputSchema: {
    type: 'INLINE',
    schema: { type: 'object', properties: { delivered: { type: 'boolean' }, mode: { type: 'string' } } },
  },
};

const model: WorkflowModel = {
  schemaVersion: '1',
  key: 'wf',
  name: 'wf',
  start: { type: 'MANUAL_API', targetNodeKey: 'email1' },
  nodes: [
    { key: 'email1', kind: 'ACTION', actionRef: { action: { actionKey: 'communication.email-send', actionVersion: '1' } } },
  ],
  edges: [],
};

const downstreamNode: WorkflowNode = {
  key: 'action2',
  kind: 'ACTION',
  actionRef: { action: { actionKey: 'communication.email-send', actionVersion: '1' } },
  input: { type: 'OBJECT', fields: {} },
  config: { type: 'OBJECT', fields: {} },
};

describe('Reference picker — output field suggestions', () => {
  it('offers one-click field suggestions for an upstream ACTION node with a known outputSchema, and inserts a segmented reference', async () => {
    const getOutputFieldNames = (nodeKey: string) => buildOutputFieldsIndex(model, [emailSendCatalogEntry])[nodeKey] ?? [];

    render(
      <NodeKindForm
        node={downstreamNode}
        model={model}
        definitionId={1}
        actionCatalog={[emailSendCatalogEntry]}
        onChange={() => {}}
        getOutputFieldNames={getOutputFieldNames}
      />,
    );

    // "To" is the first declared inputSchema property, so it's the first rendered ExpressionField.
    const toField = screen.getAllByPlaceholderText('type @ for references…')[0] as HTMLInputElement;
    fireEvent.keyDown(toField, { key: '@' });

    // Wait for the mocked async getReferenceCatalog to resolve and the descriptor row to render.
    await screen.findByText('email1.output');

    const deliveredSuggestion = screen.getByTitle('Insert email1.output.delivered');
    expect(deliveredSuggestion).toBeInTheDocument();
    expect(screen.getByTitle('Insert email1.output.mode')).toBeInTheDocument();

    fireEvent.click(deliveredSuggestion);

    expect(toField.value).toBe('@NODE:email1.delivered');
  });
});
