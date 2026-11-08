import { describe, expect, it } from 'vitest';
import {
  buildComputedAttributeIncludes,
  buildIncludeOptionsFromOperation,
  interpolateComputedExpression,
  parseFilterQuery,
  parseIncludeAliases,
} from '../dataApiQuery';
import type { EdgeApiOperation, EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';

const sampleModel: EdgeModelDefinition = {
  id: 'model_customers',
  dataSourceId: 'ds_local',
  schema: 'dbo',
  objectName: 'Customers',
  objectType: 'TABLE',
  sequelize: { modelName: 'Customers', tableName: 'customers', schema: 'dbo' },
  columns: [
    {
      name: 'id',
      field: 'id',
      dataType: 'INTEGER',
      sequelizeType: 'INTEGER',
      allowNull: false,
      isPrimaryKey: true,
      isForeignKey: false,
    },
  ],
  primaryKey: 'id',
  associations: [
    {
      id: 'assoc_orders',
      kind: 'hasMany',
      targetModelId: 'model_orders',
      foreignKey: 'customer_id',
      as: 'orders',
      source: 'catalog',
    },
  ],
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: 'Customers' },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('parseFilterQuery', () => {
  it('parses flat filter[field][op] keys', () => {
    expect(parseFilterQuery({
      'filter[statusCode][eq]': '101.002.003',
      'filter[languageCode][eq]': '101.004.001',
      search: 'hello',
    })).toEqual({
      statusCode: { eq: '101.002.003' },
      languageCode: { eq: '101.004.001' },
    });
  });

  it('parses Express/qs nested filter objects (CMS Contents toolbar selects)', () => {
    expect(parseFilterQuery({
      filter: {
        statusCode: { eq: '101.002.003' },
        languageCode: { eq: '101.004.001' },
      },
      search: 'hello',
    })).toEqual({
      statusCode: { eq: '101.002.003' },
      languageCode: { eq: '101.004.001' },
    });
  });

  it('merges flat and nested filter shapes without dropping either', () => {
    expect(parseFilterQuery({
      'filter[title][like]': 'news',
      filter: {
        statusCode: { eq: '101.002.001' },
      },
    })).toEqual({
      title: { like: 'news' },
      statusCode: { eq: '101.002.001' },
    });
  });
});

describe('dataApiQuery advanced shaping', () => {
  it('returns enabled include aliases when query.include is absent', () => {
    const operation: EdgeApiOperation = {
      id: 'op_list',
      method: 'GET',
      kind: 'list',
      pathPattern: '/api/customers/list',
      enabled: true,
      query: {
        allowFilter: true,
        allowSort: true,
        maxPageSize: 100,
        defaultPageSize: 20,
        includes: ['orders'],
      },
      includeConfigs: [
        { as: 'orders', enabled: true, limit: 3, separate: true, order: '-createdAt' },
      ],
    };

    expect(parseIncludeAliases({}, operation)).toEqual(['orders']);
  });

  it('builds include options with limit and separate flags', () => {
    const operation: EdgeApiOperation = {
      id: 'op_list',
      method: 'GET',
      kind: 'list',
      pathPattern: '/api/customers/list',
      enabled: true,
      includeConfigs: [
        { as: 'orders', enabled: true, limit: 3, separate: true, order: '-createdAt' },
      ],
    };

    const include = buildIncludeOptionsFromOperation(['orders'], operation, sampleModel);
    expect(include).toEqual([{
      association: 'orders',
      limit: 3,
      separate: true,
      order: [['createdAt', 'DESC']],
    }]);
  });

  it('interpolates computed expression placeholders', () => {
    const sql = interpolateComputedExpression(
      '(SELECT COUNT(*) FROM orders o WHERE o.customer_id = {{qualifiedTable}}.{{pk}})',
      sampleModel,
    );
    expect(sql).toContain('dbo.customers.id');
  });

  it('compiles quoted parent.pk placeholders for SQL Server', () => {
    const sql = interpolateComputedExpression(
      '(SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = "{{parent}}"."{{pk}}")',
      sampleModel,
      'mssql',
    );
    expect(sql).toContain('[Customers].[id]');
    expect(sql).not.toContain('::int');
  });

  it('builds computed attribute includes', () => {
    const includes = buildComputedAttributeIncludes([
      {
        id: 'c1',
        outputField: 'orderCount',
        kind: 'scalar_subquery',
        expression: '(SELECT COUNT(*) FROM orders o WHERE o.customer_id = {{qualifiedTable}}.{{pk}})',
      },
    ], sampleModel);

    expect(includes).toHaveLength(1);
    expect(includes[0][1]).toBe('orderCount');
  });
});
