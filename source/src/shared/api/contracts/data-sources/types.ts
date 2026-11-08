export enum DataSourceType {
  POSTGRES = 'PostgreSQL',
  MYSQL = 'MySQL',
  SQLITE = 'SQLite',
  ORACLE = 'Oracle',
  SQL_SERVER = 'SQL Server',
  OLAP_BRIDGE = 'OLAP Bridge',
  MONGODB_ANALYTICS = 'MongoDB Analytics',
  ELASTICSEARCH_ANALYTICS = 'Elasticsearch Analytics',
}

export type DataSourceStatus = 'connected' | 'disconnected' | 'error' | 'testing';

export type DataSourceRecord = {
  id: string;
  name: string;
  type: DataSourceType;
  host: string;
  port: number;
  database?: string;
  username?: string;
  hasPassword?: boolean;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  pooling?: boolean;
  options?: Record<string, unknown>;
  status: DataSourceStatus;
  isDefault?: boolean;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string;
  updated_by?: string | null;
};

export type DataSourceFormState = {
  name: string;
  type: DataSourceType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  pooling: boolean;
  optionsJson: string;
};

export type SaveDataSourcePayload = {
  name: string;
  type: DataSourceType;
  host: string;
  port: number;
  database: string | null;
  username?: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  pooling?: boolean;
  options?: Record<string, unknown>;
};

export type UpdateDataSourcePayload = Partial<SaveDataSourcePayload>;

export type TestDraftDataSourcePayload = Omit<SaveDataSourcePayload, 'name'>;

export type ConnectivityTestResult = {
  status?: DataSourceStatus;
  message?: string;
  error?: string;
  success?: boolean;
};

export type TestAllConnectivityResult = {
  success?: boolean;
  error?: string;
  items?: Array<{ id?: string; status?: DataSourceStatus; message?: string }>;
};
