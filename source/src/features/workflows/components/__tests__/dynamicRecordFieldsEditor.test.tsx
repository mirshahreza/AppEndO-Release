// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ActionJsonSchema, CanonicalMapping } from '../../types';

const getRecordFieldsForEdgeApiKey = vi.fn();

vi.mock('../../api/workflowsApi', () => ({
  workflowsApi: { getRecordFieldsForEdgeApiKey: (...args: unknown[]) => getRecordFieldsForEdgeApiKey(...args) },
  WorkflowsApiError: class WorkflowsApiError extends Error {},
}));

import { ActionFieldsMappingEditor } from '../ActionFieldsMappingEditor';

/** Mirrors `dataRecordCreateDefinition`'s real `inputSchema.fields` shape (p-99/WFT-5). */
const schema: ActionJsonSchema = {
  type: 'object',
  properties: {
    fields: { type: 'object', title: 'Fields', format: 'dynamic-record-fields', dynamicRecordFieldsSource: 'apiKey' },
  },
  required: ['fields'],
};

const baseContext = { consumerNodeKey: null, isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ActionFieldsMappingEditor — dynamic-record-fields field', () => {
  it('asks the author to pick a Data API first when the sibling config value is not yet set', () => {
    render(
      <ActionFieldsMappingEditor
        label="Input mapping"
        definitionId={1}
        schema={schema}
        mapping={{ type: 'OBJECT', fields: {} }}
        onChange={() => {}}
        context={baseContext}
      />,
    );
    expect(screen.getByText('Pick a Data API above first.')).toBeInTheDocument();
    expect(getRecordFieldsForEdgeApiKey).not.toHaveBeenCalled();
  });

  it('fetches the writable columns for the sibling apiKey and writes a nested OBJECT mapping value per column', async () => {
    getRecordFieldsForEdgeApiKey.mockResolvedValue({
      fields: [
        { field: 'title', name: 'title', dataType: 'text', allowNull: false },
        { field: 'body', name: 'body', dataType: 'text', allowNull: true },
      ],
    });
    const onChange = vi.fn();
    const mapping: CanonicalMapping = { type: 'OBJECT', fields: {} };

    render(
      <ActionFieldsMappingEditor
        label="Input mapping"
        definitionId={1}
        schema={schema}
        mapping={mapping}
        onChange={onChange}
        context={baseContext}
        siblingConfigValues={{ apiKey: 'cms-contents' }}
      />,
    );

    expect(getRecordFieldsForEdgeApiKey).toHaveBeenCalledWith('cms-contents');
    await waitFor(() => expect(screen.getByText('title *')).toBeInTheDocument());
    expect(screen.getByText('body')).toBeInTheDocument();

    const titleField = screen.getAllByPlaceholderText('type @ for references…')[0] as HTMLInputElement;
    fireEvent.change(titleField, { target: { value: 'Hello world' } });

    expect(onChange).toHaveBeenCalledWith({
      type: 'OBJECT',
      fields: {
        fields: { type: 'OBJECT', fields: { title: { type: 'EXPRESSION', expression: { op: 'LITERAL', value: 'Hello world' } } } },
      },
    });
  });

  it('offers switching to a raw expression, and back, without losing the declared field label', () => {
    render(
      <ActionFieldsMappingEditor
        label="Input mapping"
        definitionId={1}
        schema={schema}
        mapping={{ type: 'OBJECT', fields: {} }}
        onChange={() => {}}
        context={baseContext}
        siblingConfigValues={{ apiKey: 'cms-contents' }}
      />,
    );
    expect(screen.getByText('Advanced: use a raw expression instead')).toBeInTheDocument();
  });
});
