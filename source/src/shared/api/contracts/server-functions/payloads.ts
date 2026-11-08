import type { ServerFunctionEngineType, ServerFunctionItem, ServerFunctionMetadataJson } from './types';
import type { FunctionAccessControl } from './accessControl';
import { parseFunctionAccessControl } from './accessControl';
import type { ServerFunctionHooksConfig } from './hooks';

export type CreateServerFunctionPayload = {
  name: string;
  folder: string;
  method: ServerFunctionItem['method'];
  path: string;
  code: string;
  language?: string;
  testPayload: string;
  runtimeVersion: string;
  memoryLimit: number;
  timeoutMs: number;
  useGlobalConfig?: boolean;
  enableLogs?: boolean;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  cacheByParam?: boolean;
  cacheByUser?: boolean;
  engineType?: ServerFunctionEngineType;
  metadataJson?: ServerFunctionMetadataJson | null;
  accessControl?: FunctionAccessControl;
  hooks?: ServerFunctionHooksConfig;
};

export type UpdateServerFunctionPayload = CreateServerFunctionPayload;

export type UpdatePackageServerFunctionPayload = {
  code: string;
};

export type UpdateBuiltinFunctionMetadataPayload = {
  accessControl?: import('./accessControl').FunctionAccessControl;
  hooks?: ServerFunctionHooksConfig;
  enableLogs?: boolean;
  testPayload?: string;
  metadataJson?: import('./types').ServerFunctionMetadataJson | null;
  language?: string;
  runtimeVersion?: string;
  memoryLimit?: number;
  timeoutMs?: number;
  useGlobalConfig?: boolean;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  cacheByParam?: boolean;
  cacheByUser?: boolean;
};

export type ExecuteServerFunctionInput = {
  activeFn: ServerFunctionItem;
  parsedPayload: Record<string, unknown>;
  vmMode: 'v18.x' | 'v20.x';
  runRam: number;
  runTimeout: number;
  requestMethod?: ServerFunctionItem['method'];
};

export type ServerFunctionsCatalog = {
  functions: ServerFunctionItem[];
  systemError: string | null;
  customError: string | null;
};
