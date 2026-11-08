import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  extractSqlTargetTables,
  filterControlPlaneSchemaDiffSql,
  listPrismaMappedTableNames,
  normalizeSqlTableName,
  parseCommaSeparatedTableNames,
  splitPrismaMigrateDiffScript,
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
    expect(tables.has('vx_members')).toBe(false);
  });

  it('normalizes quoted identifiers across dialects', () => {
    expect(normalizeSqlTableName('[dbo].[vx_members]')).toBe('vx_members');
    expect(normalizeSqlTableName('"public"."vx_members"')).toBe('vx_members');
    expect(normalizeSqlTableName('`vx_members`')).toBe('vx_members');
  });

  it('parses optional comma-separated table lists', () => {
    expect(parseCommaSeparatedTableNames('vx_members, etl_map')).toEqual(new Set([
      'vx_members',
      'etl_map',
    ]));
  });

  it('splits Prisma migrate-diff comment blocks', () => {
    const blocks = splitPrismaMigrateDiffScript(`
-- DropTable
DROP TABLE "vx_members";

-- CreateTable
CREATE TABLE "base_widgets" (
    "id" INTEGER NOT NULL
);
`);
    expect(blocks.map((block) => block.header)).toEqual(['DropTable', 'CreateTable']);
  });

  it('extracts TABLE / ON / INTO targets', () => {
    expect(extractSqlTargetTables('DROP TABLE [dbo].[vx_members];')).toEqual(['vx_members']);
    expect(extractSqlTargetTables('CREATE UNIQUE INDEX "x" ON "base_users"("email");')).toEqual(['base_users']);
  });

  it('preserves unknown tables and still applies Prisma CREATE / SQLite redefine', () => {
    const script = `-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "vx_members";
PRAGMA foreign_keys=on;

-- DropTable
DROP TABLE [dbo].[etl_map];

-- DropForeignKey
ALTER TABLE "vx_members" DROP CONSTRAINT "vx_members_org_fkey";

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
    expect(filtered.appliedSql).not.toMatch(/DROP TABLE\s+"vx_members"/i);
    expect(filtered.appliedSql).not.toMatch(/DROP TABLE\s+\[dbo\]\.\[etl_map\]/i);
    expect(filtered.appliedSql).not.toContain('DROP COLUMN "vertical_extra"');
    expect(filtered.appliedSql).not.toContain('vx_members_org_fkey');
    expect(filtered.skipped.some((item) => item.tables.includes('vx_members'))).toBe(true);
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
      `-- DropTable\nDROP TABLE "old_tmp";\n\n-- DropTable\nDROP TABLE "vx_members";\n`,
      {
        prismaTables: listPrismaMappedTableNames(MINI_SCHEMA),
        allowDropTables: ['old_tmp'],
      },
    );
    expect(filtered.appliedSql).toContain('DROP TABLE "old_tmp"');
    expect(filtered.appliedSql).not.toContain('vx_members');
  });
});
