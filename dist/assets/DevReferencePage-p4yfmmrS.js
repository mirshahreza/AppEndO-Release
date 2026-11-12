import{j as e,h as c}from"./react-vendor-CsZD9bLw.js";import{k3 as C,c2 as Ne,hp as Ee,cP as i,rb as qe,iT as Ce,iU as Pe,jb as Te}from"./index-CLwvyUey.js";import"./AiFieldAssistSectionContext-_dRCe7cR.js";import{bF as ke,bT as x,bR as g,dd as P,dj as q,dh as we}from"./HeroFieldControls-BgLH7RhM.js";import{c as Re}from"./FormChoiceFields-CtYCecGf.js";import{I as _e}from"./constants-fX9d_l1d.js";import"./tanstack-query-BjZ08O4H.js";import"./useHwyPublicCultureId-Dira7_W1.js";import"./terminal-BD6eNVMh.js";import"./motion-CZjBJ88L.js";import"./lucide-react-BdKKphsJ.js";import"./lock-CpYn2frx.js";import"./flask-conical-B0WJWWu6.js";import"./id-card-DIPkuypf.js";import"./loader-circle-C_RQmP7X.js";import"./mail-BGpZtU7g.js";import"./index-Ds_chnaO.js";import"./HwyPublicPortalLayout-CO6017aD.js";import"./useHwyPublicPortalDocumentTitle-Bc8OG00z.js";import"./hwySelfRegistrationNumericInput-DEuxNN2L.js";import"./UsersIcon-DCeYIj7S.js";import"./tanstack-virtual-BF62Is0T.js";const M=({className:s,children:a})=>e.jsx("div",{className:C("flex min-h-0 min-w-0 flex-col lg:h-full",s),children:e.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-auto bg-white",children:a})}),Oe=s=>{const a=s.match(/^(\s*)("(?:\\.|[^"\\])*")(\s*:\s*)(.*)$/);if(!a)return s;const[,r,l,t,n]=a,o=n.trim();let d="text-slate-700";return o==="true"||o==="false"?d="text-amber-700":o.startsWith('"')?d="text-emerald-700":/^-?\d/.test(o)&&(d="text-cyan-700"),e.jsxs(e.Fragment,{children:[r,e.jsx("span",{className:"text-indigo-700",children:l}),t,e.jsx("span",{className:d,children:n})]})},u=({json:s,tone:a="slate",className:r})=>e.jsx("pre",{className:C("overflow-auto rounded-lg border bg-slate-950/[0.03] p-3 font-mono text-[11px] leading-relaxed",Ne[a].shell,r),children:s.split(`
`).map((l,t)=>e.jsx("div",{children:Oe(l)},t))}),B="p-3 sm:p-4",p="flex min-h-0 flex-1 flex-col gap-3",H=`grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] ${B}`,W="flex min-h-0 min-w-0 flex-col overflow-auto",h="flex flex-col gap-4",j=ke,b="min-w-0",T="w-full",J="text-[11px] font-bold uppercase tracking-wider text-slate-500 ps-[4px]",Ae=[{id:"reference",label:"Reference"},{id:"util",label:"util.*"},{id:"request",label:"Request (req)"},{id:"response",label:"Response (res)"},{id:"data",label:"Database (db)"},{id:"auth",label:"Auth & session"},{id:"patterns",label:"Coding patterns"},{id:"playground",label:"Playground"},{id:"guides",label:"Guides"}],A=[{id:"overview",label:"Globals overview",group:"reference",description:"Complete map of every global in the Server Function sandbox, including require() for Libraries."},{id:"typescript-types",label:"TypeScript types",group:"reference",description:"Canonical EdgeReq, EdgeRes, and EdgeDb typings used in generated route templates."},{id:"security-limits",label:"Security & limits",group:"reference",description:"Sandbox isolation rules, timeout/memory caps, and what is intentionally blocked."},{id:"regex-match",label:"util.regexMatch",group:"util",description:"RE2-backed, ReDoS-safe regex (max 500-char pattern, 100k-char subject)."},{id:"regex-errors",label:"Regex error codes",group:"util",description:"Safe error shapes returned instead of throwing on invalid or oversized patterns."},{id:"validate-schema",label:"util.validateSchema",group:"util",description:"ajv + ajv-formats JSON Schema validation for bodies and arbitrary values."},{id:"schema-formats",label:"Schema formats",group:"util",description:"Built-in ajv-formats: email, date-time, uuid, uri, and more."},{id:"req-body",label:"req.body",group:"request",description:"Read the JSON POST body available to your handler."},{id:"req-query",label:"req.query",group:"request",description:"Read URL query string parameters passed to the route."},{id:"req-auth",label:"req.auth",group:"auth",description:"Authenticated caller identity: userId, email, roles."},{id:"role-guard",label:"Role guard",group:"auth",description:"Return 403 when the caller lacks a required role."},{id:"session-ctx",label:"ctx (session)",group:"auth",description:"Server/client session attribute slices via ctx.get and scoped accessors."},{id:"res-patterns",label:"res patterns",group:"response",description:"res.json, res.status().json, res.send, and res.headersSent."},{id:"response-contract",label:"Response contract",group:"response",description:"Platform convention: { success: true, data } and { success: false, error }."},{id:"db-query",label:"db.query",group:"data",description:"Async database proxy — mock rows in this tester, real data source in production."},{id:"db-data-source",label:"Data source context",group:"data",description:"Route queries to a specific dataSourceId or database via db.query context."},{id:"async-handler",label:"async handler()",group:"patterns",description:"Recommended handler structure with await for db.query and other async work."},{id:"console-logging",label:"console.log",group:"patterns",description:"console.log and console.error — output appears in server logs, not the HTTP response."},{id:"injectable-snippets",label:"Injectable snippets",group:"patterns",description:"Editor snippets (@inject:*) for typings, helpers, and guards — paste into your function."},{id:"handler-playground",label:"Handler playground",group:"playground",description:"Edit and run arbitrary handler code against the real sandbox."},{id:"handler-crud",label:"CRUD handler example",group:"playground",description:"End-to-end validate → query → respond pattern you can copy into new functions."},{id:"workflow-regex",label:"Workflow regex-match",group:"guides",description:"text.regex-match corePack Action configuration."},{id:"workflow-ai-schema",label:"Workflow AI schema",group:"guides",description:"How ai.llm-structured validates model output against outputSchema."},{id:"package-api",label:"Package API handler",group:"guides",description:"module.exports handler pattern for installed package API routes."}],Ie="overview",Le=[{name:"req",type:"object",summary:"body, query, params, method, headers, auth"},{name:"res",type:"object",summary:"json(), status(), send(), headersSent()"},{name:"db",type:"object",summary:"query(operation, params?, context?) — async"},{name:"ctx",type:"object",summary:"get(key), server.get(key), client.get(key)"},{name:"require",type:"function",summary:"Node require() from developer Libraries plus platform packages"},{name:"util",type:"object",summary:"regexMatch(), validateSchema()"},{name:"console",type:"object",summary:"log(), error() — server logs only"}],Fe=["import","process","module","global","globalThis","Buffer","__dirname"],De=[{label:"Timeout",value:"100 – 15 000 ms (default 3 000)"},{label:"Memory",value:"64 / 128 / 256 MB per worker"},{label:"Regex pattern",value:"max 500 characters"},{label:"Regex subject",value:"max 100 000 characters"},{label:"npm packages",value:"Libraries page — require() after install; core packages are provided"},{label:"Sensitive headers",value:"cookie & authorization stripped from req.headers"}],Me=`// Server Function sandbox globals:
req        // body, query, params, method, headers, auth: { userId?, email?, roles[] }
res        // res.json(data) | res.status(code) | res.send(data) | res.headersSent()
db.query(operation, params?, context?)   // async — proxied to host data source
ctx.get(key) / ctx.server.get(key) / ctx.client.get(key)
require(name)                             // developer Libraries + Node builtins / platform packages
console.log(...) / console.error(...)     // server logs, not HTTP response
util.regexMatch(pattern, text, options?)
util.validateSchema(schema, value)

// Core libraries (react, react-dom, react-router-dom, @heroui/react, @heroui/styles)
// are provided by the platform — do not install them from Libraries.`,ze=Ee,$=`const result = util.regexMatch('(\\\\w+)@(\\\\w+)', 'contact: ada@example', { flags: 'i' });
// { ok: true, matched: true, matches: [{ match, index, groups, namedGroups }] }
res.json(result);`,Je=`// Errors never throw — always check result.ok:
const bad = util.regexMatch('[', 'abc');
// { ok: false, errorCode: 'INVALID_PATTERN', message: '...' }

const long = util.regexMatch('a'.repeat(501), 'x');
// { ok: false, errorCode: 'PATTERN_TOO_LONG', message: '...' }`,z=`const schema = {
  type: 'object',
  required: ['email'],
  properties: { email: { type: 'string', format: 'email' } },
};
const check = util.validateSchema(schema, req.body.payload);
if (!check.valid) return res.status(400).json({ success: false, errors: check.errors });
res.json({ success: true });`,Ve=`// ajv-formats supported in util.validateSchema:
const schema = {
  type: 'object',
  required: ['email', 'createdAt', 'id'],
  properties: {
    email: { type: 'string', format: 'email' },
    createdAt: { type: 'string', format: 'date-time' },
    id: { type: 'string', format: 'uuid' },
    website: { type: 'string', format: 'uri' },
  },
};`,Ue=`{
  "email": "not-an-email",
  "createdAt": "yesterday",
  "id": "not-a-uuid",
  "website": "ftp://bad"
}`,Ge=`async function handler() {
  const payload = req.body.payload || req.body;
  res.json({ method: req.method, bodyKeys: Object.keys(req.body || {}), payload });
}`,V=`async function handler() {
  const page = Number(req.query.page || 1);
  const sort = String(req.query.sort || 'name');
  res.json({ page, sort, allQuery: req.query });
}`,Be=`const userId = req.auth?.userId;
const roles = req.auth?.roles || [];
if (!userId) return res.status(401).json({ success: false, error: 'Authentication required.' });
res.json({ userId, email: req.auth?.email, roles });`,He=`const roles = req.auth?.roles || [];
const required = 'ADMIN';
if (!roles.includes(required)) {
  return res.status(403).json({ success: false, error: 'Forbidden: requires ' + required });
}
res.json({ success: true, message: 'Access granted.' });`,We=`const tenantId = ctx.get('tenantId');       // server first, then client
const theme = ctx.client.get('theme');      // client slice only
const flags = ctx.server.get('featureFlags'); // server slice only
res.json({ tenantId, theme, flags });`,$e=`// JSON response (most common):
res.json({ success: true, data: { id: 1 } });

// Status + JSON:
res.status(201).json({ success: true, data: { id: 1 } });

// Plain text / non-JSON:
res.status(200).send('OK');

// Guard against double response:
if (!res.headersSent()) res.json({ success: true });`,Ke=`// Success (2xx):
res.status(200).json({ success: true, data: rows, count: rows.length });

// Client error (4xx):
res.status(400).json({ success: false, error: 'Invalid input', errors: check.errors });

// Auth error:
res.status(401).json({ success: false, error: 'Authentication required.' });

// Forbidden:
res.status(403).json({ success: false, error: 'Forbidden.' });`,Qe=`const result = await db.query(
  'SELECT id, name FROM users WHERE active = @p0',
  [true],
);
res.json({ success: true, data: result.data, count: result.count, source: result.source });`,Ye=`// Route a query to a specific data source:
const result = await db.query(
  'SELECT COUNT(*) AS total FROM orders',
  [],
  { dataSourceId: 'reporting-db', database: 'analytics' },
);

// Or use the withDataSource helper from injectable snippets:
const reportingDb = withDataSource({ dataSourceName: 'Reporting-Postgres' });
const rows = await reportingDb.query('SELECT id, total FROM invoices LIMIT 10');`,Xe=`async function handler(): Promise<void> {
  const check = util.validateSchema(schema, req.body.payload);
  if (!check.valid) {
    res.status(400).json({ success: false, errors: check.errors });
    return;
  }
  const result = await db.query('SELECT * FROM items WHERE id = @p0', [req.body.id]);
  res.json({ success: true, data: result.data });
}`,U=`async function handler() {
  console.log('[my-fn] invoked', { method: req.method, userId: req.auth?.userId });
  try {
    const result = await db.query('SELECT 1', []);
    console.log('[my-fn] query ok', result.count);
    res.json({ success: true });
  } catch (error) {
    console.error('[my-fn] failed', error);
    res.status(500).json({ success: false, error: 'Internal error.' });
  }
}`,Ze=`async function handler(): Promise<void> {
  const payload = req.body.payload || {};
  const check = util.validateSchema(
    { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 1 } } },
    payload,
  );
  if (!check.valid) {
    res.status(400).json({ success: false, errors: check.errors });
    return;
  }
  res.json({ success: true, greeting: 'Hello, ' + payload.name + '!' });
}`,K=`async function handler(): Promise<void> {
  const method = req.body._method || req.method;
  const id = String(req.params?.id || req.body?.id || '');
  const payload = req.body?.payload || {};

  const inputSchema = {
    type: 'object',
    properties: { name: { type: 'string', minLength: 1 }, active: { type: 'boolean' } },
    required: ['name'],
  };

  if (method === 'GET') {
    const result = await db.query('SELECT * FROM items WHERE (@p0 = \\'\\' OR id = @p0)', [id]);
    return res.json({ success: true, data: result.data, count: result.count });
  }

  const check = util.validateSchema(inputSchema, payload);
  if (!check.valid) return res.status(400).json({ success: false, errors: check.errors });

  if (method === 'POST') {
    const result = await db.query('INSERT INTO items (name, active) VALUES (@p0, @p1)', [payload.name, payload.active ?? true]);
    return res.status(201).json({ success: true, data: result.data });
  }

  res.status(405).json({ success: false, error: 'Method not allowed: ' + method });
}`,es=`{
  "kind": "ACTION",
  "actionRef": { "key": "text.regex-match", "version": "1" },
  "config": { "pattern": "(\\\\w+)@(\\\\w+)", "flags": "i" },
  "input": { "text": { "type": "PATH", "path": "$.trigger.emailBody" } }
}`,ss=`// ai.llm-structured Action — model output validated against outputSchema (ajv):
{
  "kind": "ACTION",
  "actionRef": { "key": "ai.llm-structured", "version": "1" },
  "config": {
    "outputSchema": {
      "type": "object",
      "required": ["summary"],
      "properties": { "summary": { "type": "string" }, "score": { "type": "number" } }
    }
  }
}

// Same validator in Server Functions:
const check = util.validateSchema(outputSchema, modelResponse);`,as=`module.exports = async function handler(req, res) {
  const check = util.validateSchema(
    { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    req.body,
  );
  if (!check.valid) return res.status(400).json({ success: false, errors: check.errors });

  const match = util.regexMatch('^v\\\\d+', String(req.query.version || ''), { flags: 'i' });
  res.json({ success: true, versionMatched: match.matched });
};`,ts=_e.map(s=>({key:s.key,label:s.label,marker:s.marker,body:s.body})),f=({label:s,runResult:a,tone:r="slate",emptyHint:l="Run the tester to see a real result."})=>e.jsxs("div",{children:[e.jsx("p",{className:"mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500",children:s}),a.error?e.jsx("p",{className:"text-xs text-rose-600",children:a.error}):e.jsx(u,{json:JSON.stringify(a.data??{info:l},null,2),tone:r})]}),v=({form:s,preview:a})=>e.jsxs("div",{className:C(H,"min-h-0 flex-1"),children:[e.jsx("div",{className:W,children:s}),e.jsx(M,{children:a})]}),_=({title:s,description:a,snippets:r,children:l})=>e.jsx("div",{className:C(B,"flex min-h-0 min-w-0 flex-1 flex-col"),children:e.jsx(M,{children:e.jsxs("div",{className:"flex min-h-0 flex-1 flex-col gap-3",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-semibold text-slate-900",children:s}),e.jsx("p",{className:"mt-1 text-xs text-slate-600",children:a})]}),l,r.map(t=>e.jsxs("div",{children:[e.jsx("p",{className:"mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500",children:t.label}),e.jsx(u,{json:t.code,tone:t.tone??"slate"})]},t.label))]})})}),rs=()=>e.jsx("div",{className:"overflow-hidden rounded-lg border border-slate-200",children:e.jsxs("table",{className:"w-full text-left text-[11px]",children:[e.jsx("thead",{className:"bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-2 py-1.5",children:"Global"}),e.jsx("th",{className:"px-2 py-1.5",children:"Type"}),e.jsx("th",{className:"px-2 py-1.5",children:"Summary"})]})}),e.jsx("tbody",{children:Le.map(s=>e.jsxs("tr",{className:"border-t border-slate-100",children:[e.jsx("td",{className:"px-2 py-1.5 font-mono text-emerald-800",children:s.name}),e.jsx("td",{className:"px-2 py-1.5 text-slate-500",children:s.type}),e.jsx("td",{className:"px-2 py-1.5 text-slate-700",children:s.summary})]},s.name))})]})}),ls=()=>e.jsx("div",{className:"overflow-hidden rounded-lg border border-slate-200",children:e.jsx("table",{className:"w-full text-left text-[11px]",children:e.jsx("tbody",{children:De.map(s=>e.jsxs("tr",{className:"border-t border-slate-100 first:border-t-0",children:[e.jsx("td",{className:"px-2 py-1.5 font-medium text-slate-700",children:s.label}),e.jsx("td",{className:"px-2 py-1.5 text-slate-600",children:s.value})]},s.label))})})}),ns=()=>e.jsx(_,{title:"TypeScript types",description:"Paste these types at the top of your Server Function. The editor also offers @inject:req-types, @inject:res-types, and @inject:db-types snippets.",snippets:[{label:"EdgeReq / EdgeRes / EdgeDb",code:ze,tone:"cyan"}]}),os=({run:s,runResult:a})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Security probe",tone:"rose",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"Confirms blocked globals and lists platform-enforced limits."}),e.jsx(i,{intent:"primary",size:"sm",onClick:()=>s(`res.json({
  blocked: {
    require: typeof require,
    process: typeof process,
    module: typeof module,
    global: typeof global,
  },
  limits: {
    regexMaxPattern: 500,
    regexMaxSubject: 100000,
    timeoutMs: '100-15000 (default 3000)',
    memoryMb: '64 | 128 | 256',
  },
});`),disabled:a.loading,children:a.loading?"Probing…":"Run security probe"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Probe result",runResult:a,tone:"rose"}),e.jsxs("div",{children:[e.jsx("p",{className:"mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500",children:"Blocked globals"}),e.jsx("p",{className:"mb-2 text-xs text-slate-600",children:Fe.join(", ")}),e.jsx(ls,{})]})]})}),is=({run:s,runResult:a})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Error scenarios",tone:"amber",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"util.regexMatch returns structured errors — never throws."}),e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.json(util.regexMatch('[', 'abc'));"),children:"Invalid pattern"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s(`res.json(util.regexMatch(${JSON.stringify("a".repeat(501))}, 'x'));`),children:"Pattern too long"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s(`res.json(util.regexMatch('test', ${JSON.stringify("x".repeat(100001))}));`),children:"Subject too long"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.json(util.regexMatch('(a+)+b', 'a'.repeat(64) + 'c'));"),children:"ReDoS-safe (no hang)"})]})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Result",runResult:a,tone:"amber"}),e.jsx(u,{json:Je,tone:"slate"})]})}),cs=({valueText:s,setValueText:a,run:r,reportError:l,runResult:t})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"ajv-formats",tone:"cyan",children:e.jsxs("div",{className:j,children:[e.jsx(g,{label:"Value (JSON)",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[5rem] w-full font-mono text-[11px]",value:s,onChange:n=>a(n.target.value)})}),e.jsx(i,{intent:"primary",size:"sm",disabled:t.loading,onClick:()=>{let n;try{n=JSON.parse(s)}catch{l("Value is not valid JSON.");return}r(`res.json(util.validateSchema(${JSON.stringify({type:"object",required:["email","createdAt","id"],properties:{email:{type:"string",format:"email"},createdAt:{type:"string",format:"date-time"},id:{type:"string",format:"uuid"},website:{type:"string",format:"uri"}}})}, ${JSON.stringify(n)}));`)},children:t.loading?"Validating…":"Validate formats"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Validation result",runResult:t,tone:"cyan"}),e.jsx(u,{json:Ve,tone:"slate"})]})}),ds=({payloadText:s,setPayloadText:a,run:r,reportError:l,runResult:t})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"req.body",tone:"indigo",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"Extra POST fields become req.body keys (use payload for simulated client data)."}),e.jsx(g,{label:"payload (JSON)",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[4rem] w-full font-mono text-[11px]",value:s,onChange:n=>a(n.target.value)})}),e.jsx(i,{intent:"primary",size:"sm",disabled:t.loading,onClick:()=>{let n;try{n=JSON.parse(s)}catch{l("payload is not valid JSON.");return}r(`async function handler() {
  const payload = req.body.payload || req.body;
  res.json({ method: req.method, bodyKeys: Object.keys(req.body || {}), payload });
}`,{sandboxBody:{payload:n}})},children:t.loading?"Reading…":"Read req.body"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"req.body echo",runResult:t,tone:"indigo"}),e.jsx(u,{json:Ge,tone:"slate"})]})}),ms=({page:s,setPage:a,sort:r,setSort:l,run:t,runResult:n})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"req.query",tone:"indigo",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"Query params are sent on the execute URL and appear in req.query."}),e.jsx(g,{label:"page",className:b,children:e.jsx(P,{size:"sm",className:T,value:s,onChange:o=>a(o.target.value)})}),e.jsx(g,{label:"sort",className:b,children:e.jsx(P,{size:"sm",className:T,value:r,onChange:o=>l(o.target.value)})}),e.jsx(i,{intent:"primary",size:"sm",disabled:n.loading,onClick:()=>t(V,{query:{page:s,sort:r}}),children:n.loading?"Reading…":"Read req.query"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"req.query echo",runResult:n,tone:"indigo"}),e.jsx(u,{json:V,tone:"slate"})]})}),us=({requiredRole:s,setRequiredRole:a,run:r,runResult:l})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Role guard",tone:"violet",children:e.jsxs("div",{className:j,children:[e.jsx(g,{label:"Required role",className:b,children:e.jsx(P,{size:"sm",className:T,value:s,onChange:t=>a(t.target.value)})}),e.jsx(i,{intent:"primary",size:"sm",disabled:l.loading,onClick:()=>r(`const roles = req.auth?.roles || [];
const required = ${JSON.stringify(s)};
if (!roles.includes(required)) {
  return res.status(403).json({ success: false, error: 'Forbidden: requires ' + required, roles });
}
res.json({ success: true, message: 'Access granted.', roles });`),children:l.loading?"Checking…":"Run role guard"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Guard result",runResult:l,tone:"violet"}),e.jsx(u,{json:He,tone:"slate"})]})}),xs=({run:s,runResult:a})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Response patterns",tone:"emerald",children:e.jsx("div",{className:j,children:e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.json({ success: true, data: { id: 1 } });"),children:"res.json"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.status(201).json({ success: true, data: { id: 2 } });"),children:"status + json"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.status(200).send('OK');"),children:"res.send"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.json({ sent: res.headersSent() }); res.json({ second: 'blocked' });"),children:"headersSent"})]})})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Response",runResult:a,tone:"emerald"}),e.jsx(u,{json:$e,tone:"slate"})]})}),ps=({run:s,runResult:a})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Response contract",tone:"emerald",children:e.jsx("div",{className:j,children:e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.json({ success: true, data: [{ id: 1 }], count: 1 });"),children:"Success 200"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.status(400).json({ success: false, error: 'Invalid input', errors: ['/email must match format email'] });"),children:"Error 400"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.status(401).json({ success: false, error: 'Authentication required.' });"),children:"Error 401"}),e.jsx(i,{intent:"secondary",size:"sm",disabled:a.loading,onClick:()=>s("res.status(403).json({ success: false, error: 'Forbidden.' });"),children:"Error 403"})]})})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Response body",runResult:a,tone:"emerald"}),e.jsx(u,{json:Ke,tone:"slate"})]})}),hs=({run:s,runResult:a})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Data source context",tone:"rose",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"Pass dataSourceId/database as the third argument to db.query."}),e.jsx(i,{intent:"primary",size:"sm",disabled:a.loading,onClick:()=>s(`async function handler() {
  const result = await db.query('SELECT 1 AS n', [], { dataSourceId: 'reporting-db', database: 'analytics' });
  res.json(result);
}`),children:a.loading?"Querying…":"Run with context"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Query result",runResult:a,tone:"rose"}),e.jsx(u,{json:Ye,tone:"slate"})]})}),js=({run:s,runResult:a})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"async handler()",tone:"slate",children:e.jsx("div",{className:j,children:e.jsx(i,{intent:"primary",size:"sm",disabled:a.loading,onClick:()=>s(`async function handler(): Promise<void> {
  const schema = { type: 'object', required: ['id'], properties: { id: { type: 'number' } } };
  const check = util.validateSchema(schema, req.body.payload || {});
  if (!check.valid) {
    res.status(400).json({ success: false, errors: check.errors });
    return;
  }
  const result = await db.query('SELECT * FROM items WHERE id = @p0', [req.body.payload.id]);
  res.json({ success: true, data: result.data });
}`,{sandboxBody:{payload:{id:1}}}),children:a.loading?"Running…":"Run async handler"})})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Response",runResult:a,tone:"slate"}),e.jsx(u,{json:Xe,tone:"slate"})]})}),gs=({run:s,runResult:a})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"console.log / console.error",tone:"slate",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"Logs go to server output ([Server Function] prefix). The HTTP response is separate."}),e.jsx(i,{intent:"primary",size:"sm",disabled:a.loading,onClick:()=>s(U),children:a.loading?"Running…":"Run with logging"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"HTTP response (logs are server-side)",runResult:a,tone:"slate"}),e.jsx(u,{json:U,tone:"slate"})]})}),bs=()=>e.jsx(_,{title:"Injectable snippets",description:"Use these markers in the Server Functions editor (snippet toolbar) or paste directly into your function.",snippets:[],children:e.jsx("div",{className:"flex flex-col gap-3",children:ts.map(s=>e.jsxs("div",{children:[e.jsxs("p",{className:"mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500",children:[s.label,e.jsx("span",{className:"ms-2 font-mono font-normal normal-case text-slate-400",children:s.marker})]}),e.jsx(u,{json:s.body,tone:"slate"})]},s.key))})}),ys=({code:s,setCode:a,payloadText:r,setPayloadText:l,method:t,setMethod:n,run:o,reportError:d,runResult:N})=>e.jsx(v,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"CRUD handler example",tone:"slate",children:e.jsxs("div",{className:j,children:[e.jsx(g,{label:"Simulated method (req.method)",className:b,children:e.jsx(P,{size:"sm",className:T,value:t,onChange:y=>n(y.target.value),placeholder:"GET"})}),e.jsx(g,{label:"Handler code",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[8rem] w-full font-mono text-[11px]",value:s,onChange:y=>a(y.target.value)})}),e.jsx(g,{label:"payload (JSON)",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[3rem] w-full font-mono text-[11px]",value:r,onChange:y=>l(y.target.value)})}),e.jsx(i,{intent:"primary",size:"sm",disabled:N.loading,onClick:()=>{let y;try{y=JSON.parse(r)}catch{d("payload is not valid JSON.");return}o(s,{sandboxBody:{payload:y,_method:t}})},children:N.loading?"Running…":"Run CRUD handler"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(f,{label:"Response",runResult:N,tone:"slate"}),e.jsx(u,{json:K,tone:"slate"})]})}),fs=()=>e.jsx(_,{title:"Workflow: AI structured output",description:"ai.llm-structured validates model JSON against outputSchema using the same ajv primitive as util.validateSchema.",snippets:[{label:"ACTION node with outputSchema",code:ss,tone:"violet"},{label:"Server Function equivalent",code:z,tone:"slate"}]}),vs=()=>e.jsx(_,{title:"Workflow: text.regex-match",description:"Use the corePack Action instead of free-form regex. Same RE2-backed util.regexMatch primitive.",snippets:[{label:"ACTION node config",code:es,tone:"emerald"},{label:"Server Function equivalent",code:$,tone:"slate"}]}),Ss=()=>e.jsx(_,{title:"Package API handler",description:"Installed package routes use module.exports with req, res, and util.* (imported from canonical server utils).",snippets:[{label:"edge/*.js handler",code:as,tone:"cyan"},{label:"Validation pattern",code:z,tone:"slate"}]}),k=({label:s,runResult:a,tone:r="slate",emptyHint:l="Run the tester to see a real result."})=>e.jsxs("div",{children:[e.jsx("p",{className:"mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500",children:s}),a.error?e.jsx("p",{className:"text-xs text-rose-600",children:a.error}):e.jsx(u,{json:JSON.stringify(a.data??{info:l},null,2),tone:r})]}),w=({form:s,preview:a})=>e.jsxs("div",{className:C(H,"min-h-0 flex-1"),children:[e.jsx("div",{className:W,children:s}),e.jsx(M,{children:a})]}),Ns=({run:s,runResult:a})=>e.jsx(w,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Probe sandbox globals",tone:"slate",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"Lists every global, util keys, and confirms npm/require are blocked."}),e.jsx(i,{intent:"primary",size:"sm",onClick:()=>s(`res.json({
  globals: { req: typeof req, res: typeof res, db: typeof db, ctx: typeof ctx, util: typeof util },
  utilKeys: Object.keys(util),
  blocked: { require: typeof require, process: typeof process },
  reqShape: { body: typeof req.body, query: typeof req.query, params: typeof req.params, method: req.method, auth: req.auth },
});`),disabled:a.loading,children:a.loading?"Probing…":"Run global probe"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(k,{label:"Probe result",runResult:a,tone:"slate"}),e.jsxs("div",{children:[e.jsx("p",{className:"mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500",children:"Globals reference"}),e.jsx(rs,{})]}),e.jsxs("div",{children:[e.jsx("p",{className:"mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500",children:"Quick reference"}),e.jsx(u,{json:Me,tone:"slate"})]})]})}),Es=({pattern:s,setPattern:a,flags:r,setFlags:l,isGlobal:t,setIsGlobal:n,subjectText:o,setSubjectText:d,run:N,runResult:y})=>e.jsx(w,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Regex match (RE2, ReDoS-safe)",tone:"emerald",children:e.jsxs("div",{className:j,children:[e.jsx(g,{label:"Pattern",className:b,children:e.jsx(P,{size:"sm",className:T,value:s,onChange:E=>a(E.target.value)})}),e.jsx(g,{label:"Flags",className:b,children:e.jsx(P,{size:"sm",className:T,value:r,onChange:E=>l(E.target.value),placeholder:"i"})}),e.jsx(g,{label:"",className:b,children:e.jsx(Re,{checked:t,onChange:n,children:"Match all occurrences (global)"})}),e.jsx(g,{label:"Subject text",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[4.5rem] w-full",value:o,onChange:E=>d(E.target.value)})}),e.jsx(i,{intent:"primary",size:"sm",onClick:()=>N(`res.json(util.regexMatch(${JSON.stringify(s)}, ${JSON.stringify(o)}, ${JSON.stringify({flags:r,global:t})}));`),disabled:y.loading,children:y.loading?"Running…":"Run util.regexMatch"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(k,{label:"Result",runResult:y,tone:"emerald"}),e.jsx(u,{json:$,tone:"slate"})]})}),qs=({schemaText:s,setSchemaText:a,valueText:r,setValueText:l,onRun:t,runResult:n})=>e.jsx(w,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"JSON Schema validate (ajv)",tone:"cyan",children:e.jsxs("div",{className:j,children:[e.jsx(g,{label:"Schema (JSON)",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[6rem] w-full font-mono text-[11px]",value:s,onChange:o=>a(o.target.value)})}),e.jsx(g,{label:"Value (JSON)",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[4rem] w-full font-mono text-[11px]",value:r,onChange:o=>l(o.target.value)})}),e.jsx(i,{intent:"primary",size:"sm",onClick:t,disabled:n.loading,children:n.loading?"Validating…":"Run util.validateSchema"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(k,{label:"Result",runResult:n,tone:"cyan"}),e.jsx(u,{json:z,tone:"slate"})]})}),Cs=({run:s,runResult:a})=>e.jsx(w,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"req.auth",tone:"violet",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"Reads the authenticated caller from your current session."}),e.jsx(i,{intent:"primary",size:"sm",onClick:()=>s("res.json(req.auth);"),disabled:a.loading,children:a.loading?"Reading…":"Read req.auth"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(k,{label:"req.auth",runResult:a,tone:"violet"}),e.jsx(u,{json:Be,tone:"slate"})]})}),Ps=({ctxKey:s,setCtxKey:a,run:r,runResult:l})=>e.jsx(w,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"ctx (session context)",tone:"amber",children:e.jsxs("div",{className:j,children:[e.jsx(g,{label:"Key to read",className:b,children:e.jsx(P,{size:"sm",className:T,value:s,onChange:t=>a(t.target.value),placeholder:"tenantId"})}),e.jsx(i,{intent:"primary",size:"sm",onClick:()=>r(`res.json({ key: ${JSON.stringify(s)}, value: ctx.get(${JSON.stringify(s)}), serverValue: ctx.server.get(${JSON.stringify(s)}), clientValue: ctx.client.get(${JSON.stringify(s)}) });`),disabled:l.loading,children:l.loading?"Reading…":"Read ctx key"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(k,{label:"ctx values",runResult:l,tone:"amber"}),e.jsx(u,{json:We,tone:"slate"})]})}),Ts=({run:s,runResult:a})=>e.jsx(w,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"db.query",tone:"rose",children:e.jsxs("div",{className:j,children:[e.jsx("p",{className:"text-xs text-slate-600",children:"Mock rows in this tester; real data source in production runs."}),e.jsx(i,{intent:"primary",size:"sm",onClick:()=>s("async function handler() { const result = await db.query('SELECT 1 AS n', []); res.json(result); }"),disabled:a.loading,children:a.loading?"Querying…":"Run db.query"})]})})}),preview:e.jsxs("div",{className:p,children:[e.jsx(k,{label:"Query result",runResult:a,tone:"rose"}),e.jsx(u,{json:Qe,tone:"slate"})]})}),ks=({code:s,setCode:a,payloadText:r,setPayloadText:l,run:t,reportError:n,runResult:o})=>e.jsx(w,{form:e.jsx("div",{className:h,children:e.jsx(x,{title:"Handler playground",tone:"slate",children:e.jsxs("div",{className:j,children:[e.jsx(g,{label:"Handler code",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[10rem] w-full font-mono text-[11px]",value:s,onChange:d=>a(d.target.value)})}),e.jsx(g,{label:"payload (JSON)",className:b,children:e.jsx(q,{size:"sm",className:"min-h-[3.5rem] w-full font-mono text-[11px]",value:r,onChange:d=>l(d.target.value)})}),e.jsx(i,{intent:"primary",size:"sm",disabled:o.loading,onClick:()=>{let d;try{d=JSON.parse(r)}catch{n("payload is not valid JSON.");return}t(s,{sandboxBody:{payload:d}})},children:o.loading?"Running…":"Run handler"})]})})}),preview:e.jsx("div",{className:p,children:e.jsx(k,{label:"Response",runResult:o,tone:"slate"})})}),ws=({activeTopic:s,runResult:a,run:r,reportError:l,regex:t,schema:n,schemaFormats:o,reqBody:d,reqQuery:N,roleGuard:y,sessionCtx:E,handler:I,crud:R})=>{const m={run:r,reportError:l,runResult:a};switch(s){case"overview":return e.jsx(Ns,{...m});case"typescript-types":return e.jsx(ns,{});case"security-limits":return e.jsx(os,{...m});case"regex-match":return e.jsx(Es,{...m,...t});case"regex-errors":return e.jsx(is,{...m});case"validate-schema":return e.jsx(qs,{...m,...n});case"schema-formats":return e.jsx(cs,{...m,...o});case"req-body":return e.jsx(ds,{...m,...d});case"req-query":return e.jsx(ms,{...m,...N});case"req-auth":return e.jsx(Cs,{...m});case"role-guard":return e.jsx(us,{...m,...y});case"session-ctx":return e.jsx(Ps,{...m,...E});case"res-patterns":return e.jsx(xs,{...m});case"response-contract":return e.jsx(ps,{...m});case"db-query":return e.jsx(Ts,{...m});case"db-data-source":return e.jsx(hs,{...m});case"async-handler":return e.jsx(js,{...m});case"console-logging":return e.jsx(gs,{...m});case"injectable-snippets":return e.jsx(bs,{});case"handler-playground":return e.jsx(ks,{...m,...I});case"handler-crud":return e.jsx(ys,{...m,...R});case"workflow-regex":return e.jsx(vs,{});case"workflow-ai-schema":return e.jsx(fs,{});case"package-api":return e.jsx(Ss,{});default:return null}},Rs="text-slate-900",_s=({activeTopic:s,onSelect:a})=>qe()==="phone"?e.jsx("div",{className:"shrink-0 border-b border-slate-200 bg-white px-3 py-2.5",children:e.jsxs("label",{className:"flex flex-col gap-[2px] ps-[4px]",children:[e.jsx("span",{className:J,children:"Topic"}),e.jsx(we,{size:"sm",value:s,onChange:t=>a(t.target.value),className:"w-full",ariaLabel:"Server utility topic",children:A.map(t=>e.jsx("option",{value:t.id,children:t.label},t.id))})]})}):e.jsx("nav",{className:"min-h-0 shrink-0 overflow-y-auto border-e border-slate-200 bg-slate-50 p-3 lg:w-[13rem] xl:w-[15rem]","aria-label":"Server utility topics",children:e.jsx("div",{className:"flex flex-col gap-3",children:Ae.map(t=>{const n=A.filter(o=>o.group===t.id);return n.length===0?null:e.jsxs("div",{children:[e.jsx("p",{className:C("mb-1",J),children:t.label}),e.jsx("div",{className:"space-y-0.5",children:n.map(o=>{const d=s===o.id;return e.jsx("button",{type:"button",onClick:()=>a(o.id),className:C(Pe,"w-full text-start",d?C(Ce,Rs):"border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"),"aria-current":d?"page":void 0,children:e.jsx("span",{className:"truncate text-xs",children:o.label})},o.id)})})]},t.id)})})}),G={loading:!1,error:null,data:null},Os=s=>{if(!s)return"/api/core/server-functions/execute";const a=new URLSearchParams;for(const[l,t]of Object.entries(s))t!=null&&t!==""&&a.set(l,String(t));const r=a.toString();return r?`/api/core/server-functions/execute?${r}`:"/api/core/server-functions/execute"},As=async(s,a={})=>{const{sandboxBody:r,query:l}=a,t=Os(l),{data:n}=await Te(t,{code:s,language:"js",timeoutMs:5e3,...r});return n},Is=async(s,a={})=>{try{return{loading:!1,error:null,data:await As(s,a)}}catch(r){return{loading:!1,error:r instanceof Error?r.message:"Request failed.",data:null}}},ra=()=>{const[s,a]=c.useState(Ie),[r,l]=c.useState(G),[t,n]=c.useState("(\\w+)@(\\w+)"),[o,d]=c.useState("i"),[N,y]=c.useState(!1),[E,I]=c.useState("contact: ada@example, backup: bob@example"),[R,m]=c.useState(`{
  "type": "object",
  "required": ["email"],
  "properties": { "email": { "type": "string", "format": "email" } }
}`),[L,Q]=c.useState(`{
  "email": "not-an-email"
}`),[Y,X]=c.useState(Ue),[Z,ee]=c.useState(`{
  "name": "Ada",
  "role": "admin"
}`),[se,ae]=c.useState("2"),[te,re]=c.useState("name"),[le,ne]=c.useState("ADMIN"),[oe,ie]=c.useState("tenantId"),[ce,de]=c.useState(Ze),[me,ue]=c.useState(`{
  "name": "Ada"
}`),[xe,pe]=c.useState(K),[he,je]=c.useState(`{
  "name": "New item",
  "active": true
}`),[ge,be]=c.useState("POST"),F=A.find(S=>S.id===s),D=c.useCallback(async(S,O={})=>{l({loading:!0,error:null,data:null});const Se=await Is(S,O);l(Se)},[]),ye=c.useCallback(S=>{l({loading:!1,error:S,data:null})},[]),fe=c.useCallback(async()=>{let S,O;try{S=JSON.parse(R)}catch{l({loading:!1,error:"Schema is not valid JSON.",data:null});return}try{O=JSON.parse(L)}catch{l({loading:!1,error:"Value is not valid JSON.",data:null});return}await D(`res.json(util.validateSchema(${JSON.stringify(S)}, ${JSON.stringify(O)}));`)},[D,R,L]),ve=c.useCallback(S=>{a(S),l(G)},[]);return e.jsxs("div",{className:"flex h-full min-h-0 flex-col bg-white",children:[e.jsxs("div",{className:"shrink-0 border-b border-slate-200 px-4 py-3",children:[e.jsx("p",{className:"text-sm font-semibold text-slate-900",children:"Developer Reference"}),e.jsxs("p",{className:"mt-0.5 text-xs text-slate-500",children:["Server Function sandbox — ",A.length," topics, all runnable against the real sandbox."]})]}),e.jsxs("div",{className:"flex min-h-0 flex-1 flex-col lg:flex-row",children:[e.jsx(_s,{activeTopic:s,onSelect:ve}),e.jsxs("div",{className:"flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",children:[F?e.jsxs("div",{className:"shrink-0 border-b border-slate-200 px-3 py-2 sm:px-4",children:[e.jsx("p",{className:"text-sm font-semibold text-slate-900",children:F.label}),e.jsx("p",{className:"mt-0.5 text-xs text-slate-600",children:F.description})]}):null,e.jsx("div",{className:"flex min-h-0 flex-1 flex-col overflow-hidden",children:e.jsx(ws,{activeTopic:s,runResult:r,run:D,reportError:ye,regex:{pattern:t,setPattern:n,flags:o,setFlags:d,isGlobal:N,setIsGlobal:y,subjectText:E,setSubjectText:I},schema:{schemaText:R,setSchemaText:m,valueText:L,setValueText:Q,onRun:fe},schemaFormats:{valueText:Y,setValueText:X},reqBody:{payloadText:Z,setPayloadText:ee},reqQuery:{page:se,setPage:ae,sort:te,setSort:re},roleGuard:{requiredRole:le,setRequiredRole:ne},sessionCtx:{ctxKey:oe,setCtxKey:ie},handler:{code:ce,setCode:de,payloadText:me,setPayloadText:ue},crud:{code:xe,setCode:pe,payloadText:he,setPayloadText:je,method:ge,setMethod:be}})})]})]})]})};export{ra as DevReferencePage};
