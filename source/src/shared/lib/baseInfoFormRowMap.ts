import type { BaseInfoEditForm } from '../api/contracts/base-info/editForm';
import type { BaseInfoLocaleTexts } from './baseInfoCultureTranslations';

const pick = (row: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return undefined;
};

export const mapBaseInfoListRowToFormRecord = (row: Record<string, unknown>): BaseInfoEditForm => {
  const locales = (pick(row, 'locales') as BaseInfoLocaleTexts | undefined) ?? {};

  return {
    parentId: String(pick(row, 'parentId', 'parent_id') ?? ''),
    childDigits: '3',
    title: String(pick(row, 'title') ?? ''),
    shortName: String(pick(row, 'shortName', 'short_name') ?? ''),
    note: String(pick(row, 'note') ?? ''),
    locales,
    viewOrder: pick(row, 'viewOrder', 'view_order') == null ? '' : String(pick(row, 'viewOrder', 'view_order')),
    value: pick(row, 'value') == null ? '' : String(pick(row, 'value')),
    metadata: String(pick(row, 'metadata') ?? ''),
    uiColor: String(pick(row, 'uiColor', 'ui_color') ?? ''),
    uiHtml: String(pick(row, 'uiHtml', 'ui_html') ?? ''),
    isActive: pick(row, 'isActive', 'is_active') === false || pick(row, 'isActive', 'is_active') === 'false'
      ? false
      : true,
  };
};
