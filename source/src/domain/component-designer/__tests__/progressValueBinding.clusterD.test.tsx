/**
 * @vitest-environment jsdom
 * Cluster D — heroui.progress Value property binding.
 *
 * Bug: the "Value" Inspector field is bindable (generic bind-button for any 'number' field),
 * but the bound value was 100% dead, in both the interactive canvas preview and the
 * exported/published code:
 *  - Preview: `resolveProgressValue(node)` (runtimeShared.ts) reads only the static
 *    node.props.value — the live/interactive preview never consulted the preview binding
 *    bridge at all, unlike every other bindable widget (input/select/image/...).
 *  - Export: `isFormValueProp('value')` defaults every 'value' Property Binding to
 *    `valueMode: 'defaultValue'` (an established convention for real *form controls*, where
 *    exporting an uncontrolled `defaultValue` keeps generated code simple). @heroui/react's
 *    <ProgressBar> is not a form control — it is a purely presentational, always-controlled
 *    component (react-aria's ProgressBarBaseProps only has `value`, no `defaultValue` at
 *    all) — so the generated `defaultValue={...}` attribute was silently ignored, and the
 *    bar always rendered its static fallback value.
 * Fixed in runtimeRenderer.tsx (resolvePreviewProgressValue consults the preview binding
 * bridge in interactive mode) and bindingCodegen.ts / tsxNodeRenderer.ts (force `value`,
 * never `defaultValue`, for heroui.progress specifically).
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';
import {
  createPropertyBindingDefinition,
  propertyBindingKeyForProp,
} from '../bindingEngine';
import { createInitialDesignerState, designerReducer } from '../state';

const insertBoundProgress = () => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'heroui.progress',
    parentId: state.document.rootNodeId,
  });
  const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'stats',
    dataSource: { id: 'stats', name: 'Stats', endpoint: '/api/stats', fields: ['completion'] },
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('value'),
    definition: createPropertyBindingDefinition('value', 'completion', { fetchEndpoint: '/api/stats' }),
  });
  return { state, nodeId };
};

describe('Cluster D — heroui.progress Value property binding', () => {
  afterEach(() => cleanup());

  it('DOM proof: interactive canvas preview shows the bound value, not the static fallback', () => {
    const { state, nodeId } = insertBoundProgress();

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
          previewResults: { [`node:${nodeId}:prop:value`]: 37 },
        })}
      </>,
    );

    const bar = container.querySelector('[data-slot="progress-bar"], [role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar).toHaveAttribute('aria-valuenow', '37');
  });

  it('interactive canvas preview falls back to the static value when nothing is hydrated yet', () => {
    const { state } = insertBoundProgress();

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
          previewResults: {},
        })}
      </>,
    );

    const bar = container.querySelector('[data-slot="progress-bar"], [role="progressbar"]');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
  });

  it('exported TSX emits value={...bound expression...} on ProgressBar, never a dead defaultValue', () => {
    const { state } = insertBoundProgress();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('<ProgressBar');
    expect(tsx).toMatch(/<ProgressBar[^>]*\svalue=\{dataContext\?\.completion\}/);
    expect(tsx).not.toMatch(/<ProgressBar[^>]*\sdefaultValue=/);
    // Must not regress to emitting a duplicate/static value attribute alongside the bound one.
    expect((tsx.match(/\svalue=\{/g) ?? []).length).toBe(1);
  });
});
