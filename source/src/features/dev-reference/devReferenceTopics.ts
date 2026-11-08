import { INJECTABLE_SNIPPETS } from '../server-functions/constants';
import { SERVER_FUNCTION_SANDBOX_TYPE_DEFINITIONS } from '../../shared/api/contracts/server-functions/templates';

export type ServerUtilityTopicId =
  | 'overview'
  | 'typescript-types'
  | 'security-limits'
  | 'regex-match'
  | 'regex-errors'
  | 'validate-schema'
  | 'schema-formats'
  | 'req-body'
  | 'req-query'
  | 'req-auth'
  | 'role-guard'
  | 'session-ctx'
  | 'res-patterns'
  | 'response-contract'
  | 'db-query'
  | 'db-data-source'
  | 'async-handler'
  | 'console-logging'
  | 'injectable-snippets'
  | 'handler-playground'
  | 'handler-crud'
  | 'workflow-regex'
  | 'workflow-ai-schema'
  | 'package-api';

export type ServerUtilityTopicGroup =
  | 'reference'
  | 'util'
  | 'request'
  | 'response'
  | 'data'
  | 'auth'
  | 'patterns'
  | 'playground'
  | 'guides';

export type ServerUtilityTopic = {
  id: ServerUtilityTopicId;
  label: string;
  group: ServerUtilityTopicGroup;
  description: string;
};

export const SERVER_UTILITY_TOPIC_GROUPS: { id: ServerUtilityTopicGroup; label: string }[] = [
  { id: 'reference', label: 'Reference' },
  { id: 'util', label: 'util.*' },
  { id: 'request', label: 'Request (req)' },
  { id: 'response', label: 'Response (res)' },
  { id: 'data', label: 'Database (db)' },
  { id: 'auth', label: 'Auth & session' },
  { id: 'patterns', label: 'Coding patterns' },
  { id: 'playground', label: 'Playground' },
  { id: 'guides', label: 'Guides' },
];

export const SERVER_UTILITY_TOPICS: ServerUtilityTopic[] = [
  {
    id: 'overview',
    label: 'Globals overview',
    group: 'reference',
    description: 'Complete map of every global in the Server Function sandbox, including require() for Libraries.',
  },
  {
    id: 'typescript-types',
    label: 'TypeScript types',
    group: 'reference',
    description: 'Canonical EdgeReq, EdgeRes, and EdgeDb typings used in generated route templates.',
  },
  {
    id: 'security-limits',
    label: 'Security & limits',
    group: 'reference',
    description: 'Sandbox isolation rules, timeout/memory caps, and what is intentionally blocked.',
  },
  {
    id: 'regex-match',
    label: 'util.regexMatch',
    group: 'util',
    description: 'RE2-backed, ReDoS-safe regex (max 500-char pattern, 100k-char subject).',
  },
  {
    id: 'regex-errors',
    label: 'Regex error codes',
    group: 'util',
    description: 'Safe error shapes returned instead of throwing on invalid or oversized patterns.',
  },
  {
    id: 'validate-schema',
    label: 'util.validateSchema',
    group: 'util',
    description: 'ajv + ajv-formats JSON Schema validation for bodies and arbitrary values.',
  },
  {
    id: 'schema-formats',
    label: 'Schema formats',
    group: 'util',
    description: 'Built-in ajv-formats: email, date-time, uuid, uri, and more.',
  },
  {
    id: 'req-body',
    label: 'req.body',
    group: 'request',
    description: 'Read the JSON POST body available to your handler.',
  },
  {
    id: 'req-query',
    label: 'req.query',
    group: 'request',
    description: 'Read URL query string parameters passed to the route.',
  },
  {
    id: 'req-auth',
    label: 'req.auth',
    group: 'auth',
    description: 'Authenticated caller identity: userId, email, roles.',
  },
  {
    id: 'role-guard',
    label: 'Role guard',
    group: 'auth',
    description: 'Return 403 when the caller lacks a required role.',
  },
  {
    id: 'session-ctx',
    label: 'ctx (session)',
    group: 'auth',
    description: 'Server/client session attribute slices via ctx.get and scoped accessors.',
  },
  {
    id: 'res-patterns',
    label: 'res patterns',
    group: 'response',
    description: 'res.json, res.status().json, res.send, and res.headersSent.',
  },
  {
    id: 'response-contract',
    label: 'Response contract',
    group: 'response',
    description: 'Platform convention: { success: true, data } and { success: false, error }.',
  },
  {
    id: 'db-query',
    label: 'db.query',
    group: 'data',
    description: 'Async database proxy — mock rows in this tester, real data source in production.',
  },
  {
    id: 'db-data-source',
    label: 'Data source context',
    group: 'data',
    description: 'Route queries to a specific dataSourceId or database via db.query context.',
  },
  {
    id: 'async-handler',
    label: 'async handler()',
    group: 'patterns',
    description: 'Recommended handler structure with await for db.query and other async work.',
  },
  {
    id: 'console-logging',
    label: 'console.log',
    group: 'patterns',
    description: 'console.log and console.error — output appears in server logs, not the HTTP response.',
  },
  {
    id: 'injectable-snippets',
    label: 'Injectable snippets',
    group: 'patterns',
    description: 'Editor snippets (@inject:*) for typings, helpers, and guards — paste into your function.',
  },
  {
    id: 'handler-playground',
    label: 'Handler playground',
    group: 'playground',
    description: 'Edit and run arbitrary handler code against the real sandbox.',
  },
  {
    id: 'handler-crud',
    label: 'CRUD handler example',
    group: 'playground',
    description: 'End-to-end validate → query → respond pattern you can copy into new functions.',
  },
  {
    id: 'workflow-regex',
    label: 'Workflow regex-match',
    group: 'guides',
    description: 'text.regex-match corePack Action configuration.',
  },
  {
    id: 'workflow-ai-schema',
    label: 'Workflow AI schema',
    group: 'guides',
    description: 'How ai.llm-structured validates model output against outputSchema.',
  },
  {
    id: 'package-api',
    label: 'Package API handler',
    group: 'guides',
    description: 'module.exports handler pattern for installed package API routes.',
  },
];

export const DEFAULT_SERVER_UTILITY_TOPIC: ServerUtilityTopicId = 'overview';

export const GLOBALS_REFERENCE = [
  { name: 'req', type: 'object', summary: 'body, query, params, method, headers, auth' },
  { name: 'res', type: 'object', summary: 'json(), status(), send(), headersSent()' },
  { name: 'db', type: 'object', summary: 'query(operation, params?, context?) — async' },
  { name: 'ctx', type: 'object', summary: 'get(key), server.get(key), client.get(key)' },
  { name: 'require', type: 'function', summary: 'Node require() from developer Libraries plus platform packages' },
  { name: 'util', type: 'object', summary: 'regexMatch(), validateSchema()' },
  { name: 'console', type: 'object', summary: 'log(), error() — server logs only' },
] as const;

export const BLOCKED_GLOBALS = [
  'import', 'process', 'module', 'global', 'globalThis', 'Buffer', '__dirname',
] as const;

export const SANDBOX_LIMITS = [
  { label: 'Timeout', value: '100 – 15 000 ms (default 3 000)' },
  { label: 'Memory', value: '64 / 128 / 256 MB per worker' },
  { label: 'Regex pattern', value: 'max 500 characters' },
  { label: 'Regex subject', value: 'max 100 000 characters' },
  { label: 'npm packages', value: 'Libraries page — require() after install; core packages are provided' },
  { label: 'Sensitive headers', value: 'cookie & authorization stripped from req.headers' },
] as const;

export const GLOBALS_OVERVIEW_SNIPPET = `// Server Function sandbox globals:
req        // body, query, params, method, headers, auth: { userId?, email?, roles[] }
res        // res.json(data) | res.status(code) | res.send(data) | res.headersSent()
db.query(operation, params?, context?)   // async — proxied to host data source
ctx.get(key) / ctx.server.get(key) / ctx.client.get(key)
require(name)                             // developer Libraries + Node builtins / platform packages
console.log(...) / console.error(...)     // server logs, not HTTP response
util.regexMatch(pattern, text, options?)
util.validateSchema(schema, value)

// Core libraries (react, react-dom, react-router-dom, @heroui/react, @heroui/styles)
// are provided by the platform — do not install them from Libraries.`;

export const TYPESCRIPT_TYPES_SNIPPET = SERVER_FUNCTION_SANDBOX_TYPE_DEFINITIONS;

export const REGEX_USAGE_SNIPPET = `const result = util.regexMatch('(\\\\w+)@(\\\\w+)', 'contact: ada@example', { flags: 'i' });
// { ok: true, matched: true, matches: [{ match, index, groups, namedGroups }] }
res.json(result);`;

export const REGEX_ERROR_SNIPPET = `// Errors never throw — always check result.ok:
const bad = util.regexMatch('[', 'abc');
// { ok: false, errorCode: 'INVALID_PATTERN', message: '...' }

const long = util.regexMatch('a'.repeat(501), 'x');
// { ok: false, errorCode: 'PATTERN_TOO_LONG', message: '...' }`;

export const SCHEMA_USAGE_SNIPPET = `const schema = {
  type: 'object',
  required: ['email'],
  properties: { email: { type: 'string', format: 'email' } },
};
const check = util.validateSchema(schema, req.body.payload);
if (!check.valid) return res.status(400).json({ success: false, errors: check.errors });
res.json({ success: true });`;

export const SCHEMA_FORMATS_SNIPPET = `// ajv-formats supported in util.validateSchema:
const schema = {
  type: 'object',
  required: ['email', 'createdAt', 'id'],
  properties: {
    email: { type: 'string', format: 'email' },
    createdAt: { type: 'string', format: 'date-time' },
    id: { type: 'string', format: 'uuid' },
    website: { type: 'string', format: 'uri' },
  },
};`;

export const SCHEMA_FORMATS_DEFAULT_VALUE = '{\n  "email": "not-an-email",\n  "createdAt": "yesterday",\n  "id": "not-a-uuid",\n  "website": "ftp://bad"\n}';

export const REQ_BODY_SNIPPET = `async function handler() {
  const payload = req.body.payload || req.body;
  res.json({ method: req.method, bodyKeys: Object.keys(req.body || {}), payload });
}`;

export const REQ_QUERY_SNIPPET = `async function handler() {
  const page = Number(req.query.page || 1);
  const sort = String(req.query.sort || 'name');
  res.json({ page, sort, allQuery: req.query });
}`;

export const AUTH_USAGE_SNIPPET = `const userId = req.auth?.userId;
const roles = req.auth?.roles || [];
if (!userId) return res.status(401).json({ success: false, error: 'Authentication required.' });
res.json({ userId, email: req.auth?.email, roles });`;

export const ROLE_GUARD_SNIPPET = `const roles = req.auth?.roles || [];
const required = 'ADMIN';
if (!roles.includes(required)) {
  return res.status(403).json({ success: false, error: 'Forbidden: requires ' + required });
}
res.json({ success: true, message: 'Access granted.' });`;

export const CTX_USAGE_SNIPPET = `const tenantId = ctx.get('tenantId');       // server first, then client
const theme = ctx.client.get('theme');      // client slice only
const flags = ctx.server.get('featureFlags'); // server slice only
res.json({ tenantId, theme, flags });`;

export const RES_PATTERNS_SNIPPET = `// JSON response (most common):
res.json({ success: true, data: { id: 1 } });

// Status + JSON:
res.status(201).json({ success: true, data: { id: 1 } });

// Plain text / non-JSON:
res.status(200).send('OK');

// Guard against double response:
if (!res.headersSent()) res.json({ success: true });`;

export const RESPONSE_CONTRACT_SNIPPET = `// Success (2xx):
res.status(200).json({ success: true, data: rows, count: rows.length });

// Client error (4xx):
res.status(400).json({ success: false, error: 'Invalid input', errors: check.errors });

// Auth error:
res.status(401).json({ success: false, error: 'Authentication required.' });

// Forbidden:
res.status(403).json({ success: false, error: 'Forbidden.' });`;

export const DB_QUERY_USAGE_SNIPPET = `const result = await db.query(
  'SELECT id, name FROM users WHERE active = @p0',
  [true],
);
res.json({ success: true, data: result.data, count: result.count, source: result.source });`;

export const DB_DATA_SOURCE_SNIPPET = `// Route a query to a specific data source:
const result = await db.query(
  'SELECT COUNT(*) AS total FROM orders',
  [],
  { dataSourceId: 'reporting-db', database: 'analytics' },
);

// Or use the withDataSource helper from injectable snippets:
const reportingDb = withDataSource({ dataSourceName: 'Reporting-Postgres' });
const rows = await reportingDb.query('SELECT id, total FROM invoices LIMIT 10');`;

export const ASYNC_HANDLER_SNIPPET = `async function handler(): Promise<void> {
  const check = util.validateSchema(schema, req.body.payload);
  if (!check.valid) {
    res.status(400).json({ success: false, errors: check.errors });
    return;
  }
  const result = await db.query('SELECT * FROM items WHERE id = @p0', [req.body.id]);
  res.json({ success: true, data: result.data });
}`;

export const CONSOLE_LOGGING_SNIPPET = `async function handler() {
  console.log('[my-fn] invoked', { method: req.method, userId: req.auth?.userId });
  try {
    const result = await db.query('SELECT 1', []);
    console.log('[my-fn] query ok', result.count);
    res.json({ success: true });
  } catch (error) {
    console.error('[my-fn] failed', error);
    res.status(500).json({ success: false, error: 'Internal error.' });
  }
}`;

export const HANDLER_TEMPLATE = `async function handler(): Promise<void> {
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
}`;

export const CRUD_HANDLER_SNIPPET = `async function handler(): Promise<void> {
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
}`;

export const WORKFLOW_REGEX_SNIPPET = `{
  "kind": "ACTION",
  "actionRef": { "key": "text.regex-match", "version": "1" },
  "config": { "pattern": "(\\\\w+)@(\\\\w+)", "flags": "i" },
  "input": { "text": { "type": "PATH", "path": "$.trigger.emailBody" } }
}`;

export const WORKFLOW_AI_SCHEMA_SNIPPET = `// ai.llm-structured Action — model output validated against outputSchema (ajv):
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
const check = util.validateSchema(outputSchema, modelResponse);`;

export const PACKAGE_API_SNIPPET = `module.exports = async function handler(req, res) {
  const check = util.validateSchema(
    { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    req.body,
  );
  if (!check.valid) return res.status(400).json({ success: false, errors: check.errors });

  const match = util.regexMatch('^v\\\\d+', String(req.query.version || ''), { flags: 'i' });
  res.json({ success: true, versionMatched: match.matched });
};`;

export const INJECTABLE_SNIPPET_ENTRIES = INJECTABLE_SNIPPETS.map((snippet) => ({
  key: snippet.key,
  label: snippet.label,
  marker: snippet.marker,
  body: snippet.body,
}));
