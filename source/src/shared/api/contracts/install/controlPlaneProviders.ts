/** Control-plane relational providers (Prisma v1 — p-45). */
export type ControlPlaneProviderId = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

/** Recommended default — chosen in the install wizard, never inferred back to PostgreSQL. */
export const DEFAULT_CONTROL_PLANE_PROVIDER: ControlPlaneProviderId = 'sqlserver';

export type ControlPlaneProviderOption = {
  id: ControlPlaneProviderId;
  label: string;
  description: string;
  defaultPort: number;
};

export const CONTROL_PLANE_PROVIDER_OPTIONS: ControlPlaneProviderOption[] = [
  {
    id: 'sqlserver',
    label: 'SQL Server',
    description: 'Recommended default. Microsoft SQL Server with encrypt / trust certificate options.',
    defaultPort: 1433,
  },
  {
    id: 'postgresql',
    label: 'PostgreSQL',
    description: 'Optional PostgreSQL relational engine.',
    defaultPort: 5432,
  },
  {
    id: 'mysql',
    label: 'MySQL',
    description: 'MariaDB-compatible relational engine.',
    defaultPort: 3306,
  },
  {
    id: 'sqlite',
    label: 'SQLite',
    description: 'Single-file database for fast local installs.',
    defaultPort: 0,
  },
];

export const defaultDatabaseUsernameForProvider = (provider: ControlPlaneProviderId): string => {
  switch (provider) {
    case 'postgresql':
      return 'postgres';
    case 'mysql':
      return 'root';
    case 'sqlserver':
      return 'sa';
    case 'sqlite':
      return '';
  }
};

export const CONTROL_PLANE_PROVIDER_IDS = CONTROL_PLANE_PROVIDER_OPTIONS.map((item) => item.id);

export const isControlPlaneProviderId = (value: unknown): value is ControlPlaneProviderId =>
  CONTROL_PLANE_PROVIDER_IDS.includes(value as ControlPlaneProviderId);

export const controlPlaneProviderLabel = (provider: ControlPlaneProviderId): string =>
  CONTROL_PLANE_PROVIDER_OPTIONS.find((item) => item.id === provider)?.label ?? provider;

export const DEFAULT_SQLITE_INSTALL_DATABASE_PATH = 'data/appendo-control.db';

export const defaultDatabaseNameForProvider = (provider: ControlPlaneProviderId): string =>
  provider === 'sqlite' ? DEFAULT_SQLITE_INSTALL_DATABASE_PATH : 'AppEnd';

export const defaultDatabasePortForProvider = (provider: ControlPlaneProviderId): number =>
  CONTROL_PLANE_PROVIDER_OPTIONS.find((item) => item.id === provider)?.defaultPort
  ?? CONTROL_PLANE_PROVIDER_OPTIONS.find((item) => item.id === DEFAULT_CONTROL_PLANE_PROVIDER)?.defaultPort
  ?? 1433;

/** `settings.json` runtime.databaseProvider alias (`postgresql` → `postgres`). */
export const runtimeDatabaseProviderValue = (provider: ControlPlaneProviderId): string =>
  provider === 'postgresql' ? 'postgres' : provider;

export const defaultControlPlaneInstallFields = (): {
  provider: ControlPlaneProviderId;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
} => ({
  provider: DEFAULT_CONTROL_PLANE_PROVIDER,
  host: 'localhost',
  port: defaultDatabasePortForProvider(DEFAULT_CONTROL_PLANE_PROVIDER),
  database: defaultDatabaseNameForProvider(DEFAULT_CONTROL_PLANE_PROVIDER),
  username: defaultDatabaseUsernameForProvider(DEFAULT_CONTROL_PLANE_PROVIDER),
  password: '',
  encrypt: true,
  trustServerCertificate: true,
});

/** Map legacy settings `dataSources[].type` to control-plane provider id. */
export const controlPlaneProviderFromDataSourceType = (
  type: string,
): ControlPlaneProviderId | undefined => {
  switch (type.trim()) {
    case 'PostgreSQL':
      return 'postgresql';
    case 'SQL Server':
      return 'sqlserver';
    case 'MySQL':
      return 'mysql';
    case 'SQLite':
      return 'sqlite';
    default:
      return undefined;
  }
};

/** Map control-plane provider id to settings `dataSources[].type`. */
export const controlPlaneProviderToDataSourceType = (
  provider: ControlPlaneProviderId,
): string | undefined => {
  switch (provider) {
    case 'postgresql':
      return 'PostgreSQL';
    case 'sqlserver':
      return 'SQL Server';
    case 'mysql':
      return 'MySQL';
    case 'sqlite':
      return 'SQLite';
  }
};
