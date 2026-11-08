import { describe, expect, it } from 'vitest';
import { buildSchemaObjectRunSqlTemplate, canRunSchemaObjectKind } from '../schemaObjectRunSqlTemplates';

describe('schemaObjectRunSqlTemplates', () => {
  it('enables run for script objects but not tables', () => {
    expect(canRunSchemaObjectKind('PostgreSQL', 'TABLE')).toBe(false);
    expect(canRunSchemaObjectKind('PostgreSQL', 'VIEW')).toBe(true);
    expect(canRunSchemaObjectKind('SQLite', 'STORED_PROCEDURE')).toBe(false);
    expect(canRunSchemaObjectKind('SQLite', 'VIEW')).toBe(true);
  });

  it('builds PostgreSQL usage SQL templates', () => {
    expect(buildSchemaObjectRunSqlTemplate('PostgreSQL', 'VIEW', 'customer_summary')).toBe(
      'SELECT * FROM "customer_summary" LIMIT 100',
    );
    expect(buildSchemaObjectRunSqlTemplate('PostgreSQL', 'STORED_PROCEDURE', 'sync_rows')).toBe(
      'CALL "sync_rows"()',
    );
    expect(buildSchemaObjectRunSqlTemplate('PostgreSQL', 'SCALAR_FUNCTION', 'get_count')).toBe(
      'SELECT "get_count"() AS result',
    );
  });
});
