import { describe, expect, it } from 'vitest';
import { applyTailwindUtility, detectTailwindConflicts, resolveTailwindUtilityValue } from '../tailwindClasses';
import { TAILWIND_INSPECTOR_FIELDS } from '../inspectorRegistry';

describe('tailwindClasses', () => {
  const displayField = TAILWIND_INSPECTOR_FIELDS.find((field) => field.key === 'twDisplay');
  const paddingField = TAILWIND_INSPECTOR_FIELDS.find((field) => field.key === 'twPadding');

  it('resolves and applies display utilities on className', () => {
    expect(displayField).toBeDefined();
    if (!displayField) {
      return;
    }

    const initial = 'rounded-md p-2 block';
    expect(resolveTailwindUtilityValue(initial, displayField)).toBe('block');

    const next = applyTailwindUtility(initial, displayField, 'flex');
    expect(next).toContain('flex');
    expect(next).not.toContain('block');
    expect(next).toContain('rounded-md');
  });

  it('removes utility when cleared', () => {
    expect(paddingField).toBeDefined();
    if (!paddingField) {
      return;
    }

    const next = applyTailwindUtility('p-4 text-sm', paddingField, '');
    expect(next).toBe('text-sm');
  });

  it('detects conflicting utilities in the same group', () => {
    expect(displayField).toBeDefined();
    if (!displayField) {
      return;
    }

    const warnings = detectTailwindConflicts('flex block grid');
    expect(warnings.some((warning) => warning.includes('Display'))).toBe(true);
  });
});
