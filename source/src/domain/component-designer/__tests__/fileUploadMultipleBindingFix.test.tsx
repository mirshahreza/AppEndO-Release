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
 * Bug found (parity audit item 17): unlike `accept` on `html.file-upload` (already fixed —
 * see `fileUploadAcceptBindingFix.test.tsx`), the same class of bug was never fixed for
 * `multiple`: dead in the live preview (always read the static `node.props.multiple`) AND
 * misplaced in export — the generic bound-attribute loop appended it onto the wrapping `<label>`
 * (no real HTML effect there) while the real `<input type="file">` only ever got the static
 * boolean flag, never a bound expression.
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

describe('html.file-upload multiple binding fix (parity audit item 17)', () => {
  afterEach(() => {
    cleanup();
  });

  it('export: emits the bound multiple expression on the shared runtime component', async () => {
    let state = insertItem(createInitialDesignerState(), 'html.file-upload');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'multiple', 'upload.allowMultiple');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('file-upload bound multiple', tsx);

    expect(tsx).toContain("import { DesignerRuntimeFileUpload } from '@/domain/component-designer/DesignerRuntimeFileUpload';");
    expect(tsx).toMatch(/<DesignerRuntimeFileUpload[^>]*multiple=\{[^}]*designerStore\?\.upload\?\.allowMultiple[^}]*\}/);
  });

  it('export: still emits a static multiple flag on the shared runtime component when not bound', async () => {
    let state = insertItem(createInitialDesignerState(), 'html.file-upload');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'multiple', value: true });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('file-upload static multiple', tsx);
    expect(tsx).toMatch(/<DesignerRuntimeFileUpload[^>]*multiple(?:=\{true\})?/);
  });

  it('preview: reflects a Store-bound multiple value on the real file input', () => {
    let state = insertItem(createInitialDesignerState(), 'html.file-upload');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'multiple', 'upload.allowMultiple');

    render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: { upload: { allowMultiple: true } },
        })}
      </>,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.multiple).toBe(true);
  });

  it('preview: still respects the static multiple value when not bound', () => {
    let state = insertItem(createInitialDesignerState(), 'html.file-upload');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'multiple', value: true });

    render(<>{renderDesignerDocumentPreview(state.document, { interactive: true, bindingDefinitions: state.bindingDefinitions })}</>);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.multiple).toBe(true);
  });
});
