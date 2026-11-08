import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../bindingEngine';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 16): `content.stepper`'s `activeStep`, `form.rating`'s
 * `label`/`max`, `form.otp-input`'s `label`/`length`, and `form.time-input`/
 * `form.datetime-input`'s `label` were all baked into the exported JSX as raw static literals
 * (unlike their sibling `value` field on the same elements, which was already correctly wrapped
 * in `boundOrDefaultValueLiteral`). When bound, the generic bound-attribute pass appended the
 * real expression, then the static literal (written second) won under JSX's
 * last-attribute-wins rule — a bound value was silently overridden and never reached the real
 * component, even though it worked correctly in the live canvas/interactive Preview.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindProp = (state: DesignerState, nodeId: string, prop: string, dataPath: string): DesignerState =>
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp(prop),
    definition: createPropertyBindingDefinition(prop, dataPath),
  });

const countAttrOccurrences = (tsx: string, componentName: string, prop: string): number => {
  const tagMatch = tsx.match(new RegExp(`<${componentName}\\b[\\s\\S]*?/>`));
  if (!tagMatch) {
    throw new Error(`expected a <${componentName} ... /> tag in generated tsx`);
  }
  return (tagMatch[0].match(new RegExp(`\\s${prop}=`, 'g')) ?? []).length;
};

describe('universal widgets duplicate attribute export fix (parity audit item 16)', () => {
  it('content.stepper: bound activeStep emits exactly once, using the bound expression', () => {
    let state = insertItem(createInitialDesignerState(), 'content.stepper');
    const nodeId = lastChildId(state);
    state = bindProp(state, nodeId, 'activeStep', 'wizard.step');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('content.stepper bound activeStep', tsx);

    expect(countAttrOccurrences(tsx, 'DesignerUniversalStepper', 'activeStep')).toBe(1);
    expect(tsx).toMatch(/activeStep=\{dataContext\?\.wizard\?\.step\}/);
  });

  it('form.rating: bound label and max each emit exactly once, using the bound expression', () => {
    let state = insertItem(createInitialDesignerState(), 'form.rating');
    const nodeId = lastChildId(state);
    state = bindProp(state, nodeId, 'label', 'rating.label');
    state = bindProp(state, nodeId, 'max', 'rating.max');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('form.rating bound label+max', tsx);

    expect(countAttrOccurrences(tsx, 'DesignerUniversalRating', 'label')).toBe(1);
    expect(countAttrOccurrences(tsx, 'DesignerUniversalRating', 'max')).toBe(1);
    expect(tsx).toMatch(/label=\{dataContext\?\.rating\?\.label\}/);
    expect(tsx).toMatch(/max=\{dataContext\?\.rating\?\.max\}/);
  });

  it('form.otp-input: bound label and length each emit exactly once, using the bound expression', () => {
    let state = insertItem(createInitialDesignerState(), 'form.otp-input');
    const nodeId = lastChildId(state);
    state = bindProp(state, nodeId, 'label', 'otp.label');
    state = bindProp(state, nodeId, 'length', 'otp.length');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('form.otp-input bound label+length', tsx);

    expect(countAttrOccurrences(tsx, 'DesignerUniversalOtpInput', 'label')).toBe(1);
    expect(countAttrOccurrences(tsx, 'DesignerUniversalOtpInput', 'length')).toBe(1);
  });

  it('form.time-input: bound label emits exactly once, using the bound expression', () => {
    let state = insertItem(createInitialDesignerState(), 'form.time-input');
    const nodeId = lastChildId(state);
    state = bindProp(state, nodeId, 'label', 'time.label');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('form.time-input bound label', tsx);

    expect(countAttrOccurrences(tsx, 'DesignerUniversalTimeInput', 'label')).toBe(1);
  });

  it('form.datetime-input: bound label emits exactly once, using the bound expression', () => {
    let state = insertItem(createInitialDesignerState(), 'form.datetime-input');
    const nodeId = lastChildId(state);
    state = bindProp(state, nodeId, 'label', 'datetime.label');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('form.datetime-input bound label', tsx);

    expect(countAttrOccurrences(tsx, 'DesignerUniversalDateTimeInput', 'label')).toBe(1);
  });

  it('static (unbound) widgets still export the literal label/max/length/activeStep unchanged', () => {
    const state = insertItem(createInitialDesignerState(), 'form.rating');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('static form.rating', tsx);

    expect(countAttrOccurrences(tsx, 'DesignerUniversalRating', 'label')).toBe(1);
    expect(countAttrOccurrences(tsx, 'DesignerUniversalRating', 'max')).toBe(1);
    expect(tsx).toMatch(/max=\{5\}/);
  });
});
