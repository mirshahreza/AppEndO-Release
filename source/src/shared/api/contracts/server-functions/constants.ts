import type { ServerFunctionLanguage } from './types';

export type { ServerFunctionLanguage };

export const DEFAULT_SERVER_FUNCTION_LANGUAGE: ServerFunctionLanguage = 'ts';

export const BUILTIN_FUNCTION_PERSISTABLE_KEYS = [
  'accessControl',
  'hooks',
  'enableLogs',
  'testPayload',
  'metadataJson',
  'language',
  'runtimeVersion',
  'memoryLimit',
  'timeoutMs',
  'useGlobalConfig',
  'cacheEnabled',
  'cacheTtlMs',
  'cacheByParam',
  'cacheByUser',
] as const;

export type BuiltinFunctionPersistableKey = typeof BUILTIN_FUNCTION_PERSISTABLE_KEYS[number];
