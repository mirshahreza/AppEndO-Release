import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import type { ServerFunctionHooksConfig } from '../../../shared/api/contracts/server-functions/hooks';

export interface ManagedFunctionMetadataFile {
  schema: 'append-server-function-metadata';
  schemaVersion: '2.0.0';
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
  sourceFile: string;
  language: string;
  testPayload: string;
  runtimeVersion: string;
  memoryLimit: number;
  timeoutMs: number;
  useGlobalConfig?: boolean;
  enableLogs?: boolean;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheByParam: boolean;
  cacheByUser: boolean;
  engineType: 'SANDBOX_JS' | 'DATA_API';
  metadataJson: string | null;
  accessControl?: FunctionAccessControl;
  hooks?: ServerFunctionHooksConfig;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ManagedFunctionRecord {
  metadata: ManagedFunctionMetadataFile;
  code: string;
}

export interface ManagedFunctionIndexEntry {
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
  sourceFile: string;
  metadataFile: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedFunctionIndex {
  schema: 'append-server-functions-index';
  schemaVersion: '2.0.0';
  updatedAt: string;
  functions: ManagedFunctionIndexEntry[];
}

/** API row shape — snake_case fields for GET /api/functions. */
export interface ManagedFunctionApiRow {
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
  code: string;
  language: string;
  test_payload: string;
  runtime_version: string;
  memory_limit: number;
  timeout_ms: number;
  use_global_config: boolean;
  enable_logs: boolean;
  cache_enabled: boolean;
  cache_ttl_ms: number;
  cache_by_param: boolean;
  cache_by_user: boolean;
  engine_type: 'SANDBOX_JS' | 'DATA_API';
  metadata_json: string | null;
  access_control: FunctionAccessControl;
  hooks: ServerFunctionHooksConfig;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ManagedFunctionCatalogRow {
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
}
