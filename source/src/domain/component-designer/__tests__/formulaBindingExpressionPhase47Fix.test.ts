/**
 * Bug found (parity audit gap #3 / #12 — Phase 47): expression engine existed only for
 * visibility (`compileDesignerConditionExpression` / `visibleCondition`), while property
 * `sourceType: 'expression'` was a dotted path read — not a value formula. Calculated fields
 * (`sourceType: 'formula'`) and a Monaco expression editor were missing. Fixed in
 * bindingFormulaEngine.ts / types.ts / bindingCodegen.ts / designerPreviewResolvers.ts /
 * InspectorPropBindingControl + InspectorConditionalsPanel: formula bindings compile to real
 * TS in Export, evaluate live in Preview, and re-resolve when store/data deps change.
 */
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx, generateDesignerJsonString, parseDesignerJson } from '../codegen';
import {
  compileDesignerFormulaExpression,
  createFormulaBindingDefinition,
  evaluateDesignerFormulaValue,
  extractFormulaDependencyPaths,
  formatFormulaBoundPlaceholder,
} from '../bindingFormulaEngine';
import { compileDesignerConditionExpression, evaluateDesignerCondition } from '../visibilityConditionEngine';
import { createDesignerPreviewBindingBridge } from '../designerPreviewResolvers';
import { collectDocumentBindingPlan, resolveBoundCanvasTextContent } from '../bindingEngine';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindFormulaProp = (
  state: DesignerState,
  nodeId: string,
  prop: string,
  formula: string,
): DesignerState => {
  const binding = createFormulaBindingDefinition(prop, formula);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

describe('sourceType formula binding (Phase 47 / gaps #3+#12)', () => {
  it('compiles formulas with the shared expression engine (same rewrite as visibility)', () => {
    const formula = 'store.form.qty * store.form.price';
    const compiled = compileDesignerFormulaExpression(formula);
    expect(compiled).toBe(compileDesignerConditionExpression(formula));
    expect(compiled).toContain('designerStore');
    expect(compiled).toContain('qty');
    expect(compiled).toContain('price');

    expect(extractFormulaDependencyPaths(formula)).toEqual({
      store: ['form.qty', 'form.price'],
      data: [],
    });
    expect(extractFormulaDependencyPaths('= data.a + store.b')).toEqual({
      store: ['b'],
      data: ['a'],
    });
  });

  it('evaluates formula values at runtime (not Boolean-only)', () => {
    expect(evaluateDesignerFormulaValue(
      'store.form.qty * store.form.price',
      { form: { qty: 3, price: 4 } },
      null,
    )).toBe(12);

    expect(evaluateDesignerFormulaValue(
      'data.taxRate * store.subtotal',
      { subtotal: 100 },
      { taxRate: 0.09 },
    )).toBeCloseTo(9);
  });

  it('does not break existing visibleCondition boolean evaluation', () => {
    expect(evaluateDesignerCondition(
      { user: { role: 'admin' } },
      null,
      {},
      "store.user.role === 'admin'",
    )).toBe(true);

    expect(evaluateDesignerCondition(
      { user: { role: 'viewer' } },
      null,
      {},
      "store.user.role === 'admin'",
    )).toBe(false);
  });

  it('exports a formula-bound text prop as inlined compiled TS (not a path optional-chain)', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'text', value: '0' });
    state = bindFormulaProp(state, nodeId, 'text', 'store.form.qty * store.form.price');

    const plan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(plan.propertyBindings.some((item) => (
      item.nodeId === nodeId
      && item.targetProp === 'text'
      && item.definition.sourceType === 'formula'
    ))).toBe(true);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('formula text export', tsx);
    expect(tsx).toContain(compileDesignerFormulaExpression('store.form.qty * store.form.price'));
    expect(tsx).toContain('designerStore');
    // Must NOT treat the whole formula string as a single dataContext path segment.
    expect(tsx).not.toContain('dataContext?.store');
    expect(tsx).not.toMatch(/dataContext\?\.\["store\.form\.qty \* store\.form\.price"\]/);
  });

  it('resolves formula in Preview and re-evaluates when a dependency changes', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'text', value: '0' });
    state = bindFormulaProp(state, nodeId, 'text', 'store.form.qty * store.form.price');
    const node = state.document.nodes[nodeId]!;

    const bridgeA = createDesignerPreviewBindingBridge({
      previewResults: {},
      designerStore: { form: { qty: 2, price: 5 } },
      dataContext: {},
      document: state.document,
    });
    expect(bridgeA.resolveTextContent(node, 'fallback')).toBe('10');

    const bridgeB = createDesignerPreviewBindingBridge({
      previewResults: {},
      designerStore: { form: { qty: 2, price: 7 } },
      dataContext: {},
      document: state.document,
    });
    expect(bridgeB.resolveTextContent(node, 'fallback')).toBe('14');
  });

  it('shows a Formula canvas placeholder (not a dead static literal)', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'text', value: 'Hello' });
    state = bindFormulaProp(state, nodeId, 'text', 'store.form.qty * store.form.price');
    const node = state.document.nodes[nodeId]!;

    expect(resolveBoundCanvasTextContent(node, 'fallback')).toBe(
      formatFormulaBoundPlaceholder('store.form.qty * store.form.price'),
    );
  });

  it('round-trips formula bindings through JSON sanitize', () => {
    let state = insertItem(createInitialDesignerState(), 'html.text');
    const nodeId = lastChildId(state);
    state = bindFormulaProp(state, nodeId, 'text', 'store.a + store.b');

    const json = generateDesignerJsonString(state.document, state.bindingDefinitions);
    const parsed = parseDesignerJson(json);
    const binding = parsed.document.nodes[nodeId]?.binding['prop:text'];
    expect(binding?.sourceType).toBe('formula');
    expect(binding?.sourcePath).toBe('store.a + store.b');
    expect(binding?.formulaDependencies).toEqual(expect.arrayContaining(['store.a', 'store.b']));
  });

  it('persists extracted dependency triggers on create', () => {
    const { definition } = createFormulaBindingDefinition('value', 'store.x + data.y');
    expect(definition.formulaDependencies).toEqual(['store.x', 'data.y']);
  });
});
