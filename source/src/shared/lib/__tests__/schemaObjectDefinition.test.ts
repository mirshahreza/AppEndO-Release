import { describe, expect, it } from 'vitest';
import {
  extractSchemaObjectDefinitionRow,
  formatPostgreSqlRoutineForEditor,
  normalizeSchemaObjectDefinition,
} from '../schemaObjectDefinition';

describe('extractSchemaObjectDefinitionRow', () => {
  it('prefers full CREATE statements from SHOW CREATE rows', () => {
    const definition = extractSchemaObjectDefinitionRow({
      View: 'customer_summary',
      'Create View': 'CREATE ALGORITHM=UNDEFINED VIEW `customer_summary` AS select 1 AS id',
    });

    expect(definition).toContain('CREATE');
    expect(definition).toContain('customer_summary');
  });
});

describe('normalizeSchemaObjectDefinition', () => {
  it('wraps PostgreSQL view bodies into CREATE OR REPLACE VIEW', () => {
    expect(normalizeSchemaObjectDefinition(
      'PostgreSQL',
      'VIEW',
      'customer_summary',
      ' SELECT 1::bigint AS id;',
    )).toBe([
      'CREATE OR REPLACE VIEW "customer_summary" AS',
      'SELECT 1::bigint AS id;',
    ].join('\n'));
  });

  it('keeps full CREATE statements unchanged', () => {
    const sql = 'CREATE OR REPLACE VIEW demo AS SELECT 1';
    expect(normalizeSchemaObjectDefinition('PostgreSQL', 'VIEW', 'demo', sql)).toBe(sql);
  });

  it('wraps SQL Server view bodies into CREATE VIEW', () => {
    expect(normalizeSchemaObjectDefinition(
      'SQL Server',
      'VIEW',
      'customer_summary',
      'SELECT CAST(1 AS BIGINT) AS id',
    )).toBe([
      'CREATE VIEW [customer_summary] AS',
      'SELECT CAST(1 AS BIGINT) AS id',
    ].join('\n'));
  });

  it('formats PostgreSQL procedure definitions for the SQL editor', () => {
    const formatted = formatPostgreSqlRoutineForEditor(
      'wwwwwwwwwwwwwwww',
      [
        'CREATE OR REPLACE PROCEDURE public.wwwwwwwwwwwwwwww()',
        ' LANGUAGE sql',
        'AS $procedure$SELECT 1;$procedure$',
      ].join('\n'),
    );

    expect(formatted).toBe([
      'CREATE OR REPLACE PROCEDURE "wwwwwwwwwwwwwwww"()',
      'LANGUAGE sql',
      "AS 'SELECT 1;'",
    ].join('\n'));
  });

  it('keeps multiline PostgreSQL routine bodies in dollar quotes', () => {
    const formatted = formatPostgreSqlRoutineForEditor(
      'sync_rows',
      [
        'CREATE OR REPLACE PROCEDURE public.sync_rows()',
        ' LANGUAGE plpgsql',
        'AS $procedure$',
        'BEGIN',
        '  PERFORM 1;',
        'END;',
        '$procedure$',
      ].join('\n'),
    );

    expect(formatted).toContain('CREATE OR REPLACE PROCEDURE "sync_rows"()');
    expect(formatted).toContain('LANGUAGE plpgsql');
    expect(formatted).toContain('AS $procedure$');
    expect(formatted).toContain('BEGIN');
  });
});
