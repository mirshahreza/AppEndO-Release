import { describe, expect, it } from 'vitest';
import { Op } from 'sequelize';
import { queryPresetWhereEq } from '../../../../shared/lib/querySurfaceWhere';
import {
  compileQueryPresetWhere,
  expandColumnMapForPresetCompile,
} from '../querySurfaceRuntime';
import type { QuerySurfacesDocument } from '../../../../shared/api/contracts/data-api';

const cmsStatusColumnMap = {
  statusCode: { path: 'statusCode', type: 'string' as const, preferContains: true },
};

describe('compileQueryPresetWhere', () => {
  it('compiles CMS presets using SQL column aliases (status_code → statusCode)', () => {
    const document: QuerySurfacesDocument = {
      schemaVersion: '1.0.0',
      presets: [{
        id: 'published',
        label: 'Published',
        where: queryPresetWhereEq('status_code', '102.002.001'),
        application: 'optional',
        visibility: 'public',
      }],
    };
    const columnMap = expandColumnMapForPresetCompile(cmsStatusColumnMap, [{
      name: 'status_code',
      field: 'statusCode',
      sequelizeType: 'STRING',
      type: 'string',
      sqlType: 'nvarchar(50)',
    }]);
    const where = compileQueryPresetWhere(
      document,
      ['published'],
      columnMap,
      Op as unknown as Record<string, symbol>,
      [{
        name: 'status_code',
        field: 'statusCode',
        sequelizeType: 'STRING',
        type: 'string',
        sqlType: 'nvarchar(50)',
      }],
    );
    expect(where).toEqual({ statusCode: { [Op.like]: '%102.002.001%' } });
  });
});
