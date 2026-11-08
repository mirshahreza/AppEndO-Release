import { describe, expect, it } from 'vitest';
import {
  blobFileEntryForKey,
  collectPackageBlobTokens,
  decodeBinaryColumnValue,
  dialectFamilyFromDataSourceType,
  expandPackageBlobTokens,
  isBinaryColumnType,
  mergeCapturedPackageBlobs,
  packageBlobToken,
  sortRowsParentsFirst,
  sqlBinaryLiteral,
  topologicalSortTables,
} from '../packageDbBlobPayload';

describe('packageDbBlobPayload', () => {
  it('detects binary column types without treating bit as binary', () => {
    expect(isBinaryColumnType('bytea')).toBe(true);
    expect(isBinaryColumnType('VARBINARY(MAX)')).toBe(true);
    expect(isBinaryColumnType('blob')).toBe(true);
    expect(isBinaryColumnType('binary(16)')).toBe(true);
    expect(isBinaryColumnType('image')).toBe(true);
    expect(isBinaryColumnType('bit')).toBe(false);
    expect(isBinaryColumnType('varchar')).toBe(false);
  });

  it('expands blob tokens to dialect literals', () => {
    const bytes = Buffer.from([0xde, 0xad]);
    const sql = `INSERT INTO cms_content_assets (file) VALUES (${packageBlobToken('db/blobs/files/cms_content_assets_file_id=9.bin')});`;
    const blobs = new Map([['db/blobs/files/cms_content_assets_file_id=9.bin', bytes]]);
    expect(expandPackageBlobTokens(sql, blobs, 'postgres')).toContain("decode('dead', 'hex')");
    expect(expandPackageBlobTokens(sql, blobs, 'sqlserver')).toContain('0xdead');
    expect(collectPackageBlobTokens(sql)).toEqual(['db/blobs/files/cms_content_assets_file_id=9.bin']);
    expect(() => expandPackageBlobTokens(sql, new Map(), 'postgres')).toThrow(
      'Package blob "db/blobs/files/cms_content_assets_file_id=9.bin" is missing from the ZIP.',
    );
  });

  it('orders parent tables before children', () => {
    expect(topologicalSortTables(
      ['cms_content_assets', 'cms_contents', 'cms_content_tags'],
      [
        { fromTable: 'cms_content_assets', fromColumn: 'content_id', toTable: 'cms_contents', toColumn: 'id' },
        { fromTable: 'cms_content_tags', fromColumn: 'content_id', toTable: 'cms_contents', toColumn: 'id' },
      ],
    )).toEqual(['cms_contents', 'cms_content_assets', 'cms_content_tags']);
  });

  it('orders self-referencing rows parents first', () => {
    const rows = [
      { id: 2, parent_id: 1 },
      { id: 1, parent_id: null },
      { id: 3, parent_id: 2 },
    ];
    expect(sortRowsParentsFirst(rows, 'id', 'parent_id').map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it('decodes driver binary payloads', () => {
    expect(decodeBinaryColumnValue(Buffer.from('ab')).toString()).toBe('ab');
    expect(decodeBinaryColumnValue('\\x6162')?.toString()).toBe('ab');
    expect(decodeBinaryColumnValue({ type: 'Buffer', data: [65, 66] })?.toString()).toBe('AB');
  });

  it('maps data source types to dialect families', () => {
    expect(dialectFamilyFromDataSourceType('PostgreSQL')).toBe('postgres');
    expect(dialectFamilyFromDataSourceType('SQL Server')).toBe('sqlserver');
    expect(sqlBinaryLiteral(Buffer.from([1]), 'mysql')).toBe("UNHEX('01')");
  });

  it('merges captured blobs by entry', () => {
    const merged = mergeCapturedPackageBlobs([
      { entry: 'db/blobs/files/a.bin', table: 't', column: 'file', key: { id: '1' }, contentBase64: 'YQ==', byteLength: 1 },
      { entry: 'db/blobs/files/a.bin', table: 't', column: 'file', key: { id: '1' }, contentBase64: 'Yg==', byteLength: 1 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.contentBase64).toBe('Yg==');
  });

  it('builds stable blob entry names', () => {
    expect(blobFileEntryForKey('cms_content_assets', 'file', 'id=9')).toBe(
      'db/blobs/files/cms_content_assets_file_id=9.bin',
    );
  });
});
