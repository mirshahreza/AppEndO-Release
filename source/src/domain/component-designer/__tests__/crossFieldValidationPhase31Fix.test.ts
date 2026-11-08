/**
 * Bug found (parity audit / gap U12, Phase 31): No cross-field validation mechanism exists —
 * forms can only validate individual fields (required/min/max/pattern/expression per field),
 * but cannot enforce multi-field constraints like "password === confirmPassword" or
 * "endDate > startDate". This test validates the new `CrossFieldRule[]` engine in both
 * the live preview runtime path (`validateCrossFieldRules` / `validateRegionSubmitFields`)
 * and the codegen/export path (`renderCrossFieldValidationLines`).
 *
 * Fixed in previewFieldValidation.ts, bindingMutationRuntime.ts, bindingCodegen.ts,
 * types.ts, inspectorPaletteFields.ts.
 */

import { describe, expect, it } from 'vitest';
import type { CrossFieldRule } from '../types';
import { validateCrossFieldRules } from '../previewFieldValidation';
import type { RegionFormFieldMapping } from '../bindingRegionEngine';

const mapping = (nodeId: string, formFieldName: string): RegionFormFieldMapping => ({
  nodeId,
  formFieldName,
  column: formFieldName,
});

describe('Cross-Field Validation Engine (Phase 31)', () => {
  const mappings: RegionFormFieldMapping[] = [
    mapping('node-pw', 'password'),
    mapping('node-cpw', 'confirmPassword'),
    mapping('node-start', 'startDate'),
    mapping('node-end', 'endDate'),
  ];

  describe('rule: equals', () => {
    const rule: CrossFieldRule = {
      id: 'pw-match',
      fields: ['password', 'confirmPassword'],
      rule: 'equals',
      errorMessageKey: 'Passwords must match.',
      appliesTo: 'confirmPassword',
    };

    it('blocks submit when values differ', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { password: 'abc123', confirmPassword: 'xyz789' },
        mappings,
      );
      expect(errors['node-cpw']).toBe('Passwords must match.');
    });

    it('passes when values match', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { password: 'abc123', confirmPassword: 'abc123' },
        mappings,
      );
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('rule: notEquals', () => {
    const rule: CrossFieldRule = {
      id: 'diff-check',
      fields: ['password', 'confirmPassword'],
      rule: 'notEquals',
      errorMessageKey: 'Fields must differ.',
      appliesTo: 'confirmPassword',
    };

    it('blocks when values are equal', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { password: 'same', confirmPassword: 'same' },
        mappings,
      );
      expect(errors['node-cpw']).toBe('Fields must differ.');
    });

    it('passes when values differ', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { password: 'a', confirmPassword: 'b' },
        mappings,
      );
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('rule: greaterThan', () => {
    const rule: CrossFieldRule = {
      id: 'date-order',
      fields: ['endDate', 'startDate'],
      rule: 'greaterThan',
      errorMessageKey: 'End date must be after start date.',
      appliesTo: 'endDate',
    };

    it('blocks when first field is not greater', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { startDate: '10', endDate: '5' },
        mappings,
      );
      expect(errors['node-end']).toBe('End date must be after start date.');
    });

    it('passes when first field is greater', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { startDate: '5', endDate: '10' },
        mappings,
      );
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('rule: lessThan', () => {
    const rule: CrossFieldRule = {
      id: 'min-max',
      fields: ['startDate', 'endDate'],
      rule: 'lessThan',
      errorMessageKey: 'Start must be less than end.',
      appliesTo: 'startDate',
    };

    it('blocks when first field is not less', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { startDate: '10', endDate: '5' },
        mappings,
      );
      expect(errors['node-start']).toBe('Start must be less than end.');
    });

    it('passes when first field is less', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { startDate: '3', endDate: '5' },
        mappings,
      );
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('rule: expression', () => {
    const rule: CrossFieldRule = {
      id: 'custom-expr',
      fields: ['password', 'confirmPassword'],
      rule: 'expression',
      expression: 'data.password === data.confirmPassword',
      errorMessageKey: 'Custom: passwords must match.',
      appliesTo: 'confirmPassword',
    };

    it('blocks when expression evaluates to false', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { password: 'abc', confirmPassword: 'xyz' },
        mappings,
      );
      expect(errors['node-cpw']).toBe('Custom: passwords must match.');
    });

    it('passes when expression evaluates to true', () => {
      const errors = validateCrossFieldRules(
        [rule],
        { password: 'abc', confirmPassword: 'abc' },
        mappings,
      );
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('empty/missing rules', () => {
    it('returns empty errors when rules array is empty', () => {
      const errors = validateCrossFieldRules(
        [],
        { password: 'a', confirmPassword: 'b' },
        mappings,
      );
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('returns empty errors when rules is undefined', () => {
      const errors = validateCrossFieldRules(
        undefined as unknown as CrossFieldRule[],
        { password: 'a', confirmPassword: 'b' },
        mappings,
      );
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('multiple rules', () => {
    it('collects errors from multiple failing rules', () => {
      const rules: CrossFieldRule[] = [
        {
          id: 'pw-match',
          fields: ['password', 'confirmPassword'],
          rule: 'equals',
          errorMessageKey: 'Passwords must match.',
          appliesTo: 'confirmPassword',
        },
        {
          id: 'date-order',
          fields: ['endDate', 'startDate'],
          rule: 'greaterThan',
          errorMessageKey: 'End > Start required.',
          appliesTo: 'endDate',
        },
      ];
      const errors = validateCrossFieldRules(
        rules,
        { password: 'a', confirmPassword: 'b', startDate: '10', endDate: '5' },
        mappings,
      );
      expect(errors['node-cpw']).toBe('Passwords must match.');
      expect(errors['node-end']).toBe('End > Start required.');
    });
  });

  describe('regression: rules stored as a JSON string on the node prop (real Inspector contract)', () => {
    // Bug found while building a full document end-to-end (not caught by the pure-function
    // tests above): InspectorContentRecordsField.tsx — the actual UI panel a user interacts
    // with — always stores `crossFieldValidationRules` as `JSON.stringify(records)` on the
    // node prop (identical contract to `columns`/`toolbarConfig`), never a raw array. Both
    // real-world readers (resolveCrossFieldRulesForRegion in bindingCodegen.ts, and
    // resolveCrossFieldRules in bindingMutationRuntime.ts) checked `Array.isArray(rules)`
    // directly on that raw string, which is always false — cross-field validation therefore
    // never fired in Export or live Preview submission, even when correctly configured
    // through the Inspector. Fixed: both readers now parse a JSON-string prop (still also
    // accepting a raw array, for callers that construct a document directly).
    const rule: CrossFieldRule = {
      id: 'pw-match',
      fields: ['password', 'confirmPassword'],
      rule: 'equals',
      errorMessageKey: 'Passwords must match.',
      appliesTo: 'confirmPassword',
    };

    it('bindingCodegen.ts resolveCrossFieldRulesForRegion parses a JSON-string prop', async () => {
      const { resolveCrossFieldRulesForRegion } = await import('../bindingCodegen');
      const document = {
        schemaVersion: '1.0.0', id: 'd', name: 'd', rootNodeId: 'root',
        metadata: { createdAt: '', updatedAt: '' }, diagnostics: [],
        nodes: {
          root: { id: 'root', type: 'root', parentId: null, order: 0, props: {}, layout: {}, binding: {}, children: ['form'] },
          form: {
            id: 'form', type: 'form', parentId: 'root', order: 0, layout: {}, binding: {}, children: [],
            props: { crossFieldValidationRules: JSON.stringify([rule]) },
          },
        },
      } as unknown as Parameters<typeof resolveCrossFieldRulesForRegion>[0];

      expect(resolveCrossFieldRulesForRegion(document, 'form')).toEqual([rule]);
      // A raw array (direct construction, no Inspector round-trip) still works too.
      const rawArrayDoc = {
        ...document,
        nodes: { ...document.nodes, form: { ...document.nodes.form, props: { crossFieldValidationRules: [rule] } } },
      } as typeof document;
      expect(resolveCrossFieldRulesForRegion(rawArrayDoc, 'form')).toEqual([rule]);
      // Malformed JSON must not throw — degrades to no rules.
      const malformedDoc = {
        ...document,
        nodes: { ...document.nodes, form: { ...document.nodes.form, props: { crossFieldValidationRules: '{not json' } } },
      } as typeof document;
      expect(resolveCrossFieldRulesForRegion(malformedDoc, 'form')).toEqual([]);
    });

    it('bindingMutationRuntime.ts resolveCrossFieldRules parses a JSON-string prop', async () => {
      const { resolveCrossFieldRules } = await import('../bindingMutationRuntime');
      const document = {
        schemaVersion: '1.0.0', id: 'd', name: 'd', rootNodeId: 'root',
        metadata: { createdAt: '', updatedAt: '' }, diagnostics: [],
        nodes: {
          root: { id: 'root', type: 'root', parentId: null, order: 0, props: {}, layout: {}, binding: {}, children: ['form'] },
          form: {
            id: 'form', type: 'form', parentId: 'root', order: 0, layout: {}, binding: {}, children: [],
            props: { crossFieldValidationRules: JSON.stringify([rule]) },
          },
        },
      } as unknown as Parameters<typeof resolveCrossFieldRules>[0];

      expect(resolveCrossFieldRules(document, 'form')).toEqual([rule]);
    });
  });
});
