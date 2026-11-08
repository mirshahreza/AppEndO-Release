/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createInitialDesignerState } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { getPaletteItemById } from '../catalog';
import type React from 'react';

describe('designerRuntimePreview', () => {
  it('renders HeroUI button nodes in runtime preview instead of returning empty output', () => {
    const state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;
    const buttonId = 'preview-button-node';

    state.document.nodes[rootId] = {
      ...state.document.nodes[rootId],
      children: [buttonId],
    };

    const buttonItem = getPaletteItemById('heroui.button-solid');
    expect(buttonItem).toBeDefined();

    state.document.nodes[buttonId] = {
      id: buttonId,
      type: buttonItem!.nodeType,
      parentId: rootId,
      order: 0,
      props: {
        ...buttonItem!.defaultProps,
        _designerPaletteItemId: 'heroui.button-solid',
        text: 'Save changes',
      },
      layout: {},
      binding: {},
      children: [],
    };

    const preview = renderDesignerDocumentPreview(state.document);
    expect(preview).not.toBeNull();
  });

  it('renders amber placeholder for unknown node types', () => {
    const state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;
    const unknownId = 'preview-unknown-node';

    state.document.nodes[rootId] = {
      ...state.document.nodes[rootId],
      children: [unknownId],
    };

    state.document.nodes[unknownId] = {
      id: unknownId,
      type: 'unknown-type' as never,
      parentId: rootId,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };

    const preview = renderDesignerDocumentPreview(state.document);
    expect(preview).not.toBeNull();
  });

  it('renders real nested content under an unrecognized container node, instead of discarding it (regression)', () => {
    // A form/grid layout drafted with a container-capable node.type the runtime switch doesn't
    // explicitly handle used to disappear entirely — the `default:` fallback hard-coded `null`
    // as children, dropping any real content nested under it with no error surfaced (the canvas
    // just showed an empty amber placeholder box).
    const state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;
    const unknownId = 'preview-unknown-container-node';
    const childId = 'preview-unknown-container-child';

    state.document.nodes[rootId] = {
      ...state.document.nodes[rootId],
      children: [unknownId],
    };

    state.document.nodes[unknownId] = {
      id: unknownId,
      type: 'not-a-real-node-type' as never,
      parentId: rootId,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [childId],
    };
    state.document.nodes[childId] = {
      id: childId,
      type: 'text' as never,
      parentId: unknownId,
      order: 0,
      props: { text: 'Real nested content' },
      layout: {},
      binding: {},
      children: [],
    };

    const preview = renderDesignerDocumentPreview(state.document);
    render(preview as React.ReactElement);
    expect(screen.getByText('Real nested content')).toBeTruthy();
    cleanup();
  });
});
