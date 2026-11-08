import { describe, expect, it } from 'vitest';
import { BASE_COMPONENTS_NAV_SECTIONS } from '../baseComponentsSections';
import { filterBaseComponentsNav } from '../filterBaseComponentsNav';

describe('filterBaseComponentsNav', () => {
  it('returns every nav group when the query is empty', () => {
    const groups = filterBaseComponentsNav('   ');
    expect(groups.flatMap((group) => group.sections)).toEqual(BASE_COMPONENTS_NAV_SECTIONS);
  });

  it('matches section labels, slugs, and groups', () => {
    const byLabel = filterBaseComponentsNav('where builder');
    expect(byLabel.flatMap((group) => group.sections.map((section) => section.id))).toEqual(['where-builder']);

    const bySlug = filterBaseComponentsNav('floating-panel');
    expect(bySlug.flatMap((group) => group.sections.map((section) => section.id))).toEqual(['floating-panel']);

    const byGroup = filterBaseComponentsNav('pickers');
    expect(byGroup.map((group) => group.group.id)).toEqual(['pickers']);
    expect(byGroup[0]?.sections.map((section) => section.id)).toEqual([
      'color-picker',
      'variable-color-picker',
      'gradient-picker',
      'border-shadow-picker',
      'calendar-grid',
      'range-calendar-grid',
      'code-scanner',
    ]);

    const formFieldsGroup = filterBaseComponentsNav('form fields');
    expect(formFieldsGroup.map((group) => group.group.id)).toContain('form-fields');
    expect(formFieldsGroup.find((group) => group.group.id === 'form-fields')?.sections.map((section) => section.id)).toEqual([
      'text-fields',
      'choice-fields',
      'selection-fields',
      'structured-fields',
      'ai-fields',
      'ai-chat-panel',
      'search',
      'date-time',
      'file-media-input',
      'transfer-list',
      'otp-input',
      'field-container',
      'tree-select',
      'cascader',
      'tree-combobox',
      'rating',
      'signature-pad',
    ]);
  });

  it('matches catalog exports and purpose copy', () => {
    const byExport = filterBaseComponentsNav('UiWhereBuilder');
    expect(byExport.flatMap((group) => group.sections.map((section) => section.id))).toEqual(['where-builder']);

    const byTextExport = filterBaseComponentsNav('UiInput');
    expect(byTextExport.flatMap((group) => group.sections.map((section) => section.id))).toEqual(['text-fields']);

    const byPurpose = filterBaseComponentsNav('AppButton');
    expect(byPurpose.flatMap((group) => group.sections.map((section) => section.id))).toContain('buttons');
  });

  it('requires every token to match', () => {
    expect(filterBaseComponentsNav('color picker').flatMap((group) => group.sections.map((section) => section.id)))
      .toEqual(['color-picker', 'variable-color-picker']);
    expect(filterBaseComponentsNav('no-such-component')).toEqual([]);
  });

  it('keeps group order from the canonical nav', () => {
    expect(filterBaseComponentsNav('').flatMap((group) => group.sections.map((section) => section.id)))
      .toEqual(BASE_COMPONENTS_NAV_SECTIONS.map((section) => section.id));
  });
});
