/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 18): `logic.visibility-container`'s own `visibleCondition`
 * (evaluated inside `DesignerUniversalVisibilityContainer`) was always evaluated with an empty
 * `scope` (`{}`) — neither the live/interactive preview nor the exported/published bundle ever
 * threaded the enclosing `logic.repeater`'s `item`/`index` through to it (unlike the *generic*
 * show/hide condition wrapper, which already did). Since `logic.visibility-container` can be a
 * child of `logic.repeater`, any `item.<field>`-scoped condition on a nested visibility-container
 * always saw `item` as `undefined`, the evaluator hit its catch clause, and the condition always
 * resolved to `false` — content stayed permanently hidden in both paths identically.
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const buildNestedDocument = (): { state: DesignerState; repeaterId: string; containerId: string; textId: string } => {
  let state = insertItem(createInitialDesignerState(), 'logic.repeater');
  const repeaterId = lastChildId(state);
  state = designerReducer(state, { type: 'set-node-prop', nodeId: repeaterId, key: 'dataPath', value: 'items' });

  state = insertItem(state, 'logic.visibility-container', repeaterId);
  const containerId = lastChildId(state, repeaterId);
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: containerId,
    key: 'visibleCondition',
    value: 'item.active === true',
  });

  state = insertItem(state, 'html.text', containerId);
  const textId = lastChildId(state, containerId);
  state = designerReducer(state, { type: 'set-node-prop', nodeId: textId, key: 'text', value: 'Active item marker' });

  return { state, repeaterId, containerId, textId };
};

describe('logic.visibility-container nested-repeater item-scope fix (parity audit item 18)', () => {
  afterEach(() => cleanup());

  it('preview: shows content only for repeater items where the item.-scoped condition is true', () => {
    const { state } = buildNestedDocument();

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          hydrationData: {
            items: [
              { active: true, label: 'first' },
              { active: false, label: 'second' },
            ],
          },
        })}
      </>,
    );

    const markers = container.querySelectorAll('[data-visible-condition]');
    expect(markers.length).toBe(1);
    expect(container.textContent).toContain('Active item marker');
  });

  it('preview: shows nothing for any item when all items fail the item.-scoped condition', () => {
    const { state } = buildNestedDocument();

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          hydrationData: {
            items: [
              { active: false, label: 'first' },
              { active: false, label: 'second' },
            ],
          },
        })}
      </>,
    );

    expect(container.textContent).not.toContain('Active item marker');
  });

  it('export: emits a real scope={{ item, index }} attribute on the nested visibility-container', () => {
    const { state } = buildNestedDocument();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('nested visibility-container with item-scoped condition', tsx);

    expect(tsx).toMatch(/<DesignerUniversalVisibilityContainer\b[^>]*\sscope=\{\(\{ item: item, index: index \}\)\}/);
    expect(tsx).toContain('item.active === true');
  });

  it('export: a top-level (non-nested) visibility-container emits no scope attribute at all', () => {
    let state = insertItem(createInitialDesignerState(), 'logic.visibility-container');
    const containerId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: containerId,
      key: 'visibleCondition',
      value: 'store.ui.panelOpen === true',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('top-level visibility-container', tsx);
    expect(tsx).not.toMatch(/<DesignerUniversalVisibilityContainer\b[^>]*\sscope=/);
  });
});
