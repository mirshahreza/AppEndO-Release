/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item P3.17): binding `accept` on `html.file-upload` was dead in the
 * live preview (always read the static `node.props.accept`) AND misplaced in export — the
 * generic bound-attribute loop appended it onto the wrapping `<label>` (which has no such real
 * HTML effect) instead of the real `<input type="file">`, the only element `accept` ever does
 * anything on.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindStoreProp = (state: DesignerState, nodeId: string, prop: string, storePath: string): DesignerState => {
  const binding = createStoreReadBindingDefinition(prop, storePath);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

describe('html.file-upload accept binding fix', () => {
  afterEach(() => {
    cleanup();
  });

  it('export: emits the bound accept expression on the shared runtime component', async () => {
    let state = insertItem(createInitialDesignerState(), 'html.file-upload');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'accept', 'upload.acceptTypes');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('file-upload bound accept', tsx);

    expect(tsx).toContain("import { DesignerRuntimeFileUpload } from '@/domain/component-designer/DesignerRuntimeFileUpload';");
    expect(tsx).toMatch(/<DesignerRuntimeFileUpload[^>]*accept=\{designerStore\?\.upload\?\.acceptTypes\}/);
  });

  it('export: still emits a static accept string on the shared runtime component when not bound', async () => {
    let state = insertItem(createInitialDesignerState(), 'html.file-upload');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'accept', value: 'image/*,.pdf' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('file-upload static accept', tsx);
    expect(tsx).toMatch(/<DesignerRuntimeFileUpload[^>]*accept="image\/\*,\.pdf"/);
  });

  it('preview: reflects a Store-bound accept value on the real file input', () => {
    let state = insertItem(createInitialDesignerState(), 'html.file-upload');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'accept', 'upload.acceptTypes');

    render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: { upload: { acceptTypes: 'image/png,image/jpeg' } },
        })}
      </>,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe('image/png,image/jpeg');
  });
});
