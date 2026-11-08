import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BELONGS_TO_FORM_WIDGET,
  coerceRelationFormWidget,
  defaultRelationFormWidgetLabel,
  isRelationFormWidgetAllowedForKind,
  relationFormWidgetOptionsForKind,
  resolveBelongsToFormWidget,
  resolveRelationFormWidgetForKind,
} from '../relationFormWidgets';

describe('relationFormWidgets', () => {
  it('offers belongs-to pickers only for belongs-to / physical', () => {
    const one = relationFormWidgetOptionsForKind('belongsTo').map((item) => item.value);
    expect(one[0]).toBe('select');
    expect(one[1]).toBe('typeahead');
    expect(one).toContain('lookup');
    expect(one).toContain('dropdownButton');
    expect(one).toContain('buttonGroup');
    expect(one).not.toContain('checkboxList');
    expect(one).not.toContain('relatedGrid');
    expect(one).not.toContain('nestedCard');

    const physical = relationFormWidgetOptionsForKind('physical').map((item) => item.value);
    expect(physical).toContain('buttonGroup');
    expect(physical).not.toContain('relatedGrid');
  });

  it('offers a single related grid for has-many (no separate inline table)', () => {
    const many = relationFormWidgetOptionsForKind('hasMany').map((item) => item.value);
    expect(many[0]).toBe('relatedGrid');
    expect(many).toContain('cardList');
    expect(many).toContain('repeater');
    expect(many).not.toContain('inlineTable');
    expect(many).not.toContain('checkboxList');
    expect(many).not.toContain('tagsList');
    expect(many).not.toContain('tags');
    expect(many).not.toContain('select');
    expect(many).not.toContain('nestedCard');
  });

  it('offers nested editors only for has-one', () => {
    const hasOne = relationFormWidgetOptionsForKind('hasOne').map((item) => item.value);
    expect(hasOne[0]).toBe('nestedCard');
    expect(hasOne).toContain('nestedForm');
    expect(hasOne).not.toContain('relatedGrid');
    expect(hasOne).not.toContain('checkboxList');
    expect(hasOne).not.toContain('select');
  });

  it('offers attach pickers only for belongs-to-many', () => {
    const m2m = relationFormWidgetOptionsForKind('belongsToMany').map((item) => item.value);
    expect(m2m[0]).toBe('checkboxList');
    expect(m2m).toContain('tagsList');
    expect(m2m).toContain('tags');
    expect(m2m).toContain('dualList');
    expect(m2m).not.toContain('attachList');
    expect(m2m).not.toContain('relatedGrid');
    expect(m2m).not.toContain('inlineTable');
    expect(m2m).not.toContain('cardList');
    expect(m2m).not.toContain('lookup');
  });

  it('defaults Auto labels by kind', () => {
    expect(defaultRelationFormWidgetLabel('belongsTo')).toBe('Select');
    expect(defaultRelationFormWidgetLabel('hasOne')).toBe('Nested card');
    expect(defaultRelationFormWidgetLabel('hasMany')).toBe('Related grid');
    expect(defaultRelationFormWidgetLabel('belongsToMany')).toBe('Checkbox list');
  });

  it('resolves belongs-to widget to select by default', () => {
    expect(DEFAULT_BELONGS_TO_FORM_WIDGET).toBe('select');
    expect(resolveBelongsToFormWidget('')).toBe('select');
    expect(resolveBelongsToFormWidget(null)).toBe('select');
    expect(resolveBelongsToFormWidget('typeahead')).toBe('typeahead');
    expect(resolveBelongsToFormWidget('checkboxList')).toBe('select');
    expect(resolveBelongsToFormWidget('relatedGrid')).toBe('select');
  });

  it('rejects cross-kind widgets so modeler matches Sandbox → Relations', () => {
    expect(isRelationFormWidgetAllowedForKind('hasMany', 'relatedGrid')).toBe(true);
    expect(isRelationFormWidgetAllowedForKind('hasMany', 'checkboxList')).toBe(false);
    expect(isRelationFormWidgetAllowedForKind('belongsToMany', 'tagsList')).toBe(true);
    expect(isRelationFormWidgetAllowedForKind('belongsToMany', 'relatedGrid')).toBe(false);
    expect(resolveRelationFormWidgetForKind('hasMany', 'checkboxList')).toBe('');
    expect(resolveRelationFormWidgetForKind('hasMany', 'cardList')).toBe('cardList');
    expect(resolveRelationFormWidgetForKind('hasOne', 'nestedForm')).toBe('nestedForm');
    expect(resolveRelationFormWidgetForKind('hasOne', 'select')).toBe('');
  });

  it('coerces legacy relatedList / inlineTable / multiSelect ids', () => {
    expect(coerceRelationFormWidget('relatedList')).toBe('relatedGrid');
    expect(coerceRelationFormWidget('inlineTable')).toBe('relatedGrid');
    expect(coerceRelationFormWidget('relatedGrid')).toBe('relatedGrid');
    expect(coerceRelationFormWidget('multiSelect')).toBe('tagsList');
    expect(coerceRelationFormWidget('attachList')).toBe('tagsList');
    expect(coerceRelationFormWidget('not-a-widget')).toBeUndefined();
  });
});
