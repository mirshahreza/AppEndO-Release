import crypto from 'crypto';
import { transform } from 'esbuild';
import {
  esbuildTargetForRuntimeVersion,
  type ServerFunctionLanguage,
  type ServerFunctionRuntimeVersion,
} from '../../shared/server-functions/runtimeConfig';
import { normalizeSandboxSource } from '../../shared/server-functions/sandboxSourceNormalize';

const MAX_COMPILE_CACHE_ENTRIES = 200;
const compileCache = new Map<string, string>();

const buildCompileCacheKey = (
  source: string,
  language: ServerFunctionLanguage,
  runtimeVersion: ServerFunctionRuntimeVersion,
): string => {
  const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
  return `${language}:${runtimeVersion}:${sourceHash}`;
};

export const invalidateSandboxCompileCache = (
  source?: string,
  language: ServerFunctionLanguage = 'ts',
  runtimeVersion: ServerFunctionRuntimeVersion = 'v20.x',
): void => {
  if (!source?.trim()) {
    compileCache.clear();
    return;
  }
  compileCache.delete(buildCompileCacheKey(source, language, runtimeVersion));
};

export const compileSandboxSource = async (
  source: string,
  language: ServerFunctionLanguage,
  runtimeVersion: ServerFunctionRuntimeVersion,
): Promise<string> => {
  if (language === 'js') {
    return normalizeSandboxSource(source);
  }
  const cacheKey = buildCompileCacheKey(source, language, runtimeVersion);
  const cached = compileCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const result = await transform(normalizeSandboxSource(source), {
    loader: 'ts',
    format: 'cjs',
    target: esbuildTargetForRuntimeVersion(runtimeVersion),
    sourcemap: false,
    legalComments: 'none',
  });
  if (compileCache.size >= MAX_COMPILE_CACHE_ENTRIES) {
    const oldestKey = compileCache.keys().next().value;
    if (oldestKey) {
      compileCache.delete(oldestKey);
    }
  }
  compileCache.set(cacheKey, result.code);
  return result.code;
};
