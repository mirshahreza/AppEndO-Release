import { describe, expect, it } from 'vitest';
import {
  buildFileColumnPresetSpecs,
  buildImageColumnPresetSpecs,
  buildRecordAuditColumnPresetSpecs,
  buildSetAuditColumnPresetSpecs,
  createEdgeModelColumnsFromPresetSpecs,
} from '../edgeModelColumnPresets';

describe('edgeModelColumnPresets', () => {
  it('builds image columns with thumbnail, size, and name suffixes', () => {
    expect(buildImageColumnPresetSpecs('profile_pic', 'postgres')).toEqual([
      { name: 'profile_pic', dataType: 'bytea' },
      { name: 'profile_pic_xs', dataType: 'bytea' },
      { name: 'profile_pic_size', dataType: 'integer' },
      { name: 'profile_pic_name', dataType: 'text' },
    ]);
  });

  it('builds file columns without thumbnail', () => {
    expect(buildFileColumnPresetSpecs('attachment', 'mysql')).toEqual([
      { name: 'attachment', dataType: 'longblob' },
      { name: 'attachment_size', dataType: 'integer' },
      { name: 'attachment_name', dataType: 'varchar' },
    ]);
  });

  it('builds record audit columns', () => {
    expect(buildRecordAuditColumnPresetSpecs('postgres')).toEqual([
      { name: 'created_by', dataType: 'bigint' },
      { name: 'created_at', dataType: 'timestamp with time zone' },
      { name: 'updated_by', dataType: 'bigint' },
      { name: 'updated_at', dataType: 'timestamp with time zone' },
    ]);
  });

  it('builds set audit columns from a set name', () => {
    expect(buildSetAuditColumnPresetSpecs('price_update', 'postgres')).toEqual([
      { name: 'price_update_updated_by', dataType: 'bigint' },
      { name: 'price_update_updated_at', dataType: 'timestamp with time zone' },
    ]);
  });

  it('skips preset columns that already exist', () => {
    const created = createEdgeModelColumnsFromPresetSpecs(
      buildRecordAuditColumnPresetSpecs('postgres'),
      [{ name: 'created_by' }, { name: 'updated_at' }],
    );

    expect(created.map((column) => column.name)).toEqual(['created_at', 'updated_by']);
  });
});
