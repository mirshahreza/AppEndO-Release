// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NodeKindForm } from '../NodeKindForm';
import type { ActionCatalogEntry } from '../actionCatalogUtils';
import type { WorkflowModel, WorkflowNode, WorkflowSecretReference } from '../../types';

afterEach(cleanup);

/** Mirrors exactly what `integrationHttpRequestDefinition` (corePack) now sends over the wire —
 * `config.headers` is its one real `secretReferenceFields` entry. */
const httpRequestCatalogEntry: ActionCatalogEntry = {
  key: 'integration.http-request',
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass: 'WRITE_EXTERNAL',
  tags: ['integration', 'http'],
  secretReferenceFields: ['config.headers'],
  configSchema: {
    type: 'INLINE',
    schema: { type: 'object', properties: { headers: { type: 'object', title: 'Headers' } } },
  },
  inputSchema: {
    type: 'INLINE',
    schema: { type: 'object', properties: { method: { type: 'string' }, url: { type: 'string' } }, required: ['url'] },
  },
};

const model: WorkflowModel = { schemaVersion: '1', key: 'wf', name: 'wf', start: { type: 'MANUAL_API', targetNodeKey: 'a1' }, nodes: [], edges: [] };

const actionNode: WorkflowNode = {
  key: 'a1',
  kind: 'ACTION',
  actionRef: { action: { actionKey: 'integration.http-request', actionVersion: '1' } },
  input: { type: 'OBJECT', fields: {} },
  config: { type: 'OBJECT', fields: {} },
};

const secretReferences: WorkflowSecretReference[] = [
  { id: 1, name: 'SLACK_WEBHOOK_URL', label: 'Slack webhook (#ops)', description: null, configuredOnThisNode: true, createdAt: null, updatedAt: null },
  { id: 2, name: 'GITHUB_TOKEN', label: 'GitHub token', description: null, configuredOnThisNode: false, createdAt: null, updatedAt: null },
];

/** Mirrors how `NodeEditorPanel` really drives `NodeKindForm` (a controlled `draftNode` +
 * `setDraftNode`) — a no-op `onChange` can't prove a write round-trips, since `ExpressionField`'s
 * displayed text is seeded from the `value` prop, which only changes when the parent re-renders
 * with the updated node. */
const ControlledHarness: React.FC<{ initialNode: WorkflowNode; secretReferences: WorkflowSecretReference[] }> = ({ initialNode, secretReferences: refs }) => {
  const [node, setNode] = React.useState(initialNode);
  return <NodeKindForm node={node} model={model} definitionId={1} actionCatalog={[httpRequestCatalogEntry]} onChange={setNode} secretReferences={refs} />;
};

describe('Secret-marked field — registered reference quick-pick', () => {
  it('shows the lock hint and a quick-pick populated from the registered secret references, and inserts the picked name as a literal', () => {
    render(<ControlledHarness initialNode={actionNode} secretReferences={secretReferences} />);

    expect(screen.getByText(/Secret reference — enter the NAME/)).toBeInTheDocument();

    const picker = screen.getByText('Pick a registered secret reference…').closest('select') as HTMLSelectElement;
    expect(picker).toBeInTheDocument();
    expect(screen.getByText('Slack webhook (#ops) (SLACK_WEBHOOK_URL)')).toBeInTheDocument();
    expect(screen.getByText('GitHub token (GITHUB_TOKEN)')).toBeInTheDocument();

    // The field row (lock hint + picker + ExpressionField) is one wrapping container — scope the
    // assertion to it so this doesn't accidentally match an unrelated field on the same form.
    const fieldRow = picker.closest('div.flex.flex-col') as HTMLElement;
    fireEvent.change(picker, { target: { value: 'SLACK_WEBHOOK_URL' } });

    const headersField = within(fieldRow).getByPlaceholderText('type @ for references…') as HTMLInputElement;
    expect(headersField.value).toBe('SLACK_WEBHOOK_URL');
  });

  it('omits the quick-pick (but keeps the lock hint) when no secret references are registered yet', () => {
    render(<ControlledHarness initialNode={actionNode} secretReferences={[]} />);

    expect(screen.getByText(/Secret reference — enter the NAME/)).toBeInTheDocument();
    expect(screen.queryByText('Pick a registered secret reference…')).not.toBeInTheDocument();
  });
});
