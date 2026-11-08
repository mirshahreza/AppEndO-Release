import { describe, expect, it } from 'vitest';
import {
  buildSchemaObjectSqlTemplate,
  canCreateSchemaObjectKind,
  usesSqlEditorForCreate,
  usesSqlEditorForEdit,
} from '../schemaObjectSqlTemplates';

describe('schemaObjectSqlTemplates', () => {
  it('uses SQL editor for non-table object kinds', () => {
    expect(usesSqlEditorForCreate('TABLE')).toBe(false);
    expect(usesSqlEditorForCreate('VIEW')).toBe(true);
    expect(usesSqlEditorForCreate('STORED_PROCEDURE')).toBe(true);
    expect(usesSqlEditorForEdit('VIEW')).toBe(true);
    expect(usesSqlEditorForEdit('TABLE')).toBe(false);
  });

  it('builds starter SQL templates with the chosen object name', () => {
    expect(buildSchemaObjectSqlTemplate('PostgreSQL', 'VIEW', 'customer_summary')).toContain(
      'CREATE VIEW "customer_summary"',
    );
    expect(buildSchemaObjectSqlTemplate('PostgreSQL', 'STORED_PROCEDURE', 'sync_rows')).toContain(
      'CREATE OR REPLACE PROCEDURE "sync_rows"',
    );
    expect(buildSchemaObjectSqlTemplate('SQLite', 'VIEW', 'active_rows')).toBe([
      '-- Write your script here',
      'CREATE VIEW active_rows AS',
      'SELECT 1 AS id;',
    ].join('\n'));
  });

  it('flags unsupported dialect and object kind combinations', () => {
    expect(canCreateSchemaObjectKind('SQLite', 'VIEW')).toBe(true);
    expect(canCreateSchemaObjectKind('SQLite', 'STORED_PROCEDURE')).toBe(false);
    expect(canCreateSchemaObjectKind('PostgreSQL', 'TABLE_VALUED_FUNCTION')).toBe(true);
  });
});
