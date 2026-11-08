import { describe, expect, it } from 'vitest';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import {
  buildDataStudioListRelativePath,
  buildDataStudioModelerEditRelativePath,
  findEdgeModelByEditSlug,
  parseDataStudioModelerEditSlug,
  parseDataStudioModelerEditSlugFromPathname,
} from '../dataStudioRoute';

const model = (overrides: Partial<EdgeModelDefinition> & Pick<EdgeModelDefinition, 'id' | 'objectName'>): EdgeModelDefinition => ({
  dataSourceId: 'ds-1',
  objectType: 'TABLE',
  schema: null,
  labels: { title: overrides.objectName },
  primaryKey: 'id',
  columns: [],
  associations: [],
  readOnly: false,
  status: 'ready',
  schemaFingerprint: 'fp',
  sequelize: { modelName: 'M', tableName: overrides.objectName },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('dataStudioRoute', () => {
  it('parses canonical edit/{objectName} deep links', () => {
    expect(parseDataStudioModelerEditSlug('data-studio')).toBeNull();
    expect(parseDataStudioModelerEditSlug('data-studio/edit/test_products')).toBe('test_products');
    expect(parseDataStudioModelerEditSlug('studio/data-studio/edit/test_products')).toBe('test_products');
    expect(parseDataStudioModelerEditSlug('edit/test_products')).toBe('test_products');
  });

  it('parses legacy object-name paths without edit for canonicalize', () => {
    expect(parseDataStudioModelerEditSlug('data-studio/test_products')).toBe('test_products');
    expect(parseDataStudioModelerEditSlug('studio/data-studio/test_products')).toBe('test_products');
    expect(parseDataStudioModelerEditSlug('test_products')).toBe('test_products');
  });

  it('parses object-name from culture + studio pathnames', () => {
    expect(parseDataStudioModelerEditSlugFromPathname('/us/studio/data-studio')).toBeNull();
    expect(parseDataStudioModelerEditSlugFromPathname('/us/studio/data-studio/edit/test_products'))
      .toBe('test_products');
    expect(parseDataStudioModelerEditSlugFromPathname('/us/studio/data-studio/test_products'))
      .toBe('test_products');
    expect(parseDataStudioModelerEditSlugFromPathname('/studio/data-studio/edit/base_users'))
      .toBe('base_users');
  });

  it('builds culture-aware modeler paths with edit segment', () => {
    expect(buildDataStudioListRelativePath('studio')).toBe('data-studio');
    expect(buildDataStudioListRelativePath('us')).toBe('studio/data-studio');
    expect(buildDataStudioModelerEditRelativePath({ objectName: 'test_products' }, 'studio'))
      .toBe('data-studio/edit/test_products');
    expect(buildDataStudioModelerEditRelativePath({ objectName: 'test_products' }, 'us'))
      .toBe('studio/data-studio/edit/test_products');
  });

  it('finds models by object name and prefers the selected data source', () => {
    const models = [
      model({ id: 'a', objectName: 'orders', dataSourceId: 'ds-1' }),
      model({ id: 'b', objectName: 'orders', dataSourceId: 'ds-2' }),
    ];

    expect(findEdgeModelByEditSlug(models, 'orders', { preferredDataSourceId: 'ds-2' })?.id).toBe('b');
    expect(findEdgeModelByEditSlug(models, 'ORDERS', { preferredDataSourceId: 'ds-1' })?.id).toBe('a');
    expect(findEdgeModelByEditSlug(models, 'a')?.id).toBe('a');
  });
});
