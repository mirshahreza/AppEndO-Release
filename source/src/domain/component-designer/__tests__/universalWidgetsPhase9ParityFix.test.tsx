/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit items 79/80/81/82):
 * - 79/80: `content.segmented-control`'s Property-Bound `selected` and legacy CSV `options`
 *   still read `node.props` raw in Canvas/Preview after the systemic Universal binding fix —
 *   Export already resolved them. Fixed via `text()` in `resolveUniversalPropsFromNode` +
 *   `selectedOverride` on `DesignerRuntimeSegmentedControl` (Dual-Mode `optionsOverride` kept).
 * - 81: `logic.visibility-container`'s bindable `visibleCondition` had the same dead-binding gap.
 * - 82: Dual-Mode CSV label priority diverged — Preview `label→name→title→heading→id` vs Export
 *   `label→title→name→id` (no heading). Export expression + Preview picker now share one order.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import {
  buildContentBindingConnectActions,
  resolveContentCsvExpression,
  resolveContentCsvFromRows,
  resolveContentCsvLabelFromRow,
  resolveContentListDataVarName,
} from '../bindingContentEngine';
import { generateDesignerTsx } from '../codegen';
import { evaluateCodegenExpression } from '../bindingParity/harness';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId = state.document.rootNodeId): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
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

const seedPostsDataSource = (state: DesignerState) =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'posts',
    dataSource: {
      id: 'posts',
      name: 'Posts',
      endpoint: '/api/posts',
      fields: ['id', 'title', 'summary', 'date', 'label', 'value', 'name', 'heading'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/posts' } },
    },
  });

describe('Universal widgets phase 9 parity fix (items 79–82)', () => {
  describe('items 79/80 — segmented-control selected + options Property Binding', () => {
    it('Store-bound selected highlights the live segment in interactive preview (not the static literal)', () => {
      let state = insertItem(createInitialDesignerState(), 'content.segmented-control');
      const nodeId = lastChildId(state);
      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'options', value: 'Day,Week,Month' });
      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'selected', value: 'Week' });
      state = bindStoreProp(state, nodeId, 'selected', 'ui.period');

      const { container } = render(
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            designerStore: { ui: { period: 'Month' } },
          })}
        </>,
      );

      const selected = container.querySelector('[aria-selected="true"]');
      expect(selected?.textContent).toBe('Month');
      expect(container.querySelector('[aria-selected="true"]')?.textContent).not.toBe('Week');
    });

    it('Store-bound legacy CSV options render live labels in interactive preview', () => {
      let state = insertItem(createInitialDesignerState(), 'content.segmented-control');
      const nodeId = lastChildId(state);
      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'options', value: 'Day,Week,Month' });
      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'selected', value: 'Alpha' });
      state = bindStoreProp(state, nodeId, 'options', 'ui.optionCsv');

      const { container } = render(
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            designerStore: { ui: { optionCsv: 'Alpha,Beta,Gamma' } },
          })}
        </>,
      );

      expect(container.textContent).toContain('Alpha');
      expect(container.textContent).toContain('Beta');
      expect(container.textContent).toContain('Gamma');
      expect(container.textContent).not.toContain('Day');
      expect(container.textContent).not.toContain('Week');
    });

    it('unbound selected/options still use static Inspector values (honest no-op)', () => {
      let state = insertItem(createInitialDesignerState(), 'content.segmented-control');
      const nodeId = lastChildId(state);
      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'options', value: 'One,Two,Three' });
      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'selected', value: 'Two' });

      const { container } = render(
        <>
          {renderDesignerDocumentPreview(state.document, { interactive: true })}
        </>,
      );

      expect(container.textContent).toContain('One');
      expect(container.textContent).toContain('Two');
      expect(container.textContent).toContain('Three');
      expect(container.querySelector('[aria-selected="true"]')?.textContent).toBe('Two');
    });

    it('Dual-Mode optionsOverride still wins for options while Property-Bound selected stays live', () => {
      let state = insertItem(createInitialDesignerState(), 'content.segmented-control');
      const nodeId = lastChildId(state);
      state = seedPostsDataSource(state);
      state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'selected', value: 'Week' });
      state = bindStoreProp(state, nodeId, 'selected', 'ui.period');

      for (const action of buildContentBindingConnectActions(
        state.document.nodes[nodeId]!,
        state.bindingDefinitions.dataSources.posts!,
      )) {
        state = designerReducer(state, action);
      }

      const hydrationData = {
        [resolveContentListDataVarName(nodeId)]: [
          { label: 'Sprint' },
          { label: 'Quarter' },
          { label: 'Year' },
        ],
      };

      const { container } = render(
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            bindingDefinitions: state.bindingDefinitions,
            hydrationData,
            designerStore: { ui: { period: 'Year' } },
          })}
        </>,
      );

      expect(container.textContent).toContain('Sprint');
      expect(container.textContent).toContain('Quarter');
      expect(container.textContent).toContain('Year');
      expect(container.textContent).not.toContain('Day');
      expect(container.querySelector('[aria-selected="true"]')?.textContent).toBe('Year');
    });
  });

  describe('item 81 — visibility-container visibleCondition Property Binding', () => {
    it('Store-bound visibleCondition expression string is evaluated live in interactive preview', () => {
      let state = insertItem(createInitialDesignerState(), 'logic.visibility-container');
      const containerId = lastChildId(state);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId: containerId,
        key: 'visibleCondition',
        value: 'store.ui.showPanel === true',
      });
      state = bindStoreProp(state, containerId, 'visibleCondition', 'ui.conditionExpr');
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId: 'html.text',
        parentId: containerId,
      });
      const textId = lastChildId(state, containerId);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId: textId,
        key: 'text',
        value: 'Panel body',
      });

      const hidden = render(
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            designerStore: {
              ui: {
                conditionExpr: 'store.flag.enabled === true',
                // bound expression checks store.flag.enabled — leave it false
              },
              flag: { enabled: false },
            },
          })}
        </>,
      );
      expect(hidden.container.textContent).not.toContain('Panel body');
      hidden.unmount();

      const shown = render(
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            designerStore: {
              ui: { conditionExpr: 'store.flag.enabled === true' },
              flag: { enabled: true },
            },
          })}
        </>,
      );
      expect(shown.container.textContent).toContain('Panel body');
    });

    it('unbound visibleCondition still uses the static Inspector expression', () => {
      let state = insertItem(createInitialDesignerState(), 'logic.visibility-container');
      const containerId = lastChildId(state);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId: containerId,
        key: 'visibleCondition',
        value: 'store.ui.showPanel === true',
      });
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId: 'html.text',
        parentId: containerId,
      });
      const textId = lastChildId(state, containerId);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId: textId,
        key: 'text',
        value: 'Static panel',
      });

      const { container } = render(
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            designerStore: { ui: { showPanel: true } },
          })}
        </>,
      );
      expect(container.textContent).toContain('Static panel');
    });
  });

  describe('item 82 — Dual-Mode CSV label priority Preview/Export parity', () => {
    it('Preview and Export share label → name → title → heading → id priority', () => {
      const rows: Record<string, unknown>[] = [
        { label: 'L', name: 'N', title: 'T', heading: 'H', id: 'I' },
        { name: 'N2', title: 'T2', heading: 'H2', id: 'I2' },
        { title: 'T3', heading: 'H3', id: 'I3' },
        { heading: 'H4', id: 'I4' },
        { id: 'I5' },
        { label: '', name: '', title: '', heading: 'H6', id: 'I6' },
      ];

      expect(resolveContentCsvFromRows(rows)).toBe('L,N2,T3,H4,I5,H6');
      expect(rows.map((row) => resolveContentCsvLabelFromRow(row))).toEqual([
        'L',
        'N2',
        'T3',
        'H4',
        'I5',
        'H6',
      ]);

      const expr = resolveContentCsvExpression('contentData_x');
      expect(expr).toContain('row.label');
      expect(expr).toContain('row.name');
      expect(expr).toContain('row.title');
      expect(expr).toContain('row.heading');
      expect(expr).toContain('row.id');
      // name must be considered before title (old Export had title before name)
      expect(expr.indexOf('row.name')).toBeLessThan(expr.indexOf('row.title'));

      const codegenCsv = evaluateCodegenExpression(expr, { contentData_x: rows });
      expect(codegenCsv).toBe(resolveContentCsvFromRows(rows));
    });

    it('bound content.stepper Export expression evaluates to the same CSV as Preview', () => {
      let state = insertItem(createInitialDesignerState(), 'content.stepper');
      const nodeId = lastChildId(state);
      state = seedPostsDataSource(state);

      for (const action of buildContentBindingConnectActions(
        state.document.nodes[nodeId]!,
        state.bindingDefinitions.dataSources.posts!,
      )) {
        state = designerReducer(state, action);
      }

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('row.heading');
      expect(tsx).toMatch(/row\.label[\s\S]*?row\.name[\s\S]*?row\.title[\s\S]*?row\.heading[\s\S]*?row\.id/);
    });
  });
});
