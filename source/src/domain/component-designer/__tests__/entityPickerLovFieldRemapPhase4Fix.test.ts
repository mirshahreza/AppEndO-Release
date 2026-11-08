/**
 * Bug found (parity audit items 46/90): entity-picker LOV field mapping was hard-coded.
 * Behavioral check (esbuild-executed helper) — kept out of the jsdom suite because esbuild's
 * TextEncoder invariant breaks under Vitest's jsdom environment.
 */
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { renderEntityPickerRuntimeHelper } from '../bindingEntityPickerCodegen';

describe('entity-picker normalizeEntityPickerItems field remap (parity audit items 46/90)', () => {
  it('reads returnField/displayField from mapping when normalizing API rows', () => {
    const helperSource = renderEntityPickerRuntimeHelper().join('\n');
    const jsSource = transformSync(helperSource, { loader: 'ts' }).code;
    // eslint-disable-next-line no-new-func
    const module = new Function(`${jsSource}\nreturn { normalizeEntityPickerItems };`)() as {
      normalizeEntityPickerItems: (
        payload: unknown,
        mapping?: { returnField: string; displayField: string },
      ) => Array<{ id: string; textValue: string }>;
    };

    expect(module.normalizeEntityPickerItems(
      [{ code: 'u-1', title: 'Ada', id: 'wrong', label: 'wrong-label' }],
      { returnField: 'code', displayField: 'title' },
    )).toEqual([{ id: 'u-1', textValue: 'Ada' }]);

    // Backward-compat: without mapping, legacy id/value + textValue/label/name chain still works.
    expect(module.normalizeEntityPickerItems([
      { id: 'legacy-1', label: 'Legacy' },
    ])).toEqual([{ id: 'legacy-1', textValue: 'Legacy' }]);
  });
});
