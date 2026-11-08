import { DEFAULT_SERVER_FUNCTION_LANGUAGE, type ServerFunctionLanguage } from './constants';
import type { ServerFunctionLanguage as ServerFunctionLanguageType } from './types';

export const getActiveSourceLanguage = (value?: ServerFunctionLanguageType | null): ServerFunctionLanguage => {
  return value === 'js' ? 'js' : DEFAULT_SERVER_FUNCTION_LANGUAGE;
};

export const normalizeFunctionForEditor = <T extends object>(item: T): T & { language: ServerFunctionLanguage } => {
  return {
    ...item,
    language: DEFAULT_SERVER_FUNCTION_LANGUAGE,
  };
};

/** Canonical EdgeReq / EdgeRes / EdgeDb types for generated sandbox route scripts. */
export const SERVER_FUNCTION_SANDBOX_TYPE_DEFINITIONS = `
type EdgeReq = {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  params: Record<string, string>;
  method: string;
  headers: Record<string, string | undefined>;
};

type EdgeRes = {
  json: (data: unknown) => unknown;
  send: (data: unknown) => unknown;
  status: (code: number) => EdgeRes;
};

type EdgeDb = {
  query: (
    operation: string | Record<string, unknown>,
    params?: unknown[],
    context?: { dataSourceId?: string; dataSourceName?: string; database?: string },
  ) => Promise<unknown>;
};
`.trim();

export const buildServerFunctionTemplate = (method: string, path: string, logLabel?: string) => {
  const resolvedLogLabel = logLabel || path;
  return `// AppEnd OS - ${method} ${path}
// Global Objects Available: req, res, db, console

${SERVER_FUNCTION_SANDBOX_TYPE_DEFINITIONS}

type EdgeDbContext = { dataSourceId?: string; dataSourceName?: string; database?: string };

const withDataSource = (ctx: EdgeDbContext) => ({
  query: (operation: string | Record<string, unknown>, params?: unknown[]) => edgeDb.query(operation, params, ctx),
});

const edgeReq = req as EdgeReq;
const edgeRes = res as EdgeRes;
const edgeDb = db as EdgeDb;

async function handler(): Promise<void> {
  console.log('Edge route invoked: ${resolvedLogLabel}');

  edgeRes.json({
    status: 'success',
    message: 'AppEnd Edge Route executed successfully!',
    path: '${path}',
    method: edgeReq.method,
    timestamp: new Date().toISOString(),
  });
}

(async () => {
  await handler();
})();`;
};
