import { describe, expect, it } from 'vitest';
import { Sequelize, QueryTypes } from 'sequelize';
import { parsePivotSpec } from '../../../../shared/api/contracts/data-api';
import { compileJsonExtractionSql, parseJsonPathSegments } from '../jsonFieldExtraction';
import { groupedRowsToPivotResult, pivotFlatDataset, pivotSequelizeDataset } from '../pivotFlatDataset';

describe('json field extraction', () => {
  it('compiles dialect-specific JSON path SQL from a declared extraction', () => {
    const extraction = { outputField: 'city', sourceColumn: 'payload', jsonPath: '$.customer.city' };
    expect(parseJsonPathSegments(extraction.jsonPath)).toEqual(['customer', 'city']);
    expect(compileJsonExtractionSql(extraction, 'postgres')).toContain("#>> '{customer,city}'");
    expect(compileJsonExtractionSql(extraction, 'mssql')).toContain("JSON_VALUE");
    expect(compileJsonExtractionSql(extraction, 'sqlite')).toContain('json_extract');
  });
});

describe('pivotFlatDataset', () => {
  it('aggregates in SQL and returns a PivotResult matrix', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });
    await sequelize.query('CREATE TABLE sales (region TEXT, product TEXT, amount INTEGER)');
    await sequelize.query(
      `INSERT INTO sales (region, product, amount) VALUES ('west', 'a', 10), ('west', 'b', 20), ('east', 'a', 5)`,
    );

    const spec = parsePivotSpec({
      rows: [{ field: 'region' }],
      columns: [{ field: 'product' }],
      measures: [{ field: 'amount', aggregation: 'sum' }],
    });

    const result = await pivotFlatDataset({
      dialect: 'sqlite',
      tableName: 'sales',
      columns: [{ field: 'region' }, { field: 'product' }, { field: 'amount' }],
      sequelize,
    }, spec);

    expect(result.rowAxis.fields).toEqual(['region']);
    expect(result.colAxis.fields).toEqual(['product']);
    expect(result.measures[0]?.aggregation).toBe('sum');
    expect(result.cells.length).toBe(3);
    const westA = result.cells.find((cell) => (
      result.rowAxis.members.find((member) => member.key === cell.rowKey)?.labels[0] === 'west'
      && result.colAxis.members.find((member) => member.key === cell.colKey)?.labels[0] === 'a'
    ));
    expect(westA?.values[0]).toBe(10);

    const grouped = await sequelize.query(
      'SELECT region, product, SUM(amount) AS m0 FROM sales GROUP BY region, product',
      { type: QueryTypes.SELECT },
    ) as Array<Record<string, unknown>>;
    expect(groupedRowsToPivotResult(grouped, spec).cells).toHaveLength(3);

    await sequelize.close();
  });

  it('rejects fields that are not in the prepared dataset', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });
    await sequelize.query('CREATE TABLE sales (region TEXT, amount INTEGER)');
    await expect(pivotFlatDataset({
      dialect: 'sqlite',
      tableName: 'sales',
      columns: [{ field: 'region' }, { field: 'amount' }],
      sequelize,
    }, parsePivotSpec({
      rows: [{ field: 'secret' }],
      columns: [],
      measures: [{ field: 'amount', aggregation: 'sum' }],
    }))).rejects.toThrow(/not in the prepared dataset/);
    await sequelize.close();
  });
});

describe('pivotSequelizeDataset', () => {
  it('does not ORDER BY or LIMIT ungrouped KPI aggregations', async () => {
    let captured: Record<string, unknown> | undefined;
    const ModelCtor = {
      findAll: async (options: Record<string, unknown>) => {
        captured = options;
        return [{ m0: 4 }];
      },
    };
    const result = await pivotSequelizeDataset({
      ModelCtor: ModelCtor as never,
      sequelize: {} as never,
      dialect: 'mssql',
      spec: parsePivotSpec({
        rows: [],
        columns: [],
        measures: [{ field: 'id', aggregation: 'count' }],
      }),
      allowedFields: new Set(['id']),
    });
    expect(captured?.order).toEqual([]);
    expect(captured?.group).toBeUndefined();
    expect(captured?.limit).toBeUndefined();
    expect(result.cells[0]?.values[0]).toBe(4);
  });

  it('orders grouped pivots by the axis fields so SQL Server LIMIT is valid', async () => {
    let captured: Record<string, unknown> | undefined;
    const ModelCtor = {
      findAll: async (options: Record<string, unknown>) => {
        captured = options;
        return [{ status: 'failed', m0: 2 }];
      },
    };
    await pivotSequelizeDataset({
      ModelCtor: ModelCtor as never,
      sequelize: {} as never,
      dialect: 'mssql',
      spec: parsePivotSpec({
        rows: [{ field: 'status' }],
        columns: [],
        measures: [{ field: 'id', aggregation: 'count' }],
      }),
      allowedFields: new Set(['id', 'status']),
    });
    expect(captured?.group).toEqual(['status']);
    expect(captured?.order).toEqual([['status', 'ASC']]);
    expect(captured?.limit).toBe(10001);
  });
});
