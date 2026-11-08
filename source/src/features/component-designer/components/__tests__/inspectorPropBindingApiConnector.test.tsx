// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../../test-support/componentDesignerHeroUiMock');
  return componentDesignerHeroUiMock;
});

vi.mock('../../../../shared/ui/HeroFieldControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/ui/HeroFieldControls')>();
  return {
    ...actual,
    UiInput: ({ value, onChange, ariaLabel, type, placeholder, isDisabled, disabled }: any) => (
      <input
        value={value ?? ''}
        onChange={onChange}
        aria-label={ariaLabel}
        type={type}
        placeholder={placeholder}
        disabled={Boolean(isDisabled ?? disabled)}
      />
    ),
    UiSelect: ({ value, onChange, ariaLabel, children, isDisabled, disabled }: any) => (
      <select
        value={value ?? ''}
        onChange={onChange}
        aria-label={ariaLabel}
        disabled={Boolean(isDisabled ?? disabled)}
      >
        {children}
      </select>
    ),
    UiCheckbox: ({ checked, onChange, children }: any) => (
      <label>
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
        />
        {children}
      </label>
    ),
  };
});

import { InspectorBindablePropField } from '../InspectorPropBindingControl';
import { createInitialDesignerState, designerReducer } from '../../../../domain/component-designer/state';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../../../../domain/component-designer/bindingEngine';
import type { InspectorFieldSchema } from '../../../../domain/component-designer/inspectorRegistry';

const PLACEHOLDER_FIELD: InspectorFieldSchema = {
  key: 'placeholder',
  label: 'Placeholder',
  type: 'string',
  group: 'content',
};

const insertTextInput = () => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'heroui.input-text',
    parentId: state.document.rootNodeId,
  });
  const root = state.document.nodes[state.document.rootNodeId];
  const nodeId = root.children[root.children.length - 1] as string;
  return { state, nodeId };
};

/** Renders the field with an existing API-connector property binding (sourceMode 'api', a
 * `/api/packages/api-connectors/proxy/<familyId>/...` fetchEndpoint) so the Connect/Disconnect
 * OAuth panel in `InspectorPropBindingDynamicPanel` is on screen. */
const renderConnectorBoundField = () => {
  const { state, nodeId } = insertTextInput();
  const withBinding = designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('placeholder'),
    definition: createPropertyBindingDefinition('placeholder', 'record.name', {
      fetchEndpoint: '/api/packages/api-connectors/proxy/salesforce/contacts',
    }),
  });
  const node = withBinding.document.nodes[nodeId];

  render(
    <InspectorBindablePropField
      node={node}
      document={withBinding.document}
      bindingDefinitions={withBinding.bindingDefinitions}
      field={PLACEHOLDER_FIELD}
      setProp={vi.fn()}
      dispatch={vi.fn()}
    />,
  );
};

describe('InspectorPropBindingControl — API connector Connect/Disconnect error handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a visible error when the initial connection-status check fails (network error)', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

    renderConnectorBoundField();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the connection service/i);
    });
  });

  it('shows a visible error, not a silent failure, when clicking Connect Account fails', async () => {
    // First call: initial fetchConnections() on mount — succeeds with no connections.
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ connections: [] }),
    });

    renderConnectorBoundField();

    const connectButton = await screen.findByRole('button', { name: 'Connect Account' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Second call: the actual Connect click — server rejects it.
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 });

    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not connect salesforce/i);
    });

    // The button must still say "Connect Account" — the failed connect must not be treated as success.
    expect(screen.getByRole('button', { name: 'Connect Account' })).toBeInTheDocument();
  });

  it('shows a visible error when clicking Connect Account throws (network failure on the action itself)', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ connections: [] }),
    });

    renderConnectorBoundField();

    const connectButton = await screen.findByRole('button', { name: 'Connect Account' });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));

    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the connection service/i);
    });
  });
});
