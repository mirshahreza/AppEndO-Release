/**
 * @vitest-environment jsdom
 *
 * html.file-upload was listed as eventComplete:false. Two real, independent bugs:
 * 1. resolveNodeEventBindingTargets() never declared `onChange` as bindable for it at
 *    all, so a user couldn't even configure an onChange action in the Inspector.
 * 2. Even after declaring it, codegen's renderHtmlFileUploadJsx bound the onChange
 *    handler onto the wrapping <label> (via the generic renderAttrs call), not the
 *    real <input type="file">. <label> never fires a DOM `change` event, so the
 *    handler would be present in the exported code but would never actually run.
 * Preview never wired any onChange handler onto the <input> at all.
 * This proves both the declaration and the live-preview dispatch are now fixed.
 *
 * Updated for Phase 45 (File Upload enrichment: maxFileSizeMb/dragDropZone/showPreview):
 * export codegen no longer inlines a raw <label>/<input type="file"> pair — it now emits a
 * <DesignerRuntimeFileUpload onChange={...} .../> reference to the shared enriched component
 * (src/domain/component-designer/DesignerRuntimeFileUpload.tsx), which itself renders the real
 * <label>/<input type="file"> and wires onChange to the input internally (verified directly in
 * that component's source, and exercised end-to-end by the third test below on the live canvas).
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';
import {
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import { createDynamicAction, visibilityStorePathForNode } from '../bindingDynamicActionsEngine';

describe('html.file-upload onChange wiring (eventComplete fix)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('declares onChange as a bindable event target', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.file-upload',
      parentId: state.document.rootNodeId,
    });
    const uploadId = state.document.nodes[state.document.rootNodeId].children[0]!;
    expect(resolveNodeEventBindingTargets(state.document.nodes[uploadId]!)).toEqual(['onChange']);
  });

  it('emits onChange on the DesignerRuntimeFileUpload component, which wires it to the real <input> internally', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.file-upload',
      parentId: state.document.rootNodeId,
    });
    const uploadId = state.document.nodes[state.document.rootNodeId].children[0]!;

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = uploadId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: uploadId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createDynamicActionsEventBindingDefinition('onChange', [showAction]),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const componentMatch = tsx.match(/<DesignerRuntimeFileUpload[^]*?\/>/);
    expect(componentMatch).toBeTruthy();
    expect(componentMatch![0]).toContain('onChange=');
    // No raw <label>/<input type="file"> pair is inlined directly into the exported JSX anymore —
    // that markup now lives inside DesignerRuntimeFileUpload itself (a real component, imported
    // and rendered, not duplicated per export).
    expect(tsx).not.toMatch(/<input[^>]*type="file"/);
  });

  it('fires a showHide Dynamic Action bound to onChange when a file is picked on the live canvas', async () => {
    let state = createInitialDesignerState();

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.file-upload',
      parentId: state.document.rootNodeId,
    });
    const uploadId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    const modalId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'title', value: 'File received' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId: modalId, key: 'isOpen', value: false });

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: uploadId,
      bindingKey: eventBindingKeyForEvent('onChange'),
      definition: createDynamicActionsEventBindingDefinition('onChange', [showAction]),
    });

    const visibilityPath = visibilityStorePathForNode(modalId);

    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      return renderDesignerDocumentPreview(state.document, {
        interactive: true,
        bindingDefinitions: state.bindingDefinitions,
        designerStore: store,
        onStoreChange: (updater) => {
          setStore((current) => (typeof updater === 'function' ? updater(current) : updater));
        },
      });
    };

    render(<PreviewHarness />);
    expect(screen.queryByText('File received')).toBeNull();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file = new File(['contents'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(screen.getByText('File received')).toBeTruthy();
    });
    expect(visibilityPath).toBe(`ui.visibility.${modalId}`);
  });
});
