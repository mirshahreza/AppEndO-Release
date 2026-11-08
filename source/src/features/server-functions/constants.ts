export {
  DEFAULT_SERVER_FUNCTION_LANGUAGE,
  type ServerFunctionLanguage,
} from '../../shared/api/contracts/server-functions/constants';
import type { ServerFunctionItem, InjectableSnippet } from './types';

export const EDGE_STATE_STORAGE_KEY = 'append.server-functions.state.v4';

export const INJECTABLE_SNIPPETS: InjectableSnippet[] = [
  {
    key: 'req-types',
    label: 'Inject req typings',
    marker: '@inject:req-types',
    body: `// @inject:req-types\ntype EdgeReq = {\n  body: Record<string, unknown>;\n  query: Record<string, unknown>;\n  params: Record<string, string>;\n  method: string;\n  headers: Record<string, string | undefined>;\n};\n\nconst edgeReq = req as EdgeReq;\n`,
  },
  {
    key: 'res-types',
    label: 'Inject res typings',
    marker: '@inject:res-types',
    body: `// @inject:res-types\ntype EdgeRes = {\n  json: (data: unknown) => unknown;\n  send: (data: unknown) => unknown;\n  status: (code: number) => { json: (data: unknown) => unknown; send: (data: unknown) => unknown };\n};\n\nconst edgeRes = res as EdgeRes;\n`,
  },
  {
    key: 'db-types',
    label: 'Inject db typings',
    marker: '@inject:db-types',
    body: `// @inject:db-types\ntype EdgeDB = {\n  query: (\n    operation: string | Record<string, unknown>,\n    params?: unknown[],\n    context?: { dataSourceId?: string; dataSourceName?: string; database?: string },\n  ) => Promise<unknown>;\n};\n\nconst edgeDb = db as EdgeDB;\n`,
  },
  {
    key: 'db-source-helper',
    label: 'Inject data source helper',
    marker: '@inject:db-source-helper',
    body: `// @inject:db-source-helper\ntype EdgeDbContext = { dataSourceId?: string; dataSourceName?: string; database?: string };\nconst withDataSource = (ctx: EdgeDbContext) => ({\n  query: (operation: string | Record<string, unknown>, params?: unknown[]) => edgeDb.query(operation, params, ctx),\n});\n\n// Example:\n// const reportingDb = withDataSource({ dataSourceName: 'Reporting-Postgres' });\n// const rows = await reportingDb.query('SELECT id, total FROM invoices LIMIT 10');\n`,
  },
  {
    key: 'response-helpers',
    label: 'Inject ok/error helpers',
    marker: '@inject:response-helpers',
    body: `// @inject:response-helpers\nconst ok = (data: unknown, status = 200) => res.status(status).json({ success: true, data });\nconst fail = (message: string, status = 400) => res.status(status).json({ success: false, error: message });\n`,
  },
  {
    key: 'params-query',
    label: 'Inject params/query helpers',
    marker: '@inject:params-query',
    body: `// @inject:params-query\nconst readParam = (name: string, fallback = '') => String(req.params?.[name] ?? fallback);\nconst readQuery = <T = string>(name: string, fallback: T) => {\n  const raw = req.query?.[name];\n  return (raw === undefined || raw === null ? fallback : (raw as T));\n};\n`,
  },
  {
    key: 'payload-guard',
    label: 'Inject payload guard',
    marker: '@inject:payload-guard',
    body: `// @inject:payload-guard\nconst payload = (req.body || {}) as Record<string, unknown>;\nif (!payload || typeof payload !== 'object') {\n  return res.status(400).json({ success: false, error: 'Invalid payload' });\n}\n`,
  },
];

export const METHOD_THEME: Record<ServerFunctionItem['method'], {
  badge: string;
  inner: string;
  innerActive: string;
}> = {
  GET: {
    badge: 'bg-sky-100/60 text-sky-700 border-sky-200',
    inner: 'bg-sky-50/45 border-sky-100 text-sky-900',
    innerActive: 'bg-sky-100/45 border-sky-200 text-sky-950',
  },
  POST: {
    badge: 'bg-emerald-100/60 text-emerald-700 border-emerald-200',
    inner: 'bg-emerald-50/45 border-emerald-100 text-emerald-900',
    innerActive: 'bg-emerald-100/45 border-emerald-200 text-emerald-950',
  },
  PUT: {
    badge: 'bg-amber-100/60 text-amber-700 border-amber-200',
    inner: 'bg-amber-50/45 border-amber-100 text-amber-900',
    innerActive: 'bg-amber-100/45 border-amber-200 text-amber-950',
  },
  DELETE: {
    badge: 'bg-rose-100/60 text-rose-700 border-rose-200',
    inner: 'bg-rose-50/45 border-rose-100 text-rose-900',
    innerActive: 'bg-rose-100/45 border-rose-200 text-rose-950',
  },
  PATCH: {
    badge: 'bg-violet-100/60 text-violet-700 border-violet-200',
    inner: 'bg-violet-50/45 border-violet-100 text-violet-900',
    innerActive: 'bg-violet-100/45 border-violet-200 text-violet-950',
  },
};
