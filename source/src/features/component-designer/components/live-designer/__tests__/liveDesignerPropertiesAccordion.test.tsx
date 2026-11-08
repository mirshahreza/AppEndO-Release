// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../../domain/component-designer/state';
import type { DesignerAction, DesignerDocument, DesignerBindingDefinitions } from '../../../../../domain/component-designer/types';
import { LiveDesignerPropertiesPanel } from '../LiveDesignerPropertiesPanel';

function renderPanel(args: {
  nodeId?: string | null;
  mutate?: (state: ReturnType<typeof createInitialDesignerState>) => ReturnType<typeof createInitialDesignerState>;
}) {
  let state = createInitialDesignerState('live-properties-relevance');
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.text',
    parentId: state.document.rootNodeId,
  });
  const textId = state.document.nodes[state.document.rootNodeId].children[0]!;
  if (args.mutate) {
    state = args.mutate(state);
  }
  const selectedId = args.nodeId === undefined ? textId : args.nodeId;
  if (selectedId) {
    state = designerReducer(state, { type: 'select-node', nodeId: selectedId });
  }

  const node = selectedId ? state.document.nodes[selectedId] ?? null : null;
  const dispatch = ((action: DesignerAction) => {
    state = designerReducer(state, action);
  }) as React.Dispatch<DesignerAction>;

  return {
    textId,
    ...render(
      <div style={{ height: 640 }}>
        <LiveDesignerPropertiesPanel
          node={node}
          document={state.document}
          bindingDefinitions={state.bindingDefinitions}
          dispatch={dispatch}
          onClose={() => undefined}
          width={320}
        />
      </div>,
    ),
  };
}

function sectionLabels(panel: HTMLElement): string[] {
  return within(panel)
    .getAllByRole('button')
    .map((button) => button.textContent?.trim() ?? '')
    .filter(Boolean);
}

describe('LiveDesignerPropertiesPanel accordion layout', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('uses flush toolbox accordion sections without rounded property cards', () => {
    const { container } = renderPanel({});
    const panel = screen.getByTestId('live-designer-properties-panel');
    const title = within(panel).getByTestId('live-designer-dock-panel-title');

    expect(title).toHaveTextContent('Properties');
    expect(title.className).toContain('text-[13px]');

    expect(panel.querySelector('.rounded-lg.border')).toBeNull();
    expect(panel.querySelector('[data-layout="panel"]')).toBeNull();

    const contentTier = container.querySelectorAll('[data-inspector-tier="content"]');
    expect(contentTier.length).toBeGreaterThan(0);

    const contentHeader = within(panel).getByRole('button', { name: /content/i });
    expect(contentHeader).toHaveAttribute('aria-expanded', 'true');

    const styleHeader = within(panel).getByRole('button', { name: /style/i });
    expect(styleHeader).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(styleHeader);
    expect(styleHeader).toHaveAttribute('aria-expanded', 'true');
    expect(contentHeader).toHaveAttribute('aria-expanded', 'false');

    // Closing the last open section is blocked.
    fireEvent.click(styleHeader);
    expect(styleHeader).toHaveAttribute('aria-expanded', 'true');
  });

  it('remembers the last open node section after the properties panel remounts', () => {
    renderPanel({});
    const panel = screen.getByTestId('live-designer-properties-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Style' }));
    expect(within(panel).getByRole('button', { name: 'Style' })).toHaveAttribute('aria-expanded', 'true');
    cleanup();

    renderPanel({});
    const remounted = screen.getByTestId('live-designer-properties-panel');
    expect(within(remounted).getByRole('button', { name: 'Style' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(remounted).getByRole('button', { name: 'Content' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('LiveDesignerPropertiesPanel relevant sections only', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('hides document panels and empty node binding for a selected text node', () => {
    renderPanel({});
    const panel = screen.getByTestId('live-designer-properties-panel');
    const labels = sectionLabels(panel);

    expect(labels.some((label) => /content/i.test(label))).toBe(true);
    expect(labels.some((label) => /visibility/i.test(label))).toBe(true);

    expect(labels.some((label) => /access control/i.test(label))).toBe(false);
    expect(labels.some((label) => /data resources/i.test(label))).toBe(false);
    expect(labels.some((label) => /global state store/i.test(label))).toBe(false);
    expect(labels.some((label) => /binding definitions/i.test(label))).toBe(false);
    expect(labels.some((label) => /diagnostics/i.test(label))).toBe(false);
    expect(labels.some((label) => /node binding/i.test(label))).toBe(false);
    expect(labels.some((label) => /form data connection|grid data|chart data|repeater data|widget data|content data/i.test(label))).toBe(false);
  });

  it('shows document panels only when no node is selected', () => {
    renderPanel({ nodeId: null });
    const panel = screen.getByTestId('live-designer-properties-panel');
    const labels = sectionLabels(panel);

    expect(labels.some((label) => /data resources/i.test(label))).toBe(true);
    expect(labels.some((label) => /access control/i.test(label))).toBe(true);
    expect(labels.some((label) => /diagnostics/i.test(label))).toBe(false);
    expect(labels.some((label) => /content/i.test(label))).toBe(false);
    expect(labels.some((label) => /visibility/i.test(label))).toBe(false);
  });

  it('shows node binding only when the selected node has custom bindings', () => {
    renderPanel({
      mutate: (state) => {
        const textId = state.document.nodes[state.document.rootNodeId].children[0]!;
        return designerReducer(state, {
          type: 'set-node-binding',
          nodeId: textId,
          bindingKey: 'custom_fx',
          definition: { sourceType: 'static', staticValue: 'x' },
        });
      },
    });
    const panel = screen.getByTestId('live-designer-properties-panel');
    expect(sectionLabels(panel).some((label) => /node binding/i.test(label))).toBe(true);
  });

  it('shows grid data connection for a data grid node only', () => {
    let state = createInitialDesignerState('live-properties-grid');
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const gridId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, { type: 'select-node', nodeId: gridId });

    const dispatch = ((action: DesignerAction) => {
      state = designerReducer(state, action);
    }) as React.Dispatch<DesignerAction>;

    render(
      <div style={{ height: 640 }}>
        <LiveDesignerPropertiesPanel
          node={state.document.nodes[gridId]!}
          document={state.document as DesignerDocument}
          bindingDefinitions={state.bindingDefinitions as DesignerBindingDefinitions}
          dispatch={dispatch}
          onClose={() => undefined}
          width={320}
        />
      </div>,
    );

    const panel = screen.getByTestId('live-designer-properties-panel');
    const labels = sectionLabels(panel);
    expect(labels.some((label) => /grid data connection/i.test(label))).toBe(true);
    expect(labels.some((label) => /form data connection|chart data|repeater data/i.test(label))).toBe(false);
    expect(labels.some((label) => /data resources/i.test(label))).toBe(false);
  });
});
