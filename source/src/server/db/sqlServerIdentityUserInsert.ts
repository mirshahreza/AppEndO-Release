import { prisma } from '../domain/users/prismaHelpers';

export type SqlServerUserIdentityInsert = {
  id: number;
  username: string;
  email: string | null;
  passwordHash: string;
  isBuiltin?: boolean;
  mobile?: string | null;
  emailVerifiedAt?: Date | null;
  mobileVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  actorId?: number;
};

export type SqlServerIdentityInsertBatch = {
  sql: string;
  values: unknown[];
};

const requireSafeInt = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${label} for SQL Server identity insert.`);
  }
  return value;
};

/**
 * SQL Server only honors IDENTITY_INSERT for the current batch. Prisma `$executeRaw`
 * tagged templates run through `sp_executesql`, so SET IDENTITY_INSERT must share one
 * `$executeRawUnsafe` batch with the INSERT (same pattern as builtin role seed).
 *
 * String/date columns are bound as `@P*` parameters (SEC-1-3) — never interpolated.
 */
export const buildSqlServerUserIdentityInsertBatch = (
  input: SqlServerUserIdentityInsert,
): SqlServerIdentityInsertBatch => {
  const id = requireSafeInt(input.id, 'id');
  const actorId = requireSafeInt(input.actorId ?? input.id, 'actorId');
  const isBuiltin = (input.isBuiltin ?? true) ? 1 : 0;
  const hasSeedColumns = input.mobile !== undefined
    || input.emailVerifiedAt !== undefined
    || input.mobileVerifiedAt !== undefined
    || input.lastLoginAt !== undefined;

  const catchBlock = `
BEGIN CATCH
  SET IDENTITY_INSERT [base_users] OFF;
  THROW;
END CATCH`.trim();

  if (hasSeedColumns) {
    return {
      sql: `
SET IDENTITY_INSERT [base_users] ON;
BEGIN TRY
  INSERT INTO [base_users] (
    [id], [username], [email], [password_hash], [is_builtin], [mobile],
    [email_verified_at], [mobile_verified_at], [last_login_at]
  ) VALUES (
    @P1, @P2, @P3, @P4, @P5, @P6, @P7, @P8, @P9
  );
  SET IDENTITY_INSERT [base_users] OFF;
END TRY
${catchBlock}
`.trim(),
      values: [
        id,
        input.username,
        input.email,
        input.passwordHash,
        isBuiltin,
        input.mobile ?? null,
        input.emailVerifiedAt ?? null,
        input.mobileVerifiedAt ?? null,
        input.lastLoginAt ?? null,
      ],
    };
  }

  return {
    sql: `
SET IDENTITY_INSERT [base_users] ON;
BEGIN TRY
  INSERT INTO [base_users] (
    [id], [username], [email], [password_hash], [is_builtin], [created_by], [updated_by]
  ) VALUES (
    @P1, @P2, @P3, @P4, @P5, @P6, @P7
  );
  SET IDENTITY_INSERT [base_users] OFF;
END TRY
${catchBlock}
`.trim(),
    values: [
      id,
      input.username,
      input.email,
      input.passwordHash,
      isBuiltin,
      actorId,
      actorId,
    ],
  };
};

export async function insertSqlServerUserWithIdentity(input: SqlServerUserIdentityInsert): Promise<void> {
  const { sql, values } = buildSqlServerUserIdentityInsertBatch(input);
  await prisma().$executeRawUnsafe(sql, ...values);
}
