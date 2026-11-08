import { describe, expect, it } from 'vitest';
import { DataSourceType, type DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import {
  buildDataSourcesListRelativePath,
  buildDataSourcesQuestionsRelativePath,
  findDataSourceByQuestionsId,
  isUnknownDataSourcesNestedPath,
  parseDataSourcesQuestionsId,
  parseDataSourcesQuestionsIdFromPathname,
} from '../dataSourcesRoute';

const item = (id: string): DataSourceRecord => ({
  id,
  name: id,
  type: DataSourceType.POSTGRES,
  host: 'localhost',
  port: 5432,
  database: 'app',
  status: 'connected',
  isDefault: false,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by: 'admin',
  updated_at: '',
});

describe('dataSourcesRoute', () => {
  it('parses questions/{id} deep links', () => {
    expect(parseDataSourcesQuestionsId('data-sources')).toBeNull();
    expect(parseDataSourcesQuestionsId('data-sources/questions/ds-1')).toBe('ds-1');
    expect(parseDataSourcesQuestionsId('studio/data-sources/questions/ds-1')).toBe('ds-1');
    expect(parseDataSourcesQuestionsId('questions/ds-1')).toBe('ds-1');
    expect(parseDataSourcesQuestionsId('data-sources/questions')).toBeNull();
  });

  it('parses questions id from culture + studio pathnames', () => {
    expect(parseDataSourcesQuestionsIdFromPathname('/studio/data-sources')).toBeNull();
    expect(parseDataSourcesQuestionsIdFromPathname('/studio/data-sources/questions/ds-1')).toBe('ds-1');
    expect(parseDataSourcesQuestionsIdFromPathname('/us/studio/data-sources/questions/ds-1')).toBe('ds-1');
  });

  it('flags unknown nested data-source paths', () => {
    expect(isUnknownDataSourcesNestedPath('data-sources')).toBe(false);
    expect(isUnknownDataSourcesNestedPath('data-sources/questions/ds-1')).toBe(false);
    expect(isUnknownDataSourcesNestedPath('data-sources/questions')).toBe(true);
    expect(isUnknownDataSourcesNestedPath('data-sources/edit/ds-1')).toBe(true);
  });

  it('builds culture-aware questions paths', () => {
    expect(buildDataSourcesListRelativePath('studio')).toBe('data-sources');
    expect(buildDataSourcesListRelativePath('us')).toBe('studio/data-sources');
    expect(buildDataSourcesQuestionsRelativePath({ id: 'ds-1' }, 'studio'))
      .toBe('data-sources/questions/ds-1');
    expect(buildDataSourcesQuestionsRelativePath({ id: 'ds-1' }, 'us'))
      .toBe('studio/data-sources/questions/ds-1');
  });

  it('finds a data source by questions id', () => {
    const items = [item('ds-1'), item('ds-2')];
    expect(findDataSourceByQuestionsId(items, 'ds-2')?.id).toBe('ds-2');
    expect(findDataSourceByQuestionsId(items, 'missing')).toBeUndefined();
  });
});
