import { describe, expect, it } from 'vitest';
import {
  createPropertyBindingDefinition,
  propertyBindingKeyForProp,
} from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

/**
 * Bug found: every scalar Inspector field on the 26 Universal/Content palette items (alerts,
 * banners, stat+trend, hero CTA, feature grid, stepper, icon, aspect ratio, etc.) gets the
 * generic Property Binding "Bind" toggle, but `tsxUniversalPalette.ts`'s export renderer only
 * ever consulted the separate Dual-Mode "bind to data source" mechanism — a field bound via the
 * generic mechanism got emitted TWICE (once correctly by the generic bound-attrs pass, once as a
 * stale static literal), and JS object-literal semantics make the later, static one win, silently
 * discarding the binding in every exported/published build. Fixed in `contentBoundOrLiteral` /
 * the `content.icon` `size` case.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindProp = (state: DesignerState, nodeId: string, prop: string, dataPath: string): DesignerState =>
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp(prop),
    definition: createPropertyBindingDefinition(prop, dataPath, { fetchEndpoint: `/api/v1/${prop}` }),
  });

/** No duplicate `prop=` attribute, and the bound expression (not the static literal) is what's emitted. */
const expectSingleBoundAttribute = (tsx: string, prop: string, staleLiteralSnippet: string) => {
  const attrMatches = tsx.match(new RegExp(`\\s${prop}=`, 'g')) ?? [];
  expect(attrMatches.length, `expected exactly one "${prop}=" attribute, found ${attrMatches.length}`).toBe(1);
  expect(tsx).not.toContain(staleLiteralSnippet);
};

describe('Universal/Content palette items — generic property binding export (bug fix regression)', () => {
  it('feedback.alert: a bound title is emitted once, not duplicated with the stale static literal', () => {
    let state = insert(createInitialDesignerState(), 'feedback.alert');
    const nodeId = lastChild(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Heads up' });
    state = bindProp(state, nodeId, 'title', 'notice.title');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expectSingleBoundAttribute(tsx, 'title', 'title="Heads up"');
  });

  it('content.stat-trend: a bound value is emitted once, not duplicated', () => {
    let state = insert(createInitialDesignerState(), 'content.stat-trend');
    const nodeId = lastChild(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: '1,204' });
    state = bindProp(state, nodeId, 'value', 'stats.total');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expectSingleBoundAttribute(tsx, 'value', 'value="1,204"');
  });

  it('content.icon: a bound size is emitted once, as a real number attribute, not duplicated', () => {
    let state = insert(createInitialDesignerState(), 'content.icon');
    const nodeId = lastChild(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'size', value: 32 });
    state = bindProp(state, nodeId, 'size', 'ui.iconSize');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expectSingleBoundAttribute(tsx, 'size', 'size={32}');
  });

  it('marketing.hero-cta: bound title/subtitle/primaryCta are each emitted once', () => {
    let state = insert(createInitialDesignerState(), 'marketing.hero-cta');
    const nodeId = lastChild(state);
    state = bindProp(state, nodeId, 'title', 'hero.title');
    state = bindProp(state, nodeId, 'subtitle', 'hero.subtitle');
    state = bindProp(state, nodeId, 'primaryCta', 'hero.cta');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expectSingleBoundAttribute(tsx, 'title', 'title="');
    expectSingleBoundAttribute(tsx, 'subtitle', 'subtitle="');
    expectSingleBoundAttribute(tsx, 'primaryCta', 'primaryCta="');
  });

  it('layout.aspect-ratio: a bound ratio is emitted once', () => {
    let state = insert(createInitialDesignerState(), 'layout.aspect-ratio');
    const nodeId = lastChild(state);
    state = bindProp(state, nodeId, 'ratio', 'media.ratio');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expectSingleBoundAttribute(tsx, 'ratio', 'ratio="');
  });
});
