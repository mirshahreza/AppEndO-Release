import { describe, expect, it } from 'vitest';
import {
  assertAlterSchemaSql,
  assertCreateSchemaSql,
  buildCreateSchemaObjectStatement,
} from '../schemaObjectCreation';

describe('buildCreateSchemaObjectStatement', () => {
  it('builds PostgreSQL table DDL', () => {
    expect(buildCreateSchemaObjectStatement('PostgreSQL', {
      objectName: 'widgets',
      objectType: 'TABLE',
    })).toContain('"widgets"');
    expect(buildCreateSchemaObjectStatement('PostgreSQL', {
      objectName: 'widgets',
      objectType: 'TABLE',
    })).toContain('BIGSERIAL PRIMARY KEY');
  });

  it('builds minimal script templates with SELECT 1', () => {
    expect(buildCreateSchemaObjectStatement('SQLite', {
      objectName: 'active_widgets',
      objectType: 'VIEW',
    })).toBe([
      '-- Write your script here',
      'CREATE VIEW active_widgets AS',
      'SELECT 1 AS id;',
    ].join('\n'));

    expect(buildCreateSchemaObjectStatement('PostgreSQL', {
      objectName: 'customer_summary',
      objectType: 'VIEW',
    })).toBe([
      '-- Write your script here',
      'CREATE VIEW "customer_summary" AS',
      'SELECT 1::bigint AS id;',
    ].join('\n'));

    expect(buildCreateSchemaObjectStatement('PostgreSQL', {
      objectName: 'sync_rows',
      objectType: 'PROCEDURE',
    })).toBe([
      '-- Write your script here',
      'CREATE OR REPLACE PROCEDURE "sync_rows"()',
      'LANGUAGE sql',
      "AS 'SELECT 1;';",
    ].join('\n'));

    const functionSql = buildCreateSchemaObjectStatement('PostgreSQL', {
      objectName: 'get_row_count',
      objectType: 'FUNCTION',
    });
    expect(functionSql).not.toContain('$body$');
    expect(functionSql).toContain("AS 'SELECT 1;';");

    expect(buildCreateSchemaObjectStatement('SQL Server', {
      objectName: 'sync_rows',
      objectType: 'PROCEDURE',
    })).toBe([
      '-- Write your script here',
      'CREATE PROCEDURE sync_rows',
      'AS',
      'BEGIN',
      '  SELECT 1;',
      'END',
    ].join('\n'));
  });

  it('rejects invalid object names', () => {
    expect(() => buildCreateSchemaObjectStatement('PostgreSQL', {
      objectName: 'bad-name',
      objectType: 'TABLE',
    })).toThrow(/underscores/i);
  });
});

describe('assertCreateSchemaSql', () => {
  it('accepts CREATE statements', () => {
    expect(assertCreateSchemaSql('CREATE VIEW demo AS SELECT 1')).toContain('CREATE VIEW');
  });

  it('accepts CREATE statements after leading SQL comments', () => {
    const sql = [
      '-- Write your script here',
      'CREATE OR REPLACE PROCEDURE "sync_rows"()',
      'LANGUAGE sql',
      "AS 'SELECT 1;';",
    ].join('\n');

    expect(assertCreateSchemaSql(sql)).toBe([
      'CREATE OR REPLACE PROCEDURE "sync_rows"()',
      'LANGUAGE sql',
      "AS 'SELECT 1;';",
    ].join('\n'));
  });

  it('accepts CREATE statements with CRLF line endings in leading comments', () => {
    const sql = '-- Write your script here\r\nCREATE VIEW demo AS SELECT 1';
    expect(assertCreateSchemaSql(sql)).toBe('CREATE VIEW demo AS SELECT 1');
  });

  it('rejects non-CREATE statements', () => {
    expect(() => assertCreateSchemaSql('DROP TABLE demo')).toThrow(/CREATE/);
  });
});

describe('assertAlterSchemaSql', () => {
  it('accepts CREATE OR REPLACE and ALTER statements', () => {
    expect(assertAlterSchemaSql('CREATE OR REPLACE VIEW demo AS SELECT 1')).toContain('CREATE OR REPLACE VIEW');
    expect(assertAlterSchemaSql('ALTER VIEW demo AS SELECT 1')).toContain('ALTER VIEW');
  });

  it('rejects destructive statements', () => {
    expect(() => assertAlterSchemaSql('DROP VIEW demo')).toThrow(/CREATE|ALTER/);
  });
});
