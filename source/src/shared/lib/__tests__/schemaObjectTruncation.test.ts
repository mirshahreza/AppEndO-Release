import { describe, expect, it } from 'vitest';
import { buildTruncateTableStatement } from '../schemaObjectTruncation';

describe('buildTruncateTableStatement', () => {
  it('builds PostgreSQL truncate DDL', () => {
    expect(buildTruncateTableStatement('PostgreSQL', {
      objectName: 'widgets',
    })).toBe('TRUNCATE TABLE "widgets" RESTART IDENTITY CASCADE');
  });

  it('builds SQLite delete-from fallback', () => {
    expect(buildTruncateTableStatement('SQLite', {
      objectName: 'widgets',
    })).toBe('DELETE FROM widgets');
  });

  it('rejects control-plane object names', () => {
    expect(() => buildTruncateTableStatement('PostgreSQL', {
      objectName: 'base_users',
    })).toThrow(/Control-plane/);
  });
});
