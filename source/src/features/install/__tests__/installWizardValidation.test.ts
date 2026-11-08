import { describe, expect, it } from 'vitest';

import { defaultDatabaseNameForProvider, defaultDatabaseUsernameForProvider, controlPlaneProviderFromDataSourceType, controlPlaneProviderToDataSourceType } from '../../../shared/api/contracts/install/controlPlaneProviders';
import {
  defaultDatabasePortForProvider,
  validateDatabaseStep,
  validateEmailStep,
  validateInstallWizardStep,
} from '../../../features/install/installWizardValidation';

describe('installWizardValidation database step', () => {
  it('accepts sqlite file path without host credentials', () => {
    const result = validateDatabaseStep({
      provider: 'sqlite',
      host: '',
      port: 0,
      database: 'data/appendo-control.db',
      username: '',
      password: '',
    });
    expect(result.valid).toBe(true);
  });

  it('requires host for postgresql', () => {
    const result = validateDatabaseStep({
      provider: 'postgresql',
      host: '',
      port: 5432,
      database: 'AppEnd',
      username: 'postgres',
      password: '',
    });
    expect(result.valid).toBe(false);
  });

  it('requires port for sqlserver', () => {
    const missingPort = validateDatabaseStep({
      provider: 'sqlserver',
      host: 'localhost',
      port: 0,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
    });
    expect(missingPort.valid).toBe(false);

    const withPort = validateDatabaseStep({
      provider: 'sqlserver',
      host: 'localhost',
      port: 1433,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
    });
    expect(withPort.valid).toBe(true);
  });

  it('allows sqlserver named instance without port', () => {
    const result = validateDatabaseStep({
      provider: 'sqlserver',
      host: 'localhost\\SQLEXPRESS',
      port: 0,
      database: 'AppEnd',
      username: 'sa',
      password: 'secret',
    });
    expect(result.valid).toBe(true);
  });

  it('returns default ports per provider', () => {
    expect(defaultDatabasePortForProvider('postgresql')).toBe(5432);
    expect(defaultDatabasePortForProvider('mysql')).toBe(3306);
    expect(defaultDatabasePortForProvider('sqlite')).toBe(0);
    expect(defaultDatabasePortForProvider('sqlserver')).toBe(1433);
  });

  it('returns default usernames per provider', () => {
    expect(defaultDatabaseUsernameForProvider('postgresql')).toBe('postgres');
    expect(defaultDatabaseUsernameForProvider('mysql')).toBe('root');
    expect(defaultDatabaseUsernameForProvider('sqlserver')).toBe('sa');
    expect(defaultDatabaseUsernameForProvider('sqlite')).toBe('');
  });

  it('returns default database names per provider', () => {
    expect(defaultDatabaseNameForProvider('postgresql')).toBe('AppEnd');
    expect(defaultDatabaseNameForProvider('mysql')).toBe('AppEnd');
    expect(defaultDatabaseNameForProvider('sqlserver')).toBe('AppEnd');
    expect(defaultDatabaseNameForProvider('sqlite')).toBe('data/appendo-control.db');
  });

  it('maps legacy data source types to control plane providers', () => {
    expect(controlPlaneProviderFromDataSourceType('PostgreSQL')).toBe('postgresql');
    expect(controlPlaneProviderFromDataSourceType('SQL Server')).toBe('sqlserver');
    expect(controlPlaneProviderFromDataSourceType('MySQL')).toBe('mysql');
    expect(controlPlaneProviderFromDataSourceType('SQLite')).toBe('sqlite');
    expect(controlPlaneProviderFromDataSourceType('Redis')).toBeUndefined();
  });

  it('maps control plane providers to legacy data source types', () => {
    expect(controlPlaneProviderToDataSourceType('postgresql')).toBe('PostgreSQL');
    expect(controlPlaneProviderToDataSourceType('sqlserver')).toBe('SQL Server');
    expect(controlPlaneProviderToDataSourceType('mysql')).toBe('MySQL');
    expect(controlPlaneProviderToDataSourceType('sqlite')).toBe('SQLite');
  });
});

describe('installWizardValidation email step', () => {
  it('requires smtp host when fields are empty', () => {
    const result = validateEmailStep({
      smtpHost: '',
      smtpPort: 0,
      smtpUser: '',
      smtpPass: '',
      smtpFromEmail: '',
      smtpFromName: '',
    });
    expect(result.valid).toBe(false);
  });
});

describe('installWizardValidation admin step', () => {
  const baseInput = {
    databaseForm: {
      provider: 'postgresql' as const,
      host: 'localhost',
      port: 5432,
      database: 'AppEnd',
      username: 'postgres',
      password: '',
    },
    adminEmail: '',
    adminUsername: '',
    adminPassword: '',
    adminConfirmPassword: '',
    capabilities: ['service' as const],
    nodeName: 'node-1',
    cacheDriver: 'memory' as const,
    redisForm: {
      host: '127.0.0.1',
      port: 6379,
      password: '',
      dbIndex: 0,
    },
    emailForm: {
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'user',
      smtpPass: 'pass',
      smtpFromEmail: 'from@example.com',
      smtpFromName: 'AppEndO',
      smtpSecure: false,
    },
  };

  it('skips admin validation when the admin step is disabled', () => {
    const result = validateInstallWizardStep('admin', {
      ...baseInput,
      adminStepEnabled: false,
    });
    expect(result.valid).toBe(true);
  });
});
