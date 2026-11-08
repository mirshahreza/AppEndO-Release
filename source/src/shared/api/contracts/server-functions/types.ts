export type ServerFunctionLanguage = 'ts' | 'js';

export type ServerFunctionMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ServerFunctionEngineType = 'SANDBOX_JS' | 'DATA_API';

/** JSON persisted in `metadata_json` for server functions (derived docs, api overrides). */
export type ServerFunctionMetadataJson = {
  derived?: {
    codeFingerprint: string;
    generatedAt: string;
    requestExample: {
      query?: Record<string, unknown>;
      params?: Record<string, unknown>;
      body?: Record<string, unknown>;
    };
    docHints: {
      summary?: string;
      routeNote?: string;
      validationFields: string[];
      outputFields: string[];
      queryFields: string[];
      paramFields: string[];
    };
  };
  apiDoc?: {
    summary?: string;
    description?: string;
    tags?: string[];
  };
  /** Operator catalog labels for list filter — not OpenAPI `apiDoc.tags`. */
  catalogTags?: string[];
  testPayloadSource?: 'generated' | 'manual';
  /** Change-reason Confirm for writes of this function. GET/list never ask. */
  changeReason?: import('../record-events').ChangeReasonPolicy;
};

export interface ServerFunctionItem {
  id: string;
  name: string;
  folder: string;
  method: ServerFunctionMethod;
  path: string;
  code: string;
  language?: ServerFunctionLanguage;
  testPayload: string;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string;
  updated_by?: string | null;
  memoryLimit: number;
  timeoutMs: number;
  runtimeVersion: 'v18.x' | 'v20.x';
  useGlobalConfig: boolean;
  enableLogs: boolean;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  cacheByParam?: boolean;
  cacheByUser?: boolean;
  engineType?: ServerFunctionEngineType;
  metadataJson?: ServerFunctionMetadataJson | null;
  isBuiltIn?: boolean;
  packageId?: string;
  packageDisplayName?: string;
  accessControl: {
    accessMode?: import('./accessControl').FunctionAccessMode;
    allowRoles: string[];
    allowUsers: string[];
    denyRoles: string[];
    denyUsers: string[];
  };
  hooks?: import('./hooks').ServerFunctionHooksConfig;
}

export type InjectableSnippet = {
  key: string;
  label: string;
  marker: string;
  body: string;
};

export type EdgeRunnerDataSource = {
  id: string;
  name: string;
  type: string;
  database?: string;
  isDefault?: boolean;
  status?: string;
};

export type EdgeLogEntry = {
  id: string;
  time: string;
  msg: string;
  type: 'info' | 'success' | 'warn';
};

export type DraftFunctionState = {
  name: string;
  folder: string;
  method: ServerFunctionMethod;
  code: string;
  language: ServerFunctionLanguage;
  testPayload: string;
  memoryLimit: number;
  timeoutMs: number;
  runtimeVersion: 'v18.x' | 'v20.x';
  useGlobalConfig: boolean;
  enableLogs: boolean;
  isBuiltIn?: boolean;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  cacheByParam?: boolean;
  cacheByUser?: boolean;
  engineType?: ServerFunctionEngineType;
  metadataJson?: ServerFunctionMetadataJson | null;
  accessControl: {
    accessMode?: import('./accessControl').FunctionAccessMode;
    allowRoles: string[];
    allowUsers: string[];
    denyRoles: string[];
    denyUsers: string[];
  };
  hooks?: import('./hooks').ServerFunctionHooksConfig;
};
