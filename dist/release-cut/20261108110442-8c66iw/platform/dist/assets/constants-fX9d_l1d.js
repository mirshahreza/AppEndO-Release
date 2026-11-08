const e="append.server-functions.state.v4",r=[{key:"req-types",label:"Inject req typings",marker:"@inject:req-types",body:`// @inject:req-types
type EdgeReq = {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  params: Record<string, string>;
  method: string;
  headers: Record<string, string | undefined>;
};

const edgeReq = req as EdgeReq;
`},{key:"res-types",label:"Inject res typings",marker:"@inject:res-types",body:`// @inject:res-types
type EdgeRes = {
  json: (data: unknown) => unknown;
  send: (data: unknown) => unknown;
  status: (code: number) => { json: (data: unknown) => unknown; send: (data: unknown) => unknown };
};

const edgeRes = res as EdgeRes;
`},{key:"db-types",label:"Inject db typings",marker:"@inject:db-types",body:`// @inject:db-types
type EdgeDB = {
  query: (
    operation: string | Record<string, unknown>,
    params?: unknown[],
    context?: { dataSourceId?: string; dataSourceName?: string; database?: string },
  ) => Promise<unknown>;
};

const edgeDb = db as EdgeDB;
`},{key:"db-source-helper",label:"Inject data source helper",marker:"@inject:db-source-helper",body:`// @inject:db-source-helper
type EdgeDbContext = { dataSourceId?: string; dataSourceName?: string; database?: string };
const withDataSource = (ctx: EdgeDbContext) => ({
  query: (operation: string | Record<string, unknown>, params?: unknown[]) => edgeDb.query(operation, params, ctx),
});

// Example:
// const reportingDb = withDataSource({ dataSourceName: 'Reporting-Postgres' });
// const rows = await reportingDb.query('SELECT id, total FROM invoices LIMIT 10');
`},{key:"response-helpers",label:"Inject ok/error helpers",marker:"@inject:response-helpers",body:`// @inject:response-helpers
const ok = (data: unknown, status = 200) => res.status(status).json({ success: true, data });
const fail = (message: string, status = 400) => res.status(status).json({ success: false, error: message });
`},{key:"params-query",label:"Inject params/query helpers",marker:"@inject:params-query",body:`// @inject:params-query
const readParam = (name: string, fallback = '') => String(req.params?.[name] ?? fallback);
const readQuery = <T = string>(name: string, fallback: T) => {
  const raw = req.query?.[name];
  return (raw === undefined || raw === null ? fallback : (raw as T));
};
`},{key:"payload-guard",label:"Inject payload guard",marker:"@inject:payload-guard",body:`// @inject:payload-guard
const payload = (req.body || {}) as Record<string, unknown>;
if (!payload || typeof payload !== 'object') {
  return res.status(400).json({ success: false, error: 'Invalid payload' });
}
`}],t={GET:{badge:"bg-sky-100/60 text-sky-700 border-sky-200",inner:"bg-sky-50/45 border-sky-100 text-sky-900",innerActive:"bg-sky-100/45 border-sky-200 text-sky-950"},POST:{badge:"bg-emerald-100/60 text-emerald-700 border-emerald-200",inner:"bg-emerald-50/45 border-emerald-100 text-emerald-900",innerActive:"bg-emerald-100/45 border-emerald-200 text-emerald-950"},PUT:{badge:"bg-amber-100/60 text-amber-700 border-amber-200",inner:"bg-amber-50/45 border-amber-100 text-amber-900",innerActive:"bg-amber-100/45 border-amber-200 text-amber-950"},DELETE:{badge:"bg-rose-100/60 text-rose-700 border-rose-200",inner:"bg-rose-50/45 border-rose-100 text-rose-900",innerActive:"bg-rose-100/45 border-rose-200 text-rose-950"},PATCH:{badge:"bg-violet-100/60 text-violet-700 border-violet-200",inner:"bg-violet-50/45 border-violet-100 text-violet-900",innerActive:"bg-violet-100/45 border-violet-200 text-violet-950"}};export{e as E,r as I,t as M};
