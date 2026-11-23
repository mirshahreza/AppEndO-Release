import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');
const GENERATED_CLASS_PATH = path.join(process.cwd(), 'src', 'generated', 'prisma', 'internal', 'class.ts');

const execSyncMock = vi.hoisted(() => vi.fn());
const compileGeneratedPrismaClientForNodeMock = vi.hoisted(() => vi.fn(() => 'client.runtime.mjs'));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execSync: execSyncMock,
  };
});

vi.mock('../generatedPrismaClientRuntime', () => ({
  compileGeneratedPrismaClientForNode: compileGeneratedPrismaClientForNodeMock,
}));

import {
  CONTROL_PLANE_SCHEMA_PUSH_CONSENT,
  applyAdditiveControlPlaneSchema,
  buildControlPlanePrismaConfigSource,
  generatePrismaClientForRuntimeProvider,
  pushControlPlaneSchema,
  readGeneratedPrismaActiveProvider,
  reconcilePrismaClientAfterSchemaOperation,
} from '../controlPlaneSchemaPush';

const withGeneratedActiveProvider = (
  provider: 'postgresql' | 'sqlserver',
  run: () => void,
): void => {
  const originalGenerated = fs.readFileSync(GENERATED_CLASS_PATH, 'utf8');
  const patchedGenerated = originalGenerated.replace(
    /"activeProvider":\s*"(postgresql|mysql|sqlite|sqlserver)"/,
    `"activeProvider": "${provider}"`,
  );

  try {
    fs.writeFileSync(GENERATED_CLASS_PATH, patchedGenerated, 'utf8');
    run();
  } finally {
    fs.writeFileSync(GENERATED_CLASS_PATH, originalGenerated, 'utf8');
  }
};

describe('controlPlaneSchemaPush runtime client helpers', () => {
  afterEach(() => {
    execSyncMock.mockReset();
    compileGeneratedPrismaClientForNodeMock.mockClear();
  });

  it('reads active provider from generated Prisma client', () => {
    withGeneratedActiveProvider('postgresql', () => {
      expect(readGeneratedPrismaActiveProvider()).toBe('postgresql');
    });
  });

  it('skips generate when generated client already matches runtime provider', () => {
    withGeneratedActiveProvider('postgresql', () => {
      generatePrismaClientForRuntimeProvider({
        provider: 'postgresql',
        url: 'postgresql://postgres:secret@localhost:5432/AppEnd',
      });

      expect(execSyncMock).not.toHaveBeenCalled();
      expect(compileGeneratedPrismaClientForNodeMock).not.toHaveBeenCalled();
    });
  });

  it('uses a temp schema file and generates client for non-postgresql runtime provider', () => {
    const originalSchema = fs.readFileSync(SCHEMA_PATH, 'utf8');

    withGeneratedActiveProvider('postgresql', () => {
      generatePrismaClientForRuntimeProvider({
        provider: 'sqlserver',
        url: 'sqlserver://localhost,1433;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true',
      });

      expect(execSyncMock).toHaveBeenCalledTimes(1);
      expect(compileGeneratedPrismaClientForNodeMock).toHaveBeenCalledWith({ force: true });
      const [command, options] = execSyncMock.mock.calls[0] ?? [];
      expect(String(command)).toContain('npx prisma generate');
      expect(String(command)).toContain('--schema');
      expect(String(command)).not.toContain(SCHEMA_PATH);
      expect(options).toEqual(expect.objectContaining({
        env: expect.objectContaining({
          DATABASE_URL: expect.stringContaining('sqlserver://'),
        }),
        shell: true,
      }));
      expect(fs.readFileSync(SCHEMA_PATH, 'utf8')).toBe(originalSchema);
    });
  });

  it('reconciles non-postgresql runtime client without mutating tracked schema.prisma', () => {
    const originalSchema = fs.readFileSync(SCHEMA_PATH, 'utf8');

    withGeneratedActiveProvider('postgresql', () => {
      reconcilePrismaClientAfterSchemaOperation({
        provider: 'sqlserver',
        url: 'sqlserver://localhost,1433;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true',
      });

      expect(execSyncMock).toHaveBeenCalledTimes(1);
      expect(compileGeneratedPrismaClientForNodeMock).toHaveBeenCalledWith({ force: true });
      expect(String(execSyncMock.mock.calls[0]?.[0])).toContain('npx prisma generate');
      expect(fs.readFileSync(SCHEMA_PATH, 'utf8')).toBe(originalSchema);
    });
  });

  it('uses migrate diff (not db push) and strips Cursor env on the additive path', () => {
    execSyncMock.mockReturnValue('');
    const previousCursor = process.env.CURSOR_TRACE_ID;
    const previousDestructive = process.env.CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE;
    process.env.CURSOR_TRACE_ID = 'cursor-agent-trace';
    delete process.env.CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE;

    try {
      const cleanup = pushControlPlaneSchema({
        provider: 'postgresql',
        url: 'postgresql://postgres:secret@localhost:5432/AppEnd',
      });
      cleanup();
    } finally {
      if (previousCursor === undefined) {
        delete process.env.CURSOR_TRACE_ID;
      } else {
        process.env.CURSOR_TRACE_ID = previousCursor;
      }
      if (previousDestructive === undefined) {
        delete process.env.CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE;
      } else {
        process.env.CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE = previousDestructive;
      }
    }

    const commands = execSyncMock.mock.calls.map(([command]) => String(command));
    expect(commands.some((command) => command.includes('migrate diff'))).toBe(true);
    expect(commands.some((command) => command.includes('db push'))).toBe(false);
    const diffCall = execSyncMock.mock.calls.find(([command]) => String(command).includes('migrate diff'));
    expect(diffCall?.[1]?.env).toEqual(expect.objectContaining({
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/AppEnd',
    }));
    expect(diffCall?.[1]?.env).not.toHaveProperty('CURSOR_TRACE_ID');
  });

  it('keeps prisma db push --accept-data-loss only on the explicit destructive path', () => {
    execSyncMock.mockReturnValue('');

    const cleanup = pushControlPlaneSchema({
      provider: 'postgresql',
      url: 'postgresql://postgres:secret@localhost:5432/AppEnd',
    }, { destructive: true });
    cleanup();

    const pushCall = execSyncMock.mock.calls.find(([command]) => String(command).includes('db push'));
    expect(pushCall).toBeDefined();
    expect(String(pushCall?.[0])).toContain('--accept-data-loss');
    expect(pushCall?.[1]).toEqual(expect.objectContaining({
      env: expect.objectContaining({
        DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/AppEnd',
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: CONTROL_PLANE_SCHEMA_PUSH_CONSENT,
      }),
    }));
  });

  it('does not execute DROP TABLE for unknown tables returned by migrate diff', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-schema-push-'));
    const schemaPath = path.join(tmpDir, 'schema.prisma');
    fs.writeFileSync(schemaPath, `
datasource db { provider = "sqlite" }
model BaseWidget {
  id Int @id @default(autoincrement())
  @@map("base_widgets")
}
`, 'utf8');

    execSyncMock.mockImplementation((command: string) => {
      if (String(command).includes('migrate diff')) {
        return `-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "extx_members";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "base_widgets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);
`;
      }
      return 'Script executed successfully.\n';
    });

    try {
      const result = applyAdditiveControlPlaneSchema('file:/tmp/appendo-additive-test.db', schemaPath, {
        provider: 'sqlite',
      });
      expect(result.skippedCount).toBeGreaterThan(0);
      expect(result.appliedSql).toContain('CREATE TABLE "base_widgets"');
      expect(result.appliedSql).not.toMatch(/DROP TABLE\s+"extx_members"/i);

      const executeCall = execSyncMock.mock.calls.find(([command]) => String(command).includes('db execute'));
      expect(executeCall).toBeDefined();
      const fileArg = String(executeCall?.[0]).match(/--file\s+"([^"]+)"/)?.[1]
        ?? String(executeCall?.[0]).match(/--file\s+(\S+)/)?.[1];
      expect(fileArg).toBeTruthy();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('declares Sequelize tables as Prisma external tables on the sqlserver diff config', () => {
    const source = buildControlPlanePrismaConfigSource(
      '/tmp/schema.prisma',
      'sqlserver://localhost;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true',
      'sqlserver',
    );
    expect(source).toContain('externalTables: true');
    expect(source).toContain('"dbo.base_record_events"');
    expect(source).toContain('"dbo.base_credential_vault_secrets"');
    expect(source).toContain('"dbo.base_control_plane_boot_markers"');
    expect(source).toContain('"dbo.base_user_message_dispatches"');
    expect(source).toContain('"dbo.base_record_event_holds"');
    expect(source).not.toContain('dbo.base_users');
    expect(source).not.toContain('dbo.base_logs_app');
  });

  it('keeps the filtered SQL file when execute fails', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-schema-push-'));
    const schemaPath = path.join(tmpDir, 'schema.prisma');
    fs.writeFileSync(schemaPath, `
datasource db { provider = "sqlserver" }
model BaseWidget {
  id Int @id @default(autoincrement())
  @@map("base_widgets")
}
`, 'utf8');

    execSyncMock.mockImplementation((command: string) => {
      const text = String(command);
      if (text.includes('migrate diff')) {
        return `BEGIN TRY

BEGIN TRAN;

-- DropTable
DROP TABLE [dbo].[base_record_events];

-- CreateTable
CREATE TABLE [dbo].[base_widgets] (
    [id] INT NOT NULL IDENTITY(1,1),
    CONSTRAINT [base_widgets_pkey] PRIMARY KEY CLUSTERED ([id])
);

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
      }
      if (text.includes('db execute')) {
        const error = new Error('Incorrect syntax near \';\'.') as Error & { stdout?: string; stderr?: string };
        error.stdout = '';
        error.stderr = 'Incorrect syntax near \';\'.';
        throw error;
      }
      return '';
    });

    let thrown: unknown;
    try {
      applyAdditiveControlPlaneSchema(
        'sqlserver://localhost;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true',
        schemaPath,
        { provider: 'sqlserver' },
      );
    } catch (error) {
      thrown = error;
    }

    try {
      const message = thrown instanceof Error ? thrown.message : String(thrown ?? '');
      expect(message).toMatch(/Incorrect syntax near ';'/);
      const sqlPath = message.match(/kept for debugging: (\S+)/)?.[1];
      expect(sqlPath).toBeTruthy();
      const sql = fs.readFileSync(sqlPath ?? '', 'utf8');
      expect(sql).toContain('CREATE TABLE [dbo].[base_widgets]');
      expect(sql).not.toMatch(/DROP TABLE/i);
      expect(sql).toMatch(/END TRY/);
      expect(sql).toMatch(/END CATCH/);
      fs.unlinkSync(sqlPath ?? '');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
