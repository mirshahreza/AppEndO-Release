/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';

const PHASE_1_PARITY_IDS = [
  'heroui.breadcrumbs',
  'heroui.pagination',
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.tags-input',
  'heroui.tooltip-trigger',
] as const;

const insertPaletteItem = (state: ReturnType<typeof createInitialDesignerState>, itemId: string) =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

describe('designer runtime parity snapshots', () => {
  it('matches the shell chrome preview placeholder snapshot', () => {
    const state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;
    const slotId = 'shell-header-slot';

    state.document.nodes[rootId] = {
      ...state.document.nodes[rootId],
      children: [slotId],
    };
    state.document.nodes[slotId] = {
      id: slotId,
      type: 'system-slot' as never,
      parentId: rootId,
      order: 0,
      props: {
        slotId: 'core.shell.header',
        className: 'min-h-10 rounded-md border border-dashed border-slate-200 px-3 py-2',
      },
      layout: {},
      binding: {},
      children: [],
    };

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches the layout grid preview snapshot', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.grid-2',
      parentId: state.document.rootNodeId,
    });
    const gridId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: gridId,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: gridId,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it.each(PHASE_1_PARITY_IDS)('renders HeroUI preview markup for %s', (itemId) => {
    let state = createInitialDesignerState();
    state = insertPaletteItem(state, itemId);
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    if (itemId === 'heroui.tags-input') {
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'value',
        value: 'alpha,beta',
      });
    }

    if (itemId === 'heroui.pagination') {
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'page',
        value: 2,
      });
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'total',
        value: 42,
      });
    }

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('[data-designer-component]')).toBeTruthy();
    expect(container.firstChild).toMatchSnapshot();
  });

  it.each(PHASE_1_PARITY_IDS)('exports matching HeroUI TSX for %s', (itemId) => {
    let state = createInitialDesignerState();
    state = insertPaletteItem(state, itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    switch (itemId) {
      case 'heroui.breadcrumbs':
        expect(tsx).toContain('<Breadcrumbs');
        expect(tsx).toContain('<Breadcrumbs.Item');
        break;
      case 'heroui.pagination':
        expect(tsx).toContain('<Pagination');
        expect(tsx).toContain('<Pagination.Summary');
        break;
      case 'heroui.checkbox-group':
        expect(tsx).toContain('<CheckboxGroup');
        expect(tsx).toContain('<Checkbox');
        break;
      case 'heroui.radio-group':
        expect(tsx).toContain('<RadioGroup');
        expect(tsx).toContain('<Radio');
        break;
      case 'heroui.tags-input':
        expect(tsx).toContain('<TagGroup');
        expect(tsx).toContain('<TagGroup.List');
        break;
      case 'heroui.tooltip-trigger':
        expect(tsx).toContain('<Tooltip.Root');
        expect(tsx).toContain('<Tooltip.Trigger');
        expect(tsx).toContain('<Tooltip.Content');
        break;
      default:
        break;
    }
  });
});
