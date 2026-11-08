import { describe, expect, it } from 'vitest';
import { Sequelize } from 'sequelize';
import {
  buildMssqlControlPlaneSequelizeOptions,
  controlPlaneSequelizeSyncOptions,
  dialectForProvider,
  patchMssqlAlterColumnDefaults,
  rewriteMssqlChangeColumnQuery,
} from '../controlPlaneSequelize';

describe('controlPlaneSequelize', () => {
  it('maps the sqlserver provider to the mssql dialect', () => {
    expect(dialectForProvider('sqlserver')).toBe('mssql');
    expect(dialectForProvider('postgresql')).toBe('postgres');
    expect(dialectForProvider('sqlite')).toBe('sqlite');
    expect(dialectForProvider('mysql')).toBe('mysql');
  });

  it('does not pass Prisma sqlserver:// URLs to Sequelize (protocol is not a dialect)', () => {
    const url = 'sqlserver://localhost\\SQL2025;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true';
    expect(() => new Sequelize(url, { dialect: 'mssql', logging: false })).toThrow(
      /dialect sqlserver is not supported/i,
    );

    const options = buildMssqlControlPlaneSequelizeOptions(url);
    expect(options.dialect).toBe('mssql');
    expect(options.host).toBe('localhost');
    expect(options.database).toBe('AppEnd');
    expect(options.username).toBe('sa');
    expect(
      (options.dialectOptions as { options?: { instanceName?: string } }).options?.instanceName,
    ).toBe('SQL2025');

    const sequelize = new Sequelize(options);
    expect(sequelize.getDialect()).toBe('mssql');
    void sequelize.close();
  });

  it('rewrites ALTER COLUMN DEFAULT into a SQL Server default constraint', () => {
    const sql = rewriteMssqlChangeColumnQuery(
      'base_record_events',
      { outcome: "NVARCHAR(16) NOT NULL DEFAULT N'success'" },
      (_table, attrs) => `ALTER TABLE [base_record_events] ALTER COLUMN [outcome] ${attrs.outcome};`,
    );
    expect(sql).toContain('ALTER COLUMN [outcome] NVARCHAR(16) NOT NULL;');
    expect(sql).not.toMatch(/ALTER COLUMN \[outcome\] NVARCHAR\(16\) NOT NULL DEFAULT/i);
    expect(sql).toContain("ADD CONSTRAINT [DF_base_record_events_outcome] DEFAULT N'success' FOR [outcome]");
    expect(sql).toContain('DROP CONSTRAINT');
  });

  it('leaves ALTER COLUMN without DEFAULT unchanged', () => {
    const original = 'ALTER TABLE [t] ALTER COLUMN [col] NVARCHAR(64) NOT NULL;';
    const sql = rewriteMssqlChangeColumnQuery(
      't',
      { col: 'NVARCHAR(64) NOT NULL' },
      () => original,
    );
    expect(sql).toBe(original);
  });

  it('patches the live MSSQL query generator so ALTER COLUMN does not keep DEFAULT', () => {
    const sequelize = new Sequelize(buildMssqlControlPlaneSequelizeOptions(
      'sqlserver://localhost,1433;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true',
    ));
    patchMssqlAlterColumnDefaults(sequelize);
    const sql = sequelize.dialect.queryGenerator.changeColumnQuery('base_record_events', {
      outcome: "NVARCHAR(16) NOT NULL DEFAULT N'success'",
    });
    expect(sql).not.toMatch(/ALTER COLUMN \[[^\]]+\][^\n;]*DEFAULT/i);
    expect(sql).toContain("ADD CONSTRAINT [DF_base_record_events_outcome] DEFAULT N'success' FOR [outcome]");
    void sequelize.close();
  });

  it('keeps an explicit TCP port for host,port URLs', () => {
    const options = buildMssqlControlPlaneSequelizeOptions(
      'sqlserver://localhost,1433;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true',
    );
    expect(options.host).toBe('localhost');
    expect(options.port).toBe(1433);
    expect(
      (options.dialectOptions as { options?: { instanceName?: string } }).options?.instanceName,
    ).toBeUndefined();
  });

  it('skips alter:true on SQLite so unique indexes are not rebuilt', () => {
    const sqlite = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    const mssql = new Sequelize(buildMssqlControlPlaneSequelizeOptions(
      'sqlserver://localhost,1433;database=AppEnd;user=sa;password=secret;encrypt=true;trustServerCertificate=true',
    ));
    expect(controlPlaneSequelizeSyncOptions(sqlite)).toEqual({});
    expect(controlPlaneSequelizeSyncOptions(mssql)).toEqual({ alter: true });
    void sqlite.close();
    void mssql.close();
  });
});
