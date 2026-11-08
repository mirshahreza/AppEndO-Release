import { describe, expect, it } from 'vitest';
import {
  buildGridColumnWizardRows,
  buildGridColumnsFromApiFields,
  DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
  DEFAULT_DESIGNER_DATA_GRID_COLUMN_KEYS,
  isDefaultDesignerDataGridColumnsValue,
  isDefaultGridTemplateFieldList,
  shouldAutoGenerateGridColumns,
  wizardRowsToGridColumns,
} from '../designerDataGridColumns';

describe('designerDataGridColumns auto columns', () => {
  it('builds labeled columns from API field names', () => {
    const columns = buildGridColumnsFromApiFields(['topic_label', 'title', 'note']);
    expect(columns.map((column) => column.key)).toEqual(['topic_label', 'title', 'note']);
    expect(columns[0]?.label).toBe('Topic label');
    expect(columns[2]?.sort).toBe(false);
  });

  it('detects the default starter column template', () => {
    expect(isDefaultDesignerDataGridColumnsValue(DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON)).toBe(true);
    expect(isDefaultDesignerDataGridColumnsValue('[{"key":"title","label":"Title"}]')).toBe(false);
  });

  it('auto-generates when the grid still has the default columns', () => {
    expect(shouldAutoGenerateGridColumns(
      DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
      ['id', 'title', 'note'],
      false,
    )).toBe(true);
  });

  it('auto-generates on first connect when columns do not overlap API fields', () => {
    expect(shouldAutoGenerateGridColumns(
      DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
      ['topic_label', 'title'],
      false,
    )).toBe(true);
  });

  it('detects the default grid template field list', () => {
    expect(isDefaultGridTemplateFieldList(DEFAULT_DESIGNER_DATA_GRID_COLUMN_KEYS)).toBe(true);
    expect(isDefaultGridTemplateFieldList(['id', 'title'])).toBe(false);
  });

  it('builds wizard rows with all API fields enabled on first connect', () => {
    const rows = buildGridColumnWizardRows(
      DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
      ['id', 'topic_label', 'title'],
      false,
    );

    expect(rows.filter((row) => !row.isAction).map((row) => ({ key: row.key, enabled: row.enabled }))).toEqual([
      { key: 'id', enabled: true },
      { key: 'topic_label', enabled: true },
      { key: 'title', enabled: true },
    ]);
  });

  it('converts wizard rows to grid columns using enabled state', () => {
    const rows = buildGridColumnWizardRows(
      DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
      ['id', 'topic_label', 'title'],
      false,
    ).map((row) => (row.key === 'topic_label' ? { ...row, enabled: false, filter: true } : row));

    const columns = wizardRowsToGridColumns(rows);
    expect(columns.map((column) => column.key)).toEqual(['id', 'title']);
    expect(columns.find((column) => column.key === 'id')?.sort).toBe(true);
    expect(columns.find((column) => column.key === 'title')?.filter).toBeUndefined();
  });
});
