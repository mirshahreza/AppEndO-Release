/**
 * @vitest-environment jsdom
 * Cluster D — heroui.card (title/description), heroui.accordion-item (title), and
 * heroui.typography-lead (text) Property Binding.
 *
 * Bug: all three fields are declared as bindable Inspector fields (generic 'string' type
 * gets a Bind button), but were resolved as plain static `node.props` reads with zero
 * binding awareness — in BOTH the live/interactive canvas preview and the exported/published
 * code. A user could configure "bind Card Title to user.fullName" and it would silently do
 * nothing anywhere.
 *  - Preview: fixed by adding a generic `resolveTextProp` method to
 *    DesignerPreviewBindingBridge (designerPreviewResolvers.ts) and consulting it from
 *    runtimeRenderer.tsx's heroui.card / heroui.accordion-item structural cases.
 *  - Export: fixed in tsxNodeRenderer.ts by resolving the Property Binding expression via
 *    resolveNodePropertyBindingExpression + renderBoundJsxTextExpression instead of always
 *    emitting the static literal (heroui.typography-lead now reuses the same
 *    renderTranslatableJsxTextContent helper already used for html.text/heading).
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const insertBoundItem = (
  itemId: 'heroui.card' | 'heroui.accordion-item' | 'heroui.typography-lead',
  targetProp: string,
  dataPath: string,
) => {
  let state: DesignerState = createInitialDesignerState();
  state = designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });
  const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'profile',
    dataSource: { id: 'profile', name: 'Profile', endpoint: '/api/profile', fields: [targetProp] },
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp(targetProp),
    definition: createPropertyBindingDefinition(targetProp, dataPath, { fetchEndpoint: '/api/profile' }),
  });
  return { state, nodeId };
};

describe('Cluster D — heroui.card/accordion-item/typography-lead text-prop binding', () => {
  afterEach(() => cleanup());

  it('heroui.card: bound title/description show the hydrated value in interactive preview, not the static default', () => {
    let state: DesignerState = createInitialDesignerState();
    state = designerReducer(state, { type: 'insert-palette-item', itemId: 'heroui.card', parentId: state.document.rootNodeId });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'profile',
      dataSource: { id: 'profile', name: 'Profile', endpoint: '/api/profile', fields: ['fullName', 'bio'] },
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('title'),
      definition: createPropertyBindingDefinition('title', 'fullName', { fetchEndpoint: '/api/profile' }),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('description'),
      definition: createPropertyBindingDefinition('description', 'bio', { fetchEndpoint: '/api/profile' }),
    });

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
          previewResults: {
            [`node:${nodeId}:prop:title`]: 'Ada Lovelace',
            [`node:${nodeId}:prop:description`]: 'Mathematician',
          },
        })}
      </>,
    );

    expect(container.textContent).toContain('Ada Lovelace');
    expect(container.textContent).toContain('Mathematician');
  });

  it('heroui.accordion-item: bound title shows the hydrated value in interactive preview', () => {
    const { state, nodeId } = insertBoundItem('heroui.accordion-item', 'title', 'sectionTitle');
    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
          previewResults: { [`node:${nodeId}:prop:title`]: 'Billing FAQ' },
        })}
      </>,
    );
    expect(container.textContent).toContain('Billing FAQ');
  });

  it('heroui.typography-lead: bound text shows the hydrated value in interactive preview', () => {
    const { state, nodeId } = insertBoundItem('heroui.typography-lead', 'text', 'summary');
    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
          previewResults: { [`node:${nodeId}:prop:text`]: 'Live summary from the API' },
        })}
      </>,
    );
    expect(container.textContent).toContain('Live summary from the API');
  });

  it('exported TSX for heroui.card wires title/description to the bound expression, not a static literal', () => {
    let state: DesignerState = createInitialDesignerState();
    state = designerReducer(state, { type: 'insert-palette-item', itemId: 'heroui.card', parentId: state.document.rootNodeId });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'profile',
      dataSource: { id: 'profile', name: 'Profile', endpoint: '/api/profile', fields: ['fullName'] },
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('title'),
      definition: createPropertyBindingDefinition('title', 'fullName', { fetchEndpoint: '/api/profile' }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Card.Title>{dataContext?.fullName');
  });

  it('exported TSX for heroui.accordion-item wires title to the bound expression', () => {
    const { state } = insertBoundItem('heroui.accordion-item', 'title', 'sectionTitle');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toMatch(/<Accordion\.Trigger>\{dataContext\?\.sectionTitle/);
  });

  it('exported TSX for heroui.typography-lead wires text to the bound expression', () => {
    const { state } = insertBoundItem('heroui.typography-lead', 'text', 'summary');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toMatch(/<p[^>]*>\{dataContext\?\.summary/);
  });
});
