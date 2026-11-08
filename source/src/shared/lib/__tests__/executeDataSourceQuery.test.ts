import { describe, expect, it } from 'vitest';
import { sqlServerRowsLookLikeShowPlan, unwrapLeadingExplainSql, validateExecuteDataSourceSql } from '../executeDataSourceQuery';

describe('validateExecuteDataSourceSql', () => {
  it('allows select and routine invocation SQL', () => {
    expect(validateExecuteDataSourceSql('SELECT 1')).toEqual({ ok: true });
    expect(validateExecuteDataSourceSql('CALL sync_rows()')).toEqual({ ok: true });
    expect(validateExecuteDataSourceSql('EXEC sync_rows')).toEqual({ ok: true });
  });

  it('allows EXPLAIN (PDK-6)', () => {
    expect(validateExecuteDataSourceSql('EXPLAIN SELECT 1')).toEqual({ ok: true });
    expect(validateExecuteDataSourceSql('explain analyze select * from demo')).toEqual({ ok: true });
  });

  it('rejects DDL and write statements', () => {
    expect(validateExecuteDataSourceSql('DROP TABLE demo').ok).toBe(false);
    expect(validateExecuteDataSourceSql('INSERT INTO demo VALUES (1)').ok).toBe(false);
  });

  it('with allowWrite: true, allows DML but still rejects DDL', () => {
    expect(validateExecuteDataSourceSql('INSERT INTO demo VALUES (1)', { allowWrite: true })).toEqual({ ok: true });
    expect(validateExecuteDataSourceSql('UPDATE demo SET x = 1 WHERE id = 1', { allowWrite: true })).toEqual({ ok: true });
    expect(validateExecuteDataSourceSql('DELETE FROM demo WHERE id = 1', { allowWrite: true })).toEqual({ ok: true });
    expect(validateExecuteDataSourceSql('SELECT 1', { allowWrite: true })).toEqual({ ok: true });
    expect(validateExecuteDataSourceSql('DROP TABLE demo', { allowWrite: true }).ok).toBe(false);
    expect(validateExecuteDataSourceSql('ALTER TABLE demo ADD COLUMN x int', { allowWrite: true }).ok).toBe(false);
    expect(validateExecuteDataSourceSql('TRUNCATE TABLE demo', { allowWrite: true }).ok).toBe(false);
  });

  it('with allowWrite: true, still blocks a DDL statement smuggled via CTE and multi-statement input', () => {
    expect(validateExecuteDataSourceSql(
      'WITH x AS (DROP TABLE demo) SELECT 1',
      { allowWrite: true },
    ).ok).toBe(false);
    expect(validateExecuteDataSourceSql(
      "DELETE FROM demo WHERE id = 1; DELETE FROM demo2",
      { allowWrite: true },
    ).ok).toBe(false);
  });
});

describe('unwrapLeadingExplainSql', () => {
  it('returns the inner statement for EXPLAIN and EXPLAIN ANALYZE', () => {
    expect(unwrapLeadingExplainSql('EXPLAIN SELECT 1')).toBe('SELECT 1');
    expect(unwrapLeadingExplainSql('explain analyze select * from demo;')).toBe('select * from demo');
  });

  it('returns null when the statement is not EXPLAIN', () => {
    expect(unwrapLeadingExplainSql('SELECT 1')).toBeNull();
  });
});

describe('sqlServerRowsLookLikeShowPlan', () => {
  it('accepts SHOWPLAN_ALL column names', () => {
    expect(sqlServerRowsLookLikeShowPlan([{ StmtText: 'SELECT 1', PhysicalOp: 'Compute Scalar' }])).toBe(true);
  });

  it('rejects ordinary query result rows', () => {
    expect(sqlServerRowsLookLikeShowPlan([{ email: 'a@b.test', id: 1 }])).toBe(false);
  });
});
