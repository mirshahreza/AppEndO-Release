import { describe, expect, it } from 'vitest';
import {
  BASE_INFO_CULTURE_TITLE_COLUMN,
  buildLocalizedFieldFamilies,
  columnBelongsToLocalizedFamily,
  formatAttachedFieldChipLabel,
  humanizeFieldStem,
  isBaseInfoObject,
  parseLocalizedColumn,
  suggestAttachedFieldAsName,
  toggleAttachedColumnSelection,
} from '../belongsToAttachedFields';

describe('belongsToAttachedFields', () => {
  it('detects base_info targets', () => {
    expect(isBaseInfoObject('base_info')).toBe(true);
    expect(isBaseInfoObject('Base_Info')).toBe(true);
    expect(isBaseInfoObject('cms_contents')).toBe(false);
  });

  it('parses locale-suffixed columns', () => {
    expect(parseLocalizedColumn('title_fa')).toEqual({ stem: 'title', locale: 'fa' });
    expect(parseLocalizedColumn('note_en')).toEqual({ stem: 'note', locale: 'en' });
    expect(parseLocalizedColumn('title')).toBeNull();
    expect(parseLocalizedColumn('short_name')).toBeNull();
    expect(parseLocalizedColumn('parent_id')).toBeNull();
  });

  it('formats attached field chip labels', () => {
    expect(formatAttachedFieldChipLabel('title')).toBe('title·culture');
    expect(formatAttachedFieldChipLabel('note')).toBe('note·culture');
    expect(formatAttachedFieldChipLabel('title_fa')).toBe('title·FA');
    expect(formatAttachedFieldChipLabel('ui_color')).toBe('ui_color');
  });

  it('suggests as names as foreignKey_selectedField', () => {
    expect(suggestAttachedFieldAsName('content_type_code', 'title')).toBe(
      'content_type_code_title',
    );
    expect(suggestAttachedFieldAsName('content_type_code', 'ui_color')).toBe(
      'content_type_code_ui_color',
    );
  });

  it('groups localized column families and keeps them out of other columns', () => {
    const families = buildLocalizedFieldFamilies([
      'ui_color',
      'title',
      'title_en',
      'title_fa',
      'title_ar',
      'note',
      'note_fa',
      'note_ar',
      'short_name',
    ]);

    expect(families.map((family) => family.stem)).toEqual(['title', 'note']);
    expect(families[0]).toMatchObject({
      label: 'Title',
      cultureColumn: 'title',
      fixedColumns: ['title_en', 'title_fa', 'title_ar'],
    });
    expect(families[1]).toMatchObject({
      label: 'Note',
      cultureColumn: 'note',
      fixedColumns: ['note_fa', 'note_ar'],
    });
    expect(humanizeFieldStem('short_name')).toBe('Short Name');
    expect(columnBelongsToLocalizedFamily('title_fa', families)).toBe(true);
    expect(columnBelongsToLocalizedFamily('ui_color', families)).toBe(false);
  });

  it('makes culture stem and fixed locale columns mutually exclusive per family', () => {
    const families = buildLocalizedFieldFamilies([
      'title',
      'title_en',
      'title_fa',
      'note',
      'note_fa',
    ]);

    expect(toggleAttachedColumnSelection(
      ['title_fa', 'ui_color', 'note_fa'],
      BASE_INFO_CULTURE_TITLE_COLUMN,
      true,
      { families },
    )).toEqual(['ui_color', 'note_fa', 'title']);

    expect(toggleAttachedColumnSelection(
      ['title', 'note'],
      'note_fa',
      true,
      { families },
    )).toEqual(['title', 'note_fa']);

    expect(toggleAttachedColumnSelection(
      ['title_fa'],
      'title_en',
      true,
      { families },
    )).toEqual(['title_fa', 'title_en']);
  });
});
