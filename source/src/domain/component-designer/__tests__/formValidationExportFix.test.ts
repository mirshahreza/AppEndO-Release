import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { getPaletteItemById } from '../catalog';
import {
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
  REGION_DATA_SOURCE_BINDING_KEY,
} from '../bindingRegionEngine';
import { eventBindingKeyForEvent, propertyBindingKeyForProp } from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item P3.14): `isRequired`/`pattern`/`minLength`/`maxLength`/
 * `validationRule` are real, submission-blocking validation in the live preview
 * (`previewFieldValidation.ts`, wired into `bindingMutationRuntime.ts`), but the exported
 * `.tsx` Region submit handlers never called any validation at all — an exported Create/Edit
 * form always submitted regardless of these Inspector-configured rules, because HeroUI's
 * `isRequired` only emits `aria-required` (not a real native `required` attribute) and the
 * codegen never called `reportValidity()`/any validation function.
 */

const insertNode = (state: DesignerState, itemId: string, parentId: string) => {
  const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
  const parent = next.document.nodes[parentId];
  const childId = parent.children[parent.children.length - 1] as string;
  return { state: next, nodeId: childId };
};

const buildRegionFormState = () => {
  let state = createInitialDesignerState();
  expect(getPaletteItemById('html.form')).toBeTruthy();

  const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
  state = formInsert.state;
  const formId = formInsert.nodeId;

  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: formId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition('users'),
  });

  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'users',
    dataSource: {
      id: 'users',
      name: 'Users',
      endpoint: '/api/users',
      primaryKey: 'ID',
      fields: ['ID', 'FIRST_NAME', 'EMAIL'],
    },
  });

  const inputInsert = insertNode(state, 'heroui.input-text', formId);
  state = inputInsert.state;

  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: inputInsert.nodeId,
    bindingKey: propertyBindingKeyForProp('value'),
    definition: createRegionColumnBindingDefinition('value', 'FIRST_NAME'),
  });

  const buttonInsert = insertNode(state, 'heroui.button-solid', formId);
  state = buttonInsert.state;

  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: buttonInsert.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createRegionSubmitEventBindingDefinition('onClick'),
  });

  return { state, formId, fieldNodeId: inputInsert.nodeId, buttonNodeId: buttonInsert.nodeId };
};

describe('Region submit form validation export fix', () => {
  it('blocks the region submit button handler when a bound field is marked Required', () => {
    const { state, fieldNodeId } = buildRegionFormState();
    let next = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: fieldNodeId,
      key: 'isRequired',
      value: true,
    });

    const tsx = generateDesignerTsx(next.document, next.bindingDefinitions);
    assertValidTsxSyntax('region submit required validation', tsx);

    expect(tsx).toContain(
      "import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';",
    );
    expect(tsx).toContain(`"nodeId":"${fieldNodeId}"`);
    expect(tsx).toContain('"isRequired":true');
    expect(tsx).toContain('validateDesignerFieldNode(entry.props,');

    // The validation block must run and be able to `return` BEFORE the real fetch is reached,
    // inside this specific handler (searching from the validation block forward, since
    // `designerFetch(` also appears earlier as part of the generic `useDataFetch` hook helper
    // definition near the top of the file — an unrelated, always-present preamble helper).
    const validationIndex = tsx.indexOf('fieldValidationErrors');
    const fetchIndex = tsx.indexOf('await designerFetch(url', validationIndex);
    expect(validationIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeLessThan(fetchIndex);
  });

  it('embeds pattern/minLength/maxLength constraints for export-time validation', () => {
    const { state, fieldNodeId } = buildRegionFormState();
    let next = designerReducer(state, { type: 'set-node-prop', nodeId: fieldNodeId, key: 'pattern', value: '^[A-Z]+$' });
    next = designerReducer(next, { type: 'set-node-prop', nodeId: fieldNodeId, key: 'minLength', value: 2 });
    next = designerReducer(next, { type: 'set-node-prop', nodeId: fieldNodeId, key: 'maxLength', value: 10 });

    const tsx = generateDesignerTsx(next.document, next.bindingDefinitions);
    assertValidTsxSyntax('region submit pattern/length validation', tsx);

    expect(tsx).toContain('"pattern":"^[A-Z]+$"');
    expect(tsx).toContain('"minLength":2');
    expect(tsx).toContain('"maxLength":10');
  });

  it('is an honest no-op (no validateDesignerFieldNode import or call) when no field has any validation constraint', () => {
    const { state } = buildRegionFormState();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('region submit no validation constraints', tsx);

    expect(tsx).not.toContain('validateDesignerFieldNode');
    expect(tsx).not.toContain('previewFieldValidation');
  });
});
