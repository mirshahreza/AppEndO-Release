import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { patchPrismaSchemaForProvider } from '../controlPlaneSchemaPush';
import { buildAlterColumnSql } from '../controlPlaneSqlServerUnicode';

const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');

describe('patchPrismaSchemaForProvider', () => {
  it('replaces @db.Text with @db.NVarChar(Max) for SQL Server', () => {
    const original = fs.readFileSync(SCHEMA_PATH, 'utf8');

    const patched = patchPrismaSchemaForProvider('sqlserver', original);

    expect(patched).toContain('provider = "sqlserver"');
    expect(patched).not.toMatch(/@db\.Text\b/);
    expect(patched).toContain('@db.NVarChar(Max)');
    expect(patched).toContain('@map("messages_json") @db.NVarChar(Max)');
  });

  it('keeps @db.Text for PostgreSQL', () => {
    const original = fs.readFileSync(SCHEMA_PATH, 'utf8');

    const patched = patchPrismaSchemaForProvider('postgresql', original);

    expect(patched).toContain('provider = "postgresql"');
    expect(patched).toContain('@db.Text');
    expect(patched).not.toContain('@db.NVarChar(Max)');
  });

  it('rewrites cyclic SQL Server referential actions to NoAction', () => {
    const original = fs.readFileSync(SCHEMA_PATH, 'utf8');

    const patched = patchPrismaSchemaForProvider('sqlserver', original);

    expect(patched).toContain(
      '@relation("ScopeMembershipEventActor", fields: [actorUserId], references: [id], onDelete: NoAction, onUpdate: NoAction)',
    );
    expect(patched).toContain(
      '@relation("SampleMockTree", fields: [parentId], references: [id], onDelete: NoAction, onUpdate: NoAction)',
    );
    expect(patched).toContain(
      '@relation("SampleMockCommentAuthor", fields: [authorId], references: [id], onDelete: NoAction, onUpdate: NoAction)',
    );
    expect(patched).not.toMatch(/onDelete:\s*SetNull/);
    expect(patched).not.toMatch(/onUpdate:\s*Cascade/);
  });

  it('keeps SetNull referential actions for PostgreSQL', () => {
    const original = fs.readFileSync(SCHEMA_PATH, 'utf8');

    const patched = patchPrismaSchemaForProvider('postgresql', original);

    expect(patched).toContain('onDelete: SetNull');
  });

  it('strips @db.Text for SQLite and keeps BigInt on the runtime client schema', () => {
    const original = fs.readFileSync(SCHEMA_PATH, 'utf8');

    const patched = patchPrismaSchemaForProvider('sqlite', original);

    expect(patched).toContain('provider = "sqlite"');
    expect(patched).not.toMatch(/@db\.Text\b/);
    expect(patched).toMatch(/\bBigInt\b/);
    expect(patched).toContain('@map("messages_json")');
    expect(patched).toContain('onDelete: SetNull');
  });

  it('maps BigInt to Int when pushing SQLite SQL', () => {
    const original = fs.readFileSync(SCHEMA_PATH, 'utf8');

    const patched = patchPrismaSchemaForProvider('sqlite', original, { sqliteIntegerIds: true });

    expect(patched).not.toMatch(/\bBigInt\b/);
    expect(patched).toContain('Int    @id @default(autoincrement())');
  });
});

describe('buildAlterColumnSql', () => {
  it('drops default constraints before altering chat session json columns', () => {
    const sql = buildAlterColumnSql({
      table: 'base_ai_chat_sessions',
      column: 'messages_json',
      nullable: false,
      defaultSql: "N'[]'",
    });

    expect(sql).toContain('DROP CONSTRAINT');
    expect(sql).toContain("N'messages_json'");
    expect(sql).toContain('NVARCHAR(MAX) NOT NULL');
    expect(sql).toContain("DEFAULT N'[]'");
  });
});
