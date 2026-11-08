import { describe, expect, it } from 'vitest';
import { buildDropSchemaObjectStatement } from '../schemaObjectDeletion';

describe('buildDropSchemaObjectStatement', () => {
  it('builds PostgreSQL table drop DDL', () => {
    expect(buildDropSchemaObjectStatement('PostgreSQL', {
      objectName: 'widgets',
      objectType: 'TABLE',
    })).toBe('DROP TABLE IF EXISTS "widgets" CASCADE');
  });

  it('rejects control-plane object names', () => {
    expect(() => buildDropSchemaObjectStatement('PostgreSQL', {
      objectName: 'base_users',
      objectType: 'TABLE',
    })).toThrow(/Control-plane/);
  });
});
