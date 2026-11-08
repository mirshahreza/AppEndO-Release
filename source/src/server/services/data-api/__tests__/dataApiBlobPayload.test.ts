import { describe, expect, it } from 'vitest';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import { normalizeDataApiWritePayload } from '../dataApiExecutor';

const model: EdgeModelDefinition = {
  id: 'model_assets',
  dataSourceId: 'ds_local',
  objectName: 'cms_content_assets',
  objectType: 'TABLE',
  sequelize: { modelName: 'CmsContentAssets', tableName: 'cms_content_assets' },
  columns: [
    {
      name: 'file',
      field: 'file',
      dataType: 'bytea',
      sequelizeType: 'BLOB',
      allowNull: false,
      isPrimaryKey: false,
      isForeignKey: false,
    },
    {
      name: 'file_name',
      field: 'fileName',
      dataType: 'text',
      sequelizeType: 'STRING',
      allowNull: false,
      isPrimaryKey: false,
      isForeignKey: false,
    },
  ],
  associations: [],
  schemaFingerprint: 'cms-assets',
  readOnly: false,
  labels: { title: 'CMS Content Assets' },
  status: 'ready',
  created_at: '2026-07-28T00:00:00.000Z',
  updated_at: '2026-07-28T00:00:00.000Z',
};

describe('Data API BLOB payload normalization', () => {
  it('decodes a data URL into binary while preserving ordinary fields', () => {
    const payload = normalizeDataApiWritePayload(model, {
      file: 'data:text/plain;base64,SGVsbG8=',
      fileName: 'hello.txt',
    });

    expect(Buffer.isBuffer(payload.file)).toBe(true);
    expect((payload.file as Buffer).toString('utf8')).toBe('Hello');
    expect(payload.fileName).toBe('hello.txt');
  });
});
