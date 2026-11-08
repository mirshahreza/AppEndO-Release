import { apiPost } from '../../shared/api/client';

/**
 * Runs code through the real Server Function sandbox (`/api/core/server-functions/execute`
 * → `executeServerFunction` → `sandboxWorkerPool.ts`).
 */
export type RunResult = { loading: boolean; error: string | null; data: unknown };

export const INITIAL_RUN_RESULT: RunResult = { loading: false, error: null, data: null };

export type SandboxExecuteOptions = {
  sandboxBody?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | null | undefined>;
};

const buildExecutePath = (query?: SandboxExecuteOptions['query']): string => {
  if (!query) return '/api/core/server-functions/execute';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `/api/core/server-functions/execute?${qs}` : '/api/core/server-functions/execute';
};

export const runServerFunctionCode = async (
  code: string,
  options: SandboxExecuteOptions = {},
): Promise<unknown> => {
  const { sandboxBody, query } = options;
  const path = buildExecutePath(query);
  const { data } = await apiPost<Record<string, unknown>>(path, {
    code,
    language: 'js',
    timeoutMs: 5000,
    ...sandboxBody,
  });
  return data;
};

export const executeSandboxRun = async (
  code: string,
  options: SandboxExecuteOptions = {},
): Promise<RunResult> => {
  try {
    const data = await runServerFunctionCode(code, options);
    return { loading: false, error: null, data };
  } catch (error) {
    return {
      loading: false,
      error: error instanceof Error ? error.message : 'Request failed.',
      data: null,
    };
  }
};
