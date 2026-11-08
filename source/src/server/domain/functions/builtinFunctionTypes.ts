import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import type { ServerFunctionHooksConfig } from '../../../shared/api/contracts/server-functions/hooks';
import type { BuiltinFunctionRuntimeFields } from '../../../core/functions/builtinFunctionRuntimeFields';

export type BuiltinFunctionMetadataOverride = {
  accessControl?: FunctionAccessControl;
  hooks?: ServerFunctionHooksConfig;
  enableLogs?: boolean;
  testPayload?: string;
  metadataJson?: string | null;
  createdAt?: string;
  createdBy?: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
} & Partial<BuiltinFunctionRuntimeFields>;

export interface BuiltinFunctionMetadataFile extends BuiltinFunctionMetadataOverride {
  schema: 'append-builtin-function-metadata';
  schemaVersion: '1.0.0';
  id: string;
  method: string;
  path: string;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export type { UpdateBuiltinFunctionMetadataPayload } from '../../../shared/api/contracts/server-functions/payloads';
export { BUILTIN_FUNCTION_PERSISTABLE_KEYS } from '../../../shared/api/contracts/server-functions/constants';
export type { BuiltinFunctionPersistableKey } from '../../../shared/api/contracts/server-functions/constants';
