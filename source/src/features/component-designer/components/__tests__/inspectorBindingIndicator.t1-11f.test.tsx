// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
import { createRegionColumnBindingDefinition } from '../../../../domain/component-designer/bindingRegionEngine';
import { propertyBindingKeyForProp } from '../../../../domain/component-designer/bindingEngine';
import type { InspectorFieldSchema } from '../../../../domain/component-designer/inspectorRegistry';

const VALUE_FIELD: InspectorFieldSchema = {
  key: 'value',
  label: 'Value',
  type: 'string',
  group: 'content',
};

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

afterEach(() => {
  cleanup();
});

describe('Inspector permanent binding indicator (T1-11f)', () => {
  it('shows a Region Column indicator when Value is bound to a region column', () => {
    const { state, nodeId } = insertTextInput();
    const withBinding = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'FIRST_NAME'),
    });
    const node = withBinding.document.nodes[nodeId];
    const dispatch = vi.fn();

    render(
      <InspectorBindablePropField
        node={node}
        document={withBinding.document}
        bindingDefinitions={withBinding.bindingDefinitions}
        field={VALUE_FIELD}
        setProp={vi.fn()}
        dispatch={dispatch}
      />,
    );

    const indicator = screen.getByTestId('prop-binding-source-indicator-regionColumn');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('data-binding-source', 'regionColumn');
    expect(indicator).toHaveAttribute('aria-label', 'Bound to Region Column');
    expect(indicator.className).toMatch(/bg-sky-500/);
  });

  it('does not show a binding indicator for a static unbound field', () => {
    const { state, nodeId } = insertTextInput();
    const node = state.document.nodes[nodeId];
    const dispatch = vi.fn();

    render(
      <InspectorBindablePropField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        field={PLACEHOLDER_FIELD}
        setProp={vi.fn()}
        dispatch={dispatch}
      />,
    );

    expect(screen.queryByTestId(/^prop-binding-source-indicator-/)).not.toBeInTheDocument();
    expect(screen.getByText('Placeholder')).toBeInTheDocument();
  });
});
