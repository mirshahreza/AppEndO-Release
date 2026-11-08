// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NodeKindForm } from '../NodeKindForm';
import type { ActionCatalogEntry } from '../actionCatalogUtils';
import type { WorkflowDataSourceOption, WorkflowModel, WorkflowNode } from '../../types';

afterEach(cleanup);

/** Mirrors exactly what `dataDbQueryDefinition` (corePack) sends over the wire — `dataSourceId` is
 * marked `format: 'data-source-id'` so the Designer offers a real quick-pick instead of a blind
 * free-text/expression field the author would have to guess a raw id for. */
const dbQueryCatalogEntry: ActionCatalogEntry = {
  key: 'data.db-query',
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass: 'READ_EXTERNAL',
  tags: ['data', 'database', 'sql'],
  configSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: { dataSourceId: { type: 'string', title: 'Data source', format: 'data-source-id' } },
      required: ['dataSourceId'],
    },
  },
  inputSchema: {
    type: 'INLINE',
    schema: { type: 'object', properties: { sql: { type: 'string' }, params: { type: 'array' } }, required: ['sql'] },
  },
};

const model: WorkflowModel = { schemaVersion: '1', key: 'wf', name: 'wf', start: { type: 'MANUAL_API', targetNodeKey: 'a1' }, nodes: [], edges: [] };

const actionNode: WorkflowNode = {
  key: 'a1',
  kind: 'ACTION',
  actionRef: { action: { actionKey: 'data.db-query', actionVersion: '1' } },
  input: { type: 'OBJECT', fields: {} },
  config: { type: 'OBJECT', fields: {} },
};

const dataSources: WorkflowDataSourceOption[] = [
  { id: 'ds_default_local', name: 'default-db', type: 'SQL Server' },
  { id: 'ds_reporting', name: 'reporting-replica', type: 'Postgres' },
];

/** Mirrors how `NodeEditorPanel` really drives `NodeKindForm` (a controlled `draftNode` +
 * `setDraftNode`) — a no-op `onChange` can't prove a write round-trips. */
const ControlledHarness: React.FC<{ initialNode: WorkflowNode; dataSources: WorkflowDataSourceOption[] }> = ({ initialNode, dataSources: sources }) => {
  const [node, setNode] = React.useState(initialNode);
  return <NodeKindForm node={node} model={model} definitionId={1} actionCatalog={[dbQueryCatalogEntry]} onChange={setNode} dataSources={sources} />;
};

describe('data-source-id field — configured Data Source quick-pick', () => {
  it('offers every configured Data Source by name, and picking one writes its real id as a literal', () => {
    render(<ControlledHarness initialNode={actionNode} dataSources={dataSources} />);

    const picker = screen.getByText('Pick a configured Data Source…').closest('select') as HTMLSelectElement;
    expect(picker).toBeInTheDocument();
    expect(screen.getByText('default-db (SQL Server)')).toBeInTheDocument();
    expect(screen.getByText('reporting-replica (Postgres)')).toBeInTheDocument();

    const fieldRow = picker.closest('div.flex.flex-col') as HTMLElement;
    fireEvent.change(picker, { target: { value: 'ds_reporting' } });

    const dataSourceIdField = within(fieldRow).getByPlaceholderText('type @ for references…') as HTMLInputElement;
    expect(dataSourceIdField.value).toBe('ds_reporting');
  });

  it('shows a helpful message instead of a picker when no Data Sources are configured yet', () => {
    render(<ControlledHarness initialNode={actionNode} dataSources={[]} />);

    expect(screen.queryByText('Pick a configured Data Source…')).not.toBeInTheDocument();
    expect(screen.getByText(/No Data Sources are configured yet/)).toBeInTheDocument();
  });
});
