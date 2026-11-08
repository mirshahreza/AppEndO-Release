export type ServerFunctionRuntimeVersion = 'v18.x' | 'v20.x';
export type ServerFunctionLanguage = 'ts' | 'js';

const ALLOWED_MEMORY_MB = [64, 128, 256] as const;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 15000;
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_MEMORY_MB = 128;

export const clampMemoryLimitMb = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_MEMORY_MB;
  }
  const rounded = Math.round(numeric);
  if ((ALLOWED_MEMORY_MB as readonly number[]).includes(rounded)) {
    return rounded;
  }
  return (ALLOWED_MEMORY_MB as readonly number[]).reduce((closest, candidate) => (
    Math.abs(candidate - rounded) < Math.abs(closest - rounded) ? candidate : closest
  ));
};

export const clampTimeoutMs = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(numeric)));
};

export const normalizeRuntimeVersion = (value: unknown): ServerFunctionRuntimeVersion => (
  value === 'v18.x' ? 'v18.x' : 'v20.x'
);

export const normalizeServerFunctionLanguage = (value: unknown): ServerFunctionLanguage => (
  value === 'js' ? 'js' : 'ts'
);

export const readUseGlobalConfig = (value: unknown): boolean => value !== false;

export const esbuildTargetForRuntimeVersion = (runtimeVersion: ServerFunctionRuntimeVersion): 'node18' | 'node20' => (
  runtimeVersion === 'v18.x' ? 'node18' : 'node20'
);
