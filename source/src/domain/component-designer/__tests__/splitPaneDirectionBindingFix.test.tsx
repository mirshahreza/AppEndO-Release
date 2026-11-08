/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 38): `layout.split-pane`'s `direction`/`defaultSplit` Property
 * Bindings were dead in both Preview and Export — values were always read from static
 * `node.props` (and baked into className/style/`data-split-*` at codegen time). Fixed in
 * `runtimePhase2Palette.tsx` (resolveTextProp/resolveNumberProp + pass previewBindings) and
 * `tsxPhase2Palette.ts` (emit runtime expressions when bound; skip dead attr leakage in
 * `bindingCodegen.ts`).
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

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

afterEach(() => cleanup());

describe('layout.split-pane direction/defaultSplit binding fix (parity audit item 38)', () => {
  it('preview: Store-bound direction/defaultSplit drive real layout attributes and pane size', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.split-pane');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'direction', 'layout.direction');
    state = bindStoreProp(state, nodeId, 'defaultSplit', 'layout.split');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: { layout: { direction: 'vertical', split: 35 } },
        })}
      </>,
    );

    const splitPane = container.querySelector('[data-designer-component="layout.split-pane"]');
    expect(splitPane).toBeTruthy();
    expect(splitPane?.getAttribute('data-split-direction')).toBe('vertical');
    expect(splitPane?.getAttribute('data-default-split')).toBe('35');
    expect(splitPane?.className).toContain('flex-col');

    const primaryPane = splitPane?.children[0] as HTMLElement | undefined;
    expect(primaryPane?.style.height).toBe('35%');
  });

  it('export: emits bound expressions into data-split-* and layout className/style (no dead direction= attr)', async () => {
    let state = insertItem(createInitialDesignerState(), 'layout.split-pane');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'direction', 'layout.direction');
    state = bindStoreProp(state, nodeId, 'defaultSplit', 'layout.split');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('split-pane bound direction/defaultSplit', tsx);

    expect(tsx).toContain('data-split-direction={');
    expect(tsx).toMatch(/designerStore\?\.layout\?\.direction/);
    expect(tsx).toContain('data-default-split={');
    expect(tsx).toMatch(/designerStore\?\.layout\?\.split/);
    expect(tsx).toContain('<UiSplitPane');
    expect(tsx).toContain('direction={');
    expect(tsx).toContain('defaultSplit={');
  });

  it('export: still bakes static direction/defaultSplit when unbound', async () => {
    let state = insertItem(createInitialDesignerState(), 'layout.split-pane');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'direction', value: 'vertical' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'defaultSplit', value: 40 });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax('split-pane static direction/defaultSplit', tsx);

    expect(tsx).toContain('data-split-direction="vertical"');
    expect(tsx).toContain('data-default-split={40}');
    expect(tsx).toContain('<UiSplitPane');
    expect(tsx).toContain('direction="vertical"');
    expect(tsx).toContain('defaultSplit={40}');
  });
});
