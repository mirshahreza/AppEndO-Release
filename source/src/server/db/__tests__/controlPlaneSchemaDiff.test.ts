import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  countEmptySqlStatements,
  extractSqlTargetTables,
  filterControlPlaneSchemaDiffSql,
  listPrismaMappedTableNames,
  normalizeSqlTableName,
  parseCommaSeparatedTableNames,
  peelSqlServerMigrationEnvelope,
  splitPrismaMigrateDiffScript,
  sqlBatchBalanceIssues,
} from '../controlPlaneSchemaDiff';

const MINI_SCHEMA = `
model BaseUser {
  id BigInt @id
  @@map("base_users")
}

model BaseWidget {
  id Int @id
  @@map("base_widgets")
}

model UnmappedModel {
  id Int @id
}
`;

describe('controlPlaneSchemaDiff', () => {
  it('lists @@map table names and unmapped model names from a Prisma schema', () => {
    expect(listPrismaMappedTableNames(MINI_SCHEMA)).toEqual(new Set([
      'base_users',
      'base_widgets',
      'unmappedmodel',
    ]));
  });

  it('reads physical Prisma table names from the locked control-plane schema', () => {
    const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    const tables = listPrismaMappedTableNames(schema);
    expect(tables.has('base_users')).toBe(true);
    expect(tables.has('extx_members')).toBe(false);
  });

  it('normalizes quoted identifiers across dialects', () => {
    expect(normalizeSqlTableName('[dbo].[extx_members]')).toBe('extx_members');
    expect(normalizeSqlTableName('"public"."extx_members"')).toBe('extx_members');
    expect(normalizeSqlTableName('`extx_members`')).toBe('extx_members');
  });

  it('parses optional comma-separated table lists', () => {
    expect(parseCommaSeparatedTableNames('extx_members, etl_map')).toEqual(new Set([
      'extx_members',
      'etl_map',
    ]));
  });

  it('splits Prisma migrate-diff comment blocks', () => {
    const blocks = splitPrismaMigrateDiffScript(`
-- DropTable
DROP TABLE "extx_members";

-- CreateTable
CREATE TABLE "base_widgets" (
    "id" INTEGER NOT NULL
);
`);
    expect(blocks.map((block) => block.header)).toEqual(['DropTable', 'CreateTable']);
  });

  it('extracts TABLE / ON / INTO targets', () => {
    expect(extractSqlTargetTables('DROP TABLE [dbo].[extx_members];')).toEqual(['extx_members']);
    expect(extractSqlTargetTables('CREATE UNIQUE INDEX "x" ON "base_users"("email");')).toEqual(['base_users']);
  });

  it('does not treat ON DELETE / ON UPDATE foreign key actions as table names', () => {
    const sqliteCreate = [
      '-- CreateTable',
      'CREATE TABLE "base_widgets" (',
      '    "id" INTEGER NOT NULL PRIMARY KEY,',
      '    "user_id" BIGINT NOT NULL,',
      '    CONSTRAINT "base_widgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "base_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
      ');',
    ].join('\n');
    expect(extractSqlTargetTables(sqliteCreate)).toEqual(['base_widgets']);

    const addFk = [
      '-- AddForeignKey',
      'ALTER TABLE "base_widgets" ADD CONSTRAINT "base_widgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "base_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;',
    ].join('\n');
    expect(extractSqlTargetTables(addFk)).toEqual(['base_widgets']);

    const result = filterControlPlaneSchemaDiffSql(`${sqliteCreate}\n\n${addFk}\n`, {
      prismaTables: listPrismaMappedTableNames(MINI_SCHEMA),
    });
    expect(result.appliedSql).toContain('CREATE TABLE "base_widgets"');
    expect(result.appliedSql).toContain('REFERENCES "base_users" ("id") ON DELETE CASCADE');
    expect(result.appliedSql).not.toContain('ADD CONSTRAINT "base_widgets_user_id_fkey"');
    expect(result.skipped).toEqual([
      expect.objectContaining({ header: 'AddForeignKey', tables: ['base_widgets'] }),
    ]);
  });

  it('preserves unknown tables and still applies Prisma CREATE / SQLite redefine', () => {
    const script = `-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "extx_members";
PRAGMA foreign_keys=on;

-- DropTable
DROP TABLE [dbo].[etl_map];

-- DropForeignKey
ALTER TABLE "extx_members" DROP CONSTRAINT "extx_members_org_fkey";

-- AlterTable
ALTER TABLE "base_users" ADD COLUMN "note" TEXT;

-- AlterTable
ALTER TABLE "base_users" DROP COLUMN "vertical_extra";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_base_widgets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);
INSERT INTO "new_base_widgets" ("id") SELECT "id" FROM "base_widgets";
DROP TABLE "base_widgets";
ALTER TABLE "new_base_widgets" RENAME TO "base_widgets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "base_users" (
    "id" BIGINT NOT NULL
);
`;

    const filtered = filterControlPlaneSchemaDiffSql(script, {
      prismaTables: listPrismaMappedTableNames(MINI_SCHEMA),
    });

    expect(filtered.appliedSql).toContain('ALTER TABLE "base_users" ADD COLUMN "note" TEXT');
    expect(filtered.appliedSql).toContain('CREATE TABLE "new_base_widgets"');
    expect(filtered.appliedSql).toContain('CREATE TABLE "base_users"');
    expect(filtered.appliedSql).not.toMatch(/DROP TABLE\s+"extx_members"/i);
    expect(filtered.appliedSql).not.toMatch(/DROP TABLE\s+\[dbo\]\.\[etl_map\]/i);
    expect(filtered.appliedSql).not.toContain('DROP COLUMN "vertical_extra"');
    expect(filtered.appliedSql).not.toContain('extx_members_org_fkey');
    expect(filtered.skipped.some((item) => item.tables.includes('extx_members'))).toBe(true);
    expect(filtered.skipped.some((item) => item.tables.includes('etl_map'))).toBe(true);
  });

  it('does not drop a Prisma table that was removed from the schema either', () => {
    const filtered = filterControlPlaneSchemaDiffSql(
      `-- DropTable\nDROP TABLE "base_legacy";\n`,
      { prismaTables: listPrismaMappedTableNames(MINI_SCHEMA) },
    );
    expect(filtered.appliedSql).toBe('');
    expect(filtered.skipped[0]?.header).toBe('DropTable');
  });

  it('applies an explicit allow-drop list only for those names', () => {
    const filtered = filterControlPlaneSchemaDiffSql(
      `-- DropTable\nDROP TABLE "old_tmp";\n\n-- DropTable\nDROP TABLE "extx_members";\n`,
      {
        prismaTables: listPrismaMappedTableNames(MINI_SCHEMA),
        allowDropTables: ['old_tmp'],
      },
    );
    expect(filtered.appliedSql).toContain('DROP TABLE "old_tmp"');
    expect(filtered.appliedSql).not.toContain('extx_members');
  });

  const SQLSERVER_ENVELOPE_CLOSE = `
COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
`;

  const SQLSERVER_TRY_OPEN = `/*
  Warnings:

  - You are about to drop the \`base_record_events\` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN TRY

BEGIN TRAN;
`;

  it('peels the Prisma sqlserver TRY/TRAN envelope off the step body', () => {
    const script = `${SQLSERVER_TRY_OPEN}
-- DropTable
DROP TABLE [dbo].[base_record_events];
${SQLSERVER_ENVELOPE_CLOSE}`;
    const peeled = peelSqlServerMigrationEnvelope(script);
    expect(peeled.opening).toMatch(/BEGIN TRY/);
    expect(peeled.opening).toMatch(/BEGIN TRAN;/);
    expect(peeled.body).toContain('DROP TABLE [dbo].[base_record_events]');
    expect(peeled.body).not.toMatch(/COMMIT TRAN/);
    expect(peeled.closing).toMatch(/END TRY/);
    expect(peeled.closing).toMatch(/BEGIN CATCH/);
    expect(peeled.closing).toMatch(/END CATCH/);
  });

  it('keeps a balanced sqlserver batch when DropTable steps are removed, including a trailing drop', () => {
    const script = `${SQLSERVER_TRY_OPEN}
-- DropForeignKey
ALTER TABLE [dbo].[base_record_events] DROP CONSTRAINT [base_record_events_actor_fkey];

-- DropTable
DROP TABLE [dbo].[base_control_plane_boot_markers];

-- DropTable
DROP TABLE [dbo].[base_credential_vault_secrets];

-- AlterTable
ALTER TABLE [dbo].[base_users] ADD [note] NVARCHAR(max);

-- CreateTable
CREATE TABLE [dbo].[base_widgets] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [base_widgets_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- DropTable
DROP TABLE [dbo].[base_record_event_holds];

-- DropTable
DROP TABLE [dbo].[base_record_events];

;

-- DropTable
DROP TABLE [dbo].[base_user_message_dispatches];
${SQLSERVER_ENVELOPE_CLOSE}`;

    const filtered = filterControlPlaneSchemaDiffSql(script, {
      prismaTables: listPrismaMappedTableNames(MINI_SCHEMA),
    });

    expect(filtered.appliedSql).toContain('ALTER TABLE [dbo].[base_users] ADD [note] NVARCHAR(max)');
    expect(filtered.appliedSql).toContain('CREATE TABLE [dbo].[base_widgets]');
    expect(filtered.appliedSql).not.toMatch(/DROP TABLE/i);
    expect(filtered.appliedSql).not.toContain('base_record_events_actor_fkey');
    expect(filtered.appliedSql).toMatch(/BEGIN TRY/);
    expect(filtered.appliedSql).toMatch(/BEGIN TRAN;/);
    expect(filtered.appliedSql).toMatch(/COMMIT TRAN;/);
    expect(filtered.appliedSql).toMatch(/END TRY/);
    expect(filtered.appliedSql).toMatch(/BEGIN CATCH/);
    expect(filtered.appliedSql).toMatch(/END CATCH/);
    expect(sqlBatchBalanceIssues(filtered.appliedSql)).toEqual([]);
    expect(countEmptySqlStatements(filtered.appliedSql)).toBe(0);
    expect(filtered.skipped.map((item) => item.tables[0])).toEqual(expect.arrayContaining([
      'base_control_plane_boot_markers',
      'base_credential_vault_secrets',
      'base_record_event_holds',
      'base_record_events',
      'base_user_message_dispatches',
    ]));
    expect(filtered.skipped.every((item) => item.reason.startsWith('managed outside Prisma'))).toBe(true);
  });

  it('does not emit an empty BEGIN TRY/TRAN batch when every step is a managed DropTable', () => {
    const script = `${SQLSERVER_TRY_OPEN}
-- DropTable
DROP TABLE [dbo].[base_control_plane_boot_markers];

-- DropTable
DROP TABLE [dbo].[base_credential_vault_secrets];

-- DropTable
DROP TABLE [dbo].[base_record_event_holds];

-- DropTable
DROP TABLE [dbo].[base_record_events];

-- DropTable
DROP TABLE [dbo].[base_user_message_dispatches];
${SQLSERVER_ENVELOPE_CLOSE}`;

    const filtered = filterControlPlaneSchemaDiffSql(script, {
      prismaTables: listPrismaMappedTableNames(MINI_SCHEMA),
    });

    expect(filtered.appliedSql).toBe('');
    expect(sqlBatchBalanceIssues(filtered.appliedSql)).toEqual([]);
    expect(countEmptySqlStatements(filtered.appliedSql)).toBe(0);
    expect(filtered.skipped).toHaveLength(5);
  });

  it('flags the unclosed TRY/TRAN batch the old splitter left behind', () => {
    const broken = 'BEGIN TRY\n\nBEGIN TRAN;\n';
    expect(sqlBatchBalanceIssues(broken)).toEqual(expect.arrayContaining([
      'unclosed BEGIN TRY',
      'unclosed BEGIN TRAN',
    ]));
  });
});
