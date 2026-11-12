import { describe, expect, it, vi } from 'vitest';

import { toPrismaCliSqlServerUrl } from '../prismaCliSqlServerUrl';

vi.mock('../../../core/database/sqlServerLocalInstancePort', () => ({
  resolveLocalSqlInstancePortFromRegistrySync: (name: string) =>
    (name === 'SQL2025' ? 64352 : null),
}));

describe('toPrismaCliSqlServerUrl', () => {
  it('rewrites named instance host to host,port for Prisma CLI', () => {
    const live =
      'sqlserver://localhost\\SQL2025;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true';
  const out = toPrismaCliSqlServerUrl(live);
    expect(out).toContain('sqlserver://localhost:64352;');
    expect(out).not.toContain('SQL2025');
    expect(out).toContain('password=secret');
  });

  it('leaves postgres urls unchanged', () => {
    const url = 'postgresql://u:p@localhost:5432/db';
    expect(toPrismaCliSqlServerUrl(url)).toBe(url);
  });
});
