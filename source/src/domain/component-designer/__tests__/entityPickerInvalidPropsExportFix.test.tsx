/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 27): `entityRef`/`searchParam` are Designer-internal bookkeeping
 * (which API endpoint / query param name to search with) — real, working values for driving the
 * generated search-fetch logic — but they were ALSO spread directly as literal JSX
 * attributes/props onto the real `@heroui/react` `<Autocomplete>` component in both the live
 * canvas/preview (`resolveEntityPickerProps`, runtimeNodeProps.ts) and export
 * (`renderEntityPickerCustomJsx`, tsxPhase2Palette.ts). The real `AutocompleteRootProps`
 * (node_modules/@heroui/react/dist/components/autocomplete/autocomplete.d.ts) declares no such
 * props at all — a type-contract violation in both paths identically, not a Preview/Export
 * divergence.
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveEntityPickerProps } from '../runtimeNodeProps';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('heroui.entity-picker invalid entityRef/searchParam props fix (parity audit item 27)', () => {
  afterEach(() => cleanup());

  it('preview: resolveEntityPickerProps no longer includes entityRef/searchParam in the spread props', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'entityRef', value: 'users' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'searchParam', value: 'search' });

    const props = resolveEntityPickerProps(state.document.nodes[nodeId]!);
    expect(props).not.toHaveProperty('entityRef');
    expect(props).not.toHaveProperty('searchParam');
  });

  it('preview: renders without React warning about unrecognized entityRef/searchParam DOM props', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'entityRef', value: 'users' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'searchParam', value: 'search' });

    const consoleError: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => { consoleError.push(args.join(' ')); };
    try {
      render(<>{renderDesignerDocumentPreview(state.document)}</>);
    } finally {
      console.error = originalError;
    }
    expect(consoleError.join('\n')).not.toContain('entityRef');
    expect(consoleError.join('\n')).not.toContain('searchParam');
  });

  it('export: entityRef/searchParam never leak as literal attributes on the real <Autocomplete>', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.entity-picker');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'entityRef', value: 'users' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'searchParam', value: 'search' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'label', value: 'Assignee' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('entity-picker with entityRef/searchParam', tsx);

    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\sentityRef=/);
    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\ssearchParam=/);
    // Label is a visible <span>, not a dead Autocomplete prop (parity audit item 49).
    expect(tsx).not.toMatch(/<Autocomplete\b[^>]*\slabel=/);
    expect(tsx).toContain('ps-[4px]');
    expect(tsx).toContain('Assignee');
  });
});
