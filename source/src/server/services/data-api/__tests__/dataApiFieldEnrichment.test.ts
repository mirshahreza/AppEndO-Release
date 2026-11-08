import { describe, expect, it, vi } from 'vitest';

const { listBaseInfoEnrichmentRowsByIds, listBaseInfoOptionsRows } = vi.hoisted(() => ({
  listBaseInfoEnrichmentRowsByIds: vi.fn(async () => ([])),
  listBaseInfoOptionsRows: vi.fn(async () => ([
    { id: '100.1.1', label: 'Male', title: 'Male', ui_html: '<i></i>' },
    { id: '100.1.2', label: 'Female', title: 'Female', ui_html: null },
  ])),
}));

vi.mock('../../../domain/base-info/treeRepository', () => ({
  listBaseInfoEnrichmentRowsByIds,
  listBaseInfoOptionsRows,
}));

import { applyFieldEnrichments } from '../dataApiFieldEnrichment';

describe('dataApiFieldEnrichment', () => {
  it('adds base_info title fields to rows', async () => {
    const rows = [{ genderCode: '100.1.1', name: 'Ali' }];
    const enriched = await applyFieldEnrichments(rows, [{
      id: 'e1',
      sourceField: 'genderCode',
      kind: 'base_info_title',
      joinTableSource: 'base_info',
      rootId: '100.1',
      outputField: 'genderCode_Title',
      langSource: 'fixed:en',
    }], 'en');

    expect(enriched[0].genderCode_Title).toBe('Male');
    expect(listBaseInfoOptionsRows).toHaveBeenCalled();
  });

  it('adds selected base_info columns via attachedFields', async () => {
    listBaseInfoEnrichmentRowsByIds.mockResolvedValueOnce([{
      id: '100.1.1',
      parent_id: '100.1',
      title: 'Male',
      title_en: 'Male',
      title_fa: 'مرد',
      title_ar: 'Male',
      short_name: 'M',
      view_order: 1,
      note: null,
      note_en: null,
      note_fa: null,
      note_ar: null,
      metadata: null,
      value: 1,
      is_active: true,
      ui_color: '#000',
      ui_html: '<i></i>',
      created_at: null,
      created_by: null,
      updated_at: null,
      updated_by: null,
    }]);

    const rows = [{ genderCode: '100.1.1', name: 'Ali' }];
    const enriched = await applyFieldEnrichments(rows, [{
      id: 'e2',
      sourceField: 'genderCode',
      kind: 'base_info_title',
      joinTableSource: 'base_info',
      rootId: '100.1',
      langSource: 'fixed:en',
      attachedFields: [
        { sourceColumn: 'title_en', outputField: 'genderCode_title_en' },
        { sourceColumn: 'ui_color', outputField: 'genderCode_ui_color' },
      ],
    }], 'en');

    expect(enriched[0].genderCode_title_en).toBe('Male');
    expect(enriched[0].genderCode_ui_color).toBe('#000');
    expect(listBaseInfoEnrichmentRowsByIds).toHaveBeenCalledWith(['100.1.1']);
  });
});
