// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ActionJsonSchema, CanonicalMapping } from '../../types';

const getDynamicOptions = vi.fn();

vi.mock('../../api/workflowsApi', () => ({
  workflowsApi: { getDynamicOptions: (...args: unknown[]) => getDynamicOptions(...args) },
  WorkflowsApiError: class WorkflowsApiError extends Error {},
}));

import { ActionFieldsMappingEditor } from '../ActionFieldsMappingEditor';
import { DesignerDialogHostContext } from '../../../../shared/ui/designerDialogHostContext';

/** Forces `UiSelect`'s plain-native-`<select>` render path (used inside native designer dialogs) —
 * the only variant that reliably responds to `fireEvent.change` in jsdom; the default HeroUI
 * listbox variant needs a click-open-then-click-option interaction this test doesn't need to prove. */
const withNativeSelect = (node: React.ReactElement) => (
  <DesignerDialogHostContext.Provider value={true}>{node}</DesignerDialogHostContext.Provider>
);

const schema: ActionJsonSchema = {
  type: 'object',
  properties: {
    roleName: { type: 'string', title: 'Role name', format: 'dynamic-options', dynamicOptionsSource: 'identity.roles' },
  },
  required: ['roleName'],
};

const baseContext = { consumerNodeKey: null, isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ActionFieldsMappingEditor — dynamic-options field', () => {
  it('fetches and renders live options, and picking one writes a literal expression', async () => {
    getDynamicOptions.mockResolvedValue({ options: [{ value: 'ADMIN', label: 'ADMIN' }, { value: 'EDITOR', label: 'EDITOR' }] });
    const onChange = vi.fn();
    const mapping: CanonicalMapping = { type: 'OBJECT', fields: {} };

    render(withNativeSelect(
      <ActionFieldsMappingEditor
        label="Input mapping"
        definitionId={1}
        schema={schema}
        mapping={mapping}
        onChange={onChange}
        context={baseContext}
      />,
    ));

    expect(getDynamicOptions).toHaveBeenCalledWith('identity.roles');
    await waitFor(() => expect(screen.getByText('ADMIN')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Dynamic options'), { target: { value: 'EDITOR' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'OBJECT', fields: { roleName: { type: 'EXPRESSION', expression: { op: 'LITERAL', value: 'EDITOR' } } } });
  });

  it('shows a quiet message and does not crash when the resolver call fails', async () => {
    getDynamicOptions.mockRejectedValue(new Error('boom'));
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

    await waitFor(() => expect(screen.getByText('Failed to load options.')).toBeInTheDocument());
  });
});
