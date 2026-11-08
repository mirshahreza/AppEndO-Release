import { describe, expect, it } from 'vitest';

import { buildSqlServerUserIdentityInsertBatch } from '../sqlServerIdentityUserInsert';

describe('buildSqlServerUserIdentityInsertBatch', () => {
  it('puts IDENTITY_INSERT and INSERT in one batch so SQL Server accepts explicit ids', () => {
    const batch = buildSqlServerUserIdentityInsertBatch({
      id: 1_000_000,
      username: 'admin',
      email: null,
      passwordHash: 'hash',
    });

    expect(batch.sql).toMatch(/SET IDENTITY_INSERT \[base_users\] ON;/);
    expect(batch.sql).toContain('INSERT INTO [base_users]');
    expect(batch.sql.indexOf('SET IDENTITY_INSERT [base_users] ON;'))
      .toBeLessThan(batch.sql.indexOf('INSERT INTO [base_users]'));
    expect(batch.sql).toContain('[created_by]');
    expect(batch.sql).toMatch(/SET IDENTITY_INSERT \[base_users\] OFF;/);
    expect(batch.sql).toContain('@P2');
    expect(batch.sql).not.toContain("N'admin'");
    expect(batch.values).toEqual([1_000_000, 'admin', null, 'hash', 1, 1_000_000, 1_000_000]);
  });

  it('binds quotes in string values instead of interpolating literals (SEC-1-3)', () => {
    const batch = buildSqlServerUserIdentityInsertBatch({
      id: 1_000_000,
      username: "O'Brien'; DROP TABLE [base_users];--",
      email: "a'b@example.com",
      passwordHash: "p'w",
    });

    expect(batch.sql).not.toContain("O'Brien");
    expect(batch.sql).not.toContain('DROP TABLE');
    expect(batch.sql).not.toContain("N'");
    expect(batch.values[1]).toBe("O'Brien'; DROP TABLE [base_users];--");
    expect(batch.values[2]).toBe("a'b@example.com");
    expect(batch.values[3]).toBe("p'w");
  });

  it('includes seed profile columns when provided', () => {
    const verifiedAt = new Date('2026-08-23T12:00:00.000Z');
    const batch = buildSqlServerUserIdentityInsertBatch({
      id: 1_000_000,
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: 'hash',
      mobile: '0912',
      emailVerifiedAt: verifiedAt,
      mobileVerifiedAt: null,
      lastLoginAt: null,
    });

    expect(batch.sql).toContain('[mobile]');
    expect(batch.sql).toContain('@P6');
    expect(batch.sql).not.toContain('[created_by]');
    expect(batch.sql).not.toContain("N'0912'");
    expect(batch.values).toEqual([
      1_000_000,
      'admin',
      'admin@example.com',
      'hash',
      1,
      '0912',
      verifiedAt,
      null,
      null,
    ]);
  });
});
