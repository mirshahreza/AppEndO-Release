/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 5): `content.segmented-control` is a Dual-Mode content-bindable
 * widget (its `options` CSV can come from an API row list, exactly like every other Dual-Mode
 * widget in `DUAL_MODE_CONTENT_PALETTE_IDS`), and Export already correctly computes a real
 * `options={...}` expression from the bound rows. But the interactive/live preview always passed
 * the raw `node`/`options` straight into `DesignerRuntimeSegmentedControl`
 * (`designerUniversalRuntime.tsx`'s `case 'content.segmented-control'`), bypassing
 * `resolveBoundUniversalOverrides` — the Dual-Mode override layer every other widget in that
 * switch statement flows through via the computed `props` variable. So a bound segmented-control
 * always rendered its static default labels ("Day"/"Week"/"Month") in the live/published preview,
 * never the real hydrated API data. Fixed by threading a new `optionsOverride` prop through.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  buildContentBindingConnectActions,
  resolveContentListDataVarName,
} from '../bindingContentEngine';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';

const insertNode = (state: ReturnType<typeof createInitialDesignerState>, itemId: string, parentId: string) => {
  const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
  const parent = next.document.nodes[parentId];
  const childId = parent.children[parent.children.length - 1];
  return { state: next, nodeId: childId };
};

const seedPostsDataSource = (state: ReturnType<typeof createInitialDesignerState>) =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'posts',
    dataSource: {
      id: 'posts',
      name: 'Posts',
      endpoint: '/api/posts',
      fields: ['id', 'title', 'summary', 'date', 'label', 'value', 'iconName', 'mediaSrc'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/posts' } },
    },
  });

describe('content.segmented-control Dual-Mode binding fix (parity audit item 5)', () => {
  it('bound segmented-control preview renders real hydrated API labels, not the static default', () => {
    let state = createInitialDesignerState();
    const inserted = insertNode(state, 'content.segmented-control', state.document.rootNodeId);
    state = inserted.state;
    const nodeId = inserted.nodeId;
    state = seedPostsDataSource(state);

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
          bindingDefinitions: state.bindingDefinitions,
          hydrationData,
        })}
      </>,
    );

    expect(container.textContent).toContain('Sprint');
    expect(container.textContent).toContain('Quarter');
    expect(container.textContent).toContain('Year');
    expect(container.textContent).not.toContain('Day');
    expect(container.textContent).not.toContain('Week');
    expect(container.textContent).not.toContain('Month');
  });

  it('static (unbound) segmented-control preview is unaffected — keeps default labels', () => {
    let state = createInitialDesignerState();
    const inserted = insertNode(state, 'content.segmented-control', state.document.rootNodeId);
    state = inserted.state;

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);

    expect(container.textContent).toContain('Day');
    expect(container.textContent).toContain('Week');
    expect(container.textContent).toContain('Month');
  });
});
