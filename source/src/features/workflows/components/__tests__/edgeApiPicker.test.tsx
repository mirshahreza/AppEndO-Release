// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NodeKindForm } from '../NodeKindForm';
import type { ActionCatalogEntry } from '../actionCatalogUtils';
import type { WorkflowEdgeApiOption, WorkflowModel, WorkflowNode } from '../../types';

afterEach(cleanup);

const recordCreateCatalogEntry: ActionCatalogEntry = {
  key: 'data.record-create',
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass: 'WRITE_EXTERNAL',
  tags: ['data', 'record'],
  configSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: { apiKey: { type: 'string', title: 'Data API', format: 'edge-api-key' } },
      required: ['apiKey'],
    },
  },
  inputSchema: {
    type: 'INLINE',
    schema: { type: 'object', properties: { fields: { type: 'object' } }, required: ['fields'] },
  },
};

const model: WorkflowModel = { schemaVersion: '1', key: 'wf', name: 'wf', start: { type: 'MANUAL_API', targetNodeKey: 'a1' }, nodes: [], edges: [] };

const actionNode: WorkflowNode = {
  key: 'a1',
  kind: 'ACTION',
  actionRef: { action: { actionKey: 'data.record-create', actionVersion: '1' } },
  input: { type: 'OBJECT', fields: {} },
  config: { type: 'OBJECT', fields: {} },
};

const edgeApis: WorkflowEdgeApiOption[] = [
  { key: 'products', label: 'Products' },
  { key: 'cms-contents', label: 'CMS contents' },
];

const ControlledHarness: React.FC<{ initialNode: WorkflowNode; edgeApis: WorkflowEdgeApiOption[] }> = ({ initialNode, edgeApis: apis }) => {
  const [node, setNode] = React.useState(initialNode);
  return <NodeKindForm node={node} model={model} definitionId={1} actionCatalog={[recordCreateCatalogEntry]} onChange={setNode} edgeApis={apis} />;
};

describe('edge-api-key field — published Data API quick-pick', () => {
  it('offers every published Data API by label, and picking one writes its key as a literal', () => {
    render(<ControlledHarness initialNode={actionNode} edgeApis={edgeApis} />);

    const picker = screen.getByText('Pick a published Data API…').closest('select') as HTMLSelectElement;
    expect(picker).toBeInTheDocument();
    expect(screen.getByText('Products (products)')).toBeInTheDocument();
    expect(screen.getByText('CMS contents (cms-contents)')).toBeInTheDocument();

    const fieldRow = picker.closest('div.flex.flex-col') as HTMLElement;
    fireEvent.change(picker, { target: { value: 'products' } });

    const apiKeyField = within(fieldRow).getByPlaceholderText('type @ for references…') as HTMLInputElement;
    expect(apiKeyField.value).toBe('products');
  });

  it('shows a helpful message instead of a picker when no Data APIs are published yet', () => {
    render(<ControlledHarness initialNode={actionNode} edgeApis={[]} />);

    expect(screen.queryByText('Pick a published Data API…')).not.toBeInTheDocument();
    expect(screen.getByText(/No published Data APIs yet/)).toBeInTheDocument();
  });
});
