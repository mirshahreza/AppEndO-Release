import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SchemaFieldInfo } from '../../../utils/dataSourceSchemaIntrospection';
import type { EdgeDbQueryFn } from '../../server-function.service';

vi.mock('../../../db/dataSourcesStore', () => ({
  getDataSourcesFromSettings: vi.fn(() => [{
    id: 'ds1',
    name: 'cms',
    type: 'PostgreSQL',
    host: 'localhost',
    port: 5432,
    status: 'connected',
    isDefault: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }]),
}));

vi.mock('../../../utils/dataSourceSchemaIntrospection', () => ({
  listDataSourceObjectFields: vi.fn(),
  listDataSourceObjectRelations: vi.fn(),
}));

import { captureCmsModule, captureSeedInserts } from '../packageDbCapture.service';
import {
  listDataSourceObjectFields,
  listDataSourceObjectRelations,
} from '../../../utils/dataSourceSchemaIntrospection';

const field = (
  name: string,
  dataType: string,
  options: { isPrimaryKey?: boolean; nullable?: boolean } = {},
): SchemaFieldInfo => ({
  name,
  dataType,
  suggestedFieldType: 'string',
  nullable: options.nullable ?? true,
  isPrimaryKey: options.isPrimaryKey ?? false,
});

const mockFields = vi.mocked(listDataSourceObjectFields);
const mockRelations = vi.mocked(listDataSourceObjectRelations);

const FIELDS: Record<string, SchemaFieldInfo[]> = {
  base_info: [
    field('id', 'text', { isPrimaryKey: true, nullable: false }),
    field('parent_id', 'text'),
    field('title', 'text', { nullable: false }),
  ],
  cms_contents: [
    field('id', 'text', { isPrimaryKey: true, nullable: false }),
    field('title', 'text', { nullable: false }),
    field('parent_content_id', 'text'),
  ],
  cms_content_assets: [
    field('id', 'text', { isPrimaryKey: true, nullable: false }),
    field('content_id', 'text', { nullable: false }),
    field('file', 'bytea', { nullable: false }),
  ],
  cms_content_revisions: [
    field('id', 'text', { isPrimaryKey: true, nullable: false }),
    field('content_id', 'text', { nullable: false }),
  ],
  cms_content_tags: [
    field('content_id', 'text', { isPrimaryKey: true, nullable: false }),
    field('tag_code', 'text', { isPrimaryKey: true, nullable: false }),
  ],
  cms_content_relations: [
    field('id', 'text', { isPrimaryKey: true, nullable: false }),
    field('content_id_a', 'text', { nullable: false }),
    field('content_id_b', 'text', { nullable: false }),
  ],
  cms_settings: [
    field('id', 'text', { isPrimaryKey: true, nullable: false }),
    field('comments_policy_code', 'text', { nullable: false }),
  ],
};

beforeEach(() => {
  mockFields.mockReset();
  mockRelations.mockReset();
  mockFields.mockImplementation(async (_query, _type, _objectType, tableName) => (
    FIELDS[tableName] ?? []
  ));
  mockRelations.mockImplementation(async (_query, _type, _objectType, tableName) => ({
    focusObject: tableName,
    objectType: 'TABLE',
    tables: [],
    relations: tableName === 'cms_content_assets'
      ? [{
        fromTable: 'cms_content_assets',
        fromColumn: 'content_id',
        toTable: 'cms_contents',
        toColumn: 'id',
      }]
      : [],
  }));
});

describe('captureSeedInserts', () => {
  it('captures related tables in FK order and replaces BYTEA with blob tokens', async () => {
    const edgeDbQuery: EdgeDbQueryFn = async (sql) => {
      const text = String(sql);
      if (text.includes('"cms_contents"')) {
        return { data: [{ id: 'c1', title: 'Home', parent_content_id: null }], count: 1 };
      }
      if (text.includes('"cms_content_assets"')) {
        return {
          data: [{ id: 'a1', content_id: 'c1', file: Buffer.from('PNG') }],
          count: 1,
        };
      }
      return { data: [], count: 0 };
    };

    const result = await captureSeedInserts(
      { edgeDbQuery, settingsPath: 'unused.json' },
      {
        dataSourceId: 'ds1',
        tableName: 'cms_contents',
        relatedTables: ['cms_content_assets'],
        includeBinary: true,
        limit: 50,
      },
    );

    expect(result.tables).toEqual(['cms_contents', 'cms_content_assets']);
    expect(result.rowCount).toBe(2);
    expect(result.installSql).toContain('INSERT INTO "cms_contents"');
    expect(result.installSql).toMatch(/INSERT INTO "cms_content_assets".*\{\{package_blob:db\/blobs\/files\//s);
    expect(result.installSql).not.toMatch(/decode\(/);
    expect(result.blobs).toHaveLength(1);
    expect(result.blobs[0]).toMatchObject({
      table: 'cms_content_assets',
      column: 'file',
      key: { id: 'a1' },
      contentBase64: Buffer.from('PNG').toString('base64'),
      byteLength: 3,
    });
    expect(result.hidRows).toEqual([]);
    expect(result.uninstallSql).toContain('DELETE FROM "cms_content_assets"');
    expect(result.uninstallSql.indexOf('cms_content_assets')).toBeLessThan(
      result.uninstallSql.indexOf('cms_contents'),
    );
  });

  it('walks parent_content_id descendants on the root table', async () => {
    const edgeDbQuery: EdgeDbQueryFn = async (sql) => {
      const text = String(sql);
      if (text.includes('"parent_content_id" IN')) {
        return { data: [{ id: 'c1', title: 'Child', parent_content_id: 'p1' }], count: 1 };
      }
      return { data: [{ id: 'p1', title: 'Parent', parent_content_id: null }], count: 1 };
    };

    const result = await captureSeedInserts(
      { edgeDbQuery, settingsPath: 'unused.json' },
      {
        dataSourceId: 'ds1',
        tableName: 'cms_contents',
        includeDescendants: true,
        parentColumn: 'parent_content_id',
        includeBinary: false,
        limit: 50,
      },
    );

    expect(result.rowCount).toBe(2);
    expect(result.installSql).toContain("'Parent'");
    expect(result.installSql).toContain("'Child'");
    expect(result.installSql.indexOf("'Parent'")).toBeLessThan(result.installSql.indexOf("'Child'"));
  });

  it('records Base Info HID rows for install remapping', async () => {
    const edgeDbQuery: EdgeDbQueryFn = async () => ({
      data: [{ id: '100.4', parent_id: '100', title: 'CMS' }],
      count: 1,
    });

    const result = await captureSeedInserts(
      { edgeDbQuery, settingsPath: 'unused.json' },
      {
        dataSourceId: 'ds1',
        tableName: 'base_info',
        includeDescendants: true,
        parentColumn: 'parent_id',
        includeBinary: false,
        limit: 50,
      },
    );

    expect(result.hidRows).toEqual([
      { id: '100.4', parentId: '100', title: 'CMS' },
    ]);
  });
});

describe('captureCmsModule', () => {
  it('loads CMS schema and required vocab without optional content', async () => {
    const edgeDbQuery: EdgeDbQueryFn = async (sql) => {
      if (String(sql).includes('"base_info"')) {
        return { data: [{ id: '100.4', parent_id: '100', title: 'CMS' }], count: 1 };
      }
      return { data: [], count: 0 };
    };

    const result = await captureCmsModule(
      { edgeDbQuery, settingsPath: 'unused.json' },
      { dataSourceId: 'ds1', includeOptionalRecords: false },
    );

    expect(result.schemaInstallSql).toContain('CREATE TABLE IF NOT EXISTS cms_content_assets');
    expect(result.schemaUninstallSql).toContain('DROP TABLE IF EXISTS cms_content_assets');
    expect(result.vocabRowCount).toBe(1);
    expect(result.vocabHidRows).toEqual([{ id: '100.4', parentId: '100', title: 'CMS' }]);
    expect(result.contentRowCount).toBe(0);
    expect(result.contentBlobs).toEqual([]);
  });
});
