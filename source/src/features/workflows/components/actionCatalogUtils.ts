import { resolveInlineActionSchema, type WorkflowDesignerProjection, type WorkflowModel, type ActionJsonSchemaProperty } from '../types';

/**
 * Client-side display metadata for Actions. `projection.actionCatalog` (already sent on every
 * `getProjection` load — see `workflowDesignerProjectionService.ts`) carries the real, registered,
 * available Actions' full governed contract, including `configSchema`/`inputSchema` (see
 * `resolveInlineActionSchema` in `../types.ts`, consumed by `ActionFieldsMappingEditor` to render a
 * per-field form instead of a blind key/value editor) — no `displayName`/category, since
 * `ActionDefinition` is a frozen backend contract type (doc 04) not meant to carry UI presentation
 * concerns beyond a JSON Schema's own `title`/`description`. Category/label are derived here from
 * the `<category>.<name>` key convention every corePack Action already follows, the same
 * "client-only friendly metadata over a structural key" pattern `nodeTemplates.ts` already uses for
 * `NODE_KIND_LABELS`.
 */

export type ActionCatalogEntry = WorkflowDesignerProjection['actionCatalog'][number];

export const ACTION_CATEGORY_ORDER = ['data', 'text', 'date', 'communication', 'integration', 'web', 'ai', 'crypto', 'document', 'file'] as const;
export type ActionCategory = (typeof ACTION_CATEGORY_ORDER)[number];

/** In-process Server Function call — shown under Integration next to HTTP request. */
export const INTERNAL_API_CALL_ACTION_KEY = 'integration.internal-api-call';
export const WEB_SEARCH_ACTION_KEY = 'web.search';
export const WEB_FETCH_URL_ACTION_KEY = 'web.fetch-url';
export const WEB_SCREENSHOT_URL_ACTION_KEY = 'web.screenshot-url';

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  data: 'Data',
  text: 'Text',
  date: 'Date & time',
  communication: 'Communication',
  integration: 'Integration',
  web: 'Web',
  ai: 'AI',
  crypto: 'Crypto',
  document: 'Documents',
  file: 'Files',
};

export function actionCategoryOf(actionKey: string): ActionCategory | 'other' {
  const prefix = actionKey.split('.')[0];
  return (ACTION_CATEGORY_ORDER as readonly string[]).includes(prefix) ? (prefix as ActionCategory) : 'other';
}

/** `text.regex-match` -> "Regex match"; `communication.email-send` -> "Email send". */
const FRIENDLY_ACTION_LABELS: Record<string, string> = {
  [INTERNAL_API_CALL_ACTION_KEY]: 'Internal API call',
  [WEB_SEARCH_ACTION_KEY]: 'Web search',
  [WEB_FETCH_URL_ACTION_KEY]: 'Fetch page',
  [WEB_SCREENSHOT_URL_ACTION_KEY]: 'Screenshot URL',
  'data.record-get': 'Get record',
  'data.record-create': 'Create record',
  'data.record-update': 'Update record',
  'data.record-delete': 'Delete record',
  'data.record-create-many': 'Create many records',
  'data.record-upsert': 'Upsert record',
  'data.map-records': 'Map records',
  'data.csv-parse': 'Parse CSV',
  'data.csv-stringify': 'Stringify CSV',
  'data.db-query': 'Query database (read)',
  'data.pivot-threshold-check': 'Pivot threshold check',
  'data.pivot-snapshot-delivery': 'Pivot snapshot delivery',
  'data.html-to-text': 'HTML to text',
  'data.rss-parse': 'Parse RSS / Atom',
  'integration.http-request': 'HTTP request',
  'integration.event-publish': 'Publish event',
  'communication.notification-send': 'In-app notification',
  'crypto.hmac-verify': 'Verify HMAC',
  'document.pdf-extract-text': 'Extract PDF text',
  'ai.embedding': 'Embed text',
  'ai.vector-upsert': 'Vector upsert',
  'ai.vector-search': 'Vector search',
};

export function friendlyActionLabel(actionKey: string): string {
  const override = FRIENDLY_ACTION_LABELS[actionKey];
  if (override) return override;
  const name = actionKey.split('.').slice(1).join(' ') || actionKey;
  const spaced = name.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PALETTE_ACTION_DESCRIPTIONS: Record<string, string> = {
  [INTERNAL_API_CALL_ACTION_KEY]: 'Call a managed Server Function in-process.',
  [WEB_SEARCH_ACTION_KEY]: 'Search the public web. Uses the provider in Settings → MCP Servers.',
  [WEB_FETCH_URL_ACTION_KEY]: 'Fetch a public URL as readable markdown, text, or HTML.',
  [WEB_SCREENSHOT_URL_ACTION_KEY]: 'Capture a JPEG screenshot of a public page.',
  'data.record-get': 'Read one row by primary key through a published Data API.',
  'data.record-create': 'Insert one row through a published Data API.',
  'data.record-update': 'Update one row by primary key through a published Data API.',
  'data.record-delete': 'Delete one row by primary key through a published Data API.',
  'data.record-create-many': 'Insert many rows (CSV import). Caps at 1000 rows.',
  'data.record-upsert': 'Create or update a row by a unique field (sku, slug, email).',
  'data.map-records': 'Rename and select fields on an array of records before a DB write.',
  'data.csv-parse': 'Parse CSV text into an array of row objects.',
  'data.csv-stringify': 'Turn row objects back into CSV text.',
  'data.db-query': 'Read-only parameterized SELECT against a Data Source.',
  'data.html-to-text': 'Strip HTML tags to plain text (RSS/web follow-up).',
  'data.rss-parse': 'Parse RSS 2.0 or Atom XML into title/link/description items.',
  'integration.http-request': 'GET/POST a public URL. Raise max response bytes for larger CSV files.',
  'integration.event-publish': 'Publish onto the workflow event bus (starts EVENT workflows and wakes WAIT_EVENT).',
  'communication.notification-send': 'Persist an in-app notification for a user or every member of a role.',
  'crypto.hmac-verify': 'Timing-safe HMAC comparison for webhook signatures.',
  'document.pdf-extract-text': 'Best-effort text extraction from a PDF (path or base64).',
  'ai.embedding': 'Turn text into an embedding vector (local or configured model).',
  'ai.vector-upsert': 'Store a document embedding in a named collection.',
  'ai.vector-search': 'Cosine-search a collection for the nearest documents.',
};

export function paletteActionDescription(actionKey: string): string {
  return PALETTE_ACTION_DESCRIPTIONS[actionKey] ?? actionKey;
}

export type ActionCatalogGroup = { category: ActionCategory; label: string; actions: ActionCatalogEntry[] };

const MAX_OUTPUT_FIELD_DEPTH = 5;

/** WFV2-22 — walks an inline JSON Schema to produce dotted field paths for the `@` picker. */
function collectOutputFieldPaths(property: ActionJsonSchemaProperty | undefined, prefix: string[], depth: number): string[][] {
  if (!property || depth >= MAX_OUTPUT_FIELD_DEPTH) return prefix.length > 0 ? [prefix] : [];
  const paths: string[][] = [];
  if (prefix.length > 0) paths.push(prefix);

  if (property.type === 'object' && property.properties) {
    for (const [name, child] of Object.entries(property.properties)) {
      paths.push(...collectOutputFieldPaths(child, [...prefix, name], depth + 1));
    }
    return paths;
  }

  if (property.type === 'array' && property.items && typeof property.items === 'object' && !Array.isArray(property.items)) {
    const itemSchema = property.items as ActionJsonSchemaProperty;
    if (itemSchema.type === 'object' && itemSchema.properties) {
      for (const [name, child] of Object.entries(itemSchema.properties)) {
        paths.push(...collectOutputFieldPaths(child, [...prefix, name], depth + 1));
      }
    }
  }

  return paths;
}

/**
 * Client-only "what fields does this node's output have" index, keyed by node key — pure UI sugar
 * layered on top of the already-authorized `WorkflowReferenceCatalog` descriptors (`@` picker),
 * never a second legality/reachability authority: the backend still decides *which* nodes are
 * legal to reference from a given editing position (dominance/reachability graph analysis, doc02/
 * doc08's frozen `WorkflowReferenceCatalog` contract — not reimplemented here). This only adds
 * field-path *hints* for nodes the backend already returned, computed from each ACTION node's
 * resolved Action `outputSchema` (see `resolveInlineActionSchema`). Non-ACTION nodes and Actions
 * with no declared `outputSchema` simply contribute no hints — never a fabricated guess.
 */
export function buildOutputFieldPathsIndex(model: WorkflowModel, actionCatalog: ActionCatalogEntry[]): Record<string, string[][]> {
  const index: Record<string, string[][]> = {};
  for (const node of model.nodes) {
    if (node.kind !== 'ACTION') continue;
    const actionRef = (node.actionRef as { action?: { actionKey?: string } } | undefined)?.action;
    if (!actionRef?.actionKey) continue;
    const entry = actionCatalog.find((a) => a.key === actionRef.actionKey);
    const schema = resolveInlineActionSchema(entry?.outputSchema);
    if (!schema?.properties) continue;
    const paths: string[][] = [];
    for (const [name, child] of Object.entries(schema.properties)) {
      paths.push(...collectOutputFieldPaths(child, [name], 1));
    }
    const deduped = Array.from(new Map(paths.map((segments) => [segments.join('\0'), segments])).values());
    if (deduped.length > 0) index[node.key] = deduped.sort((a, b) => a.join('.').localeCompare(b.join('.')));
  }
  return index;
}

/** @deprecated Prefer `buildOutputFieldPathsIndex` — returns top-level field names only. */
export function buildOutputFieldsIndex(model: WorkflowModel, actionCatalog: ActionCatalogEntry[]): Record<string, string[]> {
  const pathsIndex = buildOutputFieldPathsIndex(model, actionCatalog);
  const index: Record<string, string[]> = {};
  for (const [nodeKey, paths] of Object.entries(pathsIndex)) {
    index[nodeKey] = paths.filter((segments) => segments.length === 1).map((segments) => segments[0]!);
  }
  return index;
}

const paletteStub = (key: string, sideEffectClass: ActionCatalogEntry['sideEffectClass'], tags: string[]): ActionCatalogEntry => ({
  key,
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass,
  tags,
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: { type: 'INLINE', schema: {} },
});

/** Always visible in the toolbox even if the live catalog has not been rebuilt yet. */
const PALETTE_ALWAYS_VISIBLE_STUBS: ActionCatalogEntry[] = [
  paletteStub(INTERNAL_API_CALL_ACTION_KEY, 'WRITE_EXTERNAL', ['integration', 'server-functions']),
  paletteStub(WEB_SEARCH_ACTION_KEY, 'READ_EXTERNAL', ['web', 'search']),
  paletteStub(WEB_FETCH_URL_ACTION_KEY, 'READ_EXTERNAL', ['web', 'fetch']),
  paletteStub(WEB_SCREENSHOT_URL_ACTION_KEY, 'READ_EXTERNAL', ['web', 'screenshot']),
];

const PALETTE_ACTION_ORDER: Record<string, number> = {
  'integration.http-request': 0,
  [INTERNAL_API_CALL_ACTION_KEY]: 1,
  [WEB_SEARCH_ACTION_KEY]: 0,
  [WEB_FETCH_URL_ACTION_KEY]: 1,
  [WEB_SCREENSHOT_URL_ACTION_KEY]: 2,
};

const withPaletteStubs = (actionCatalog: ActionCatalogEntry[]): ActionCatalogEntry[] => {
  const keys = new Set(actionCatalog.map((entry) => entry.key));
  return [...actionCatalog, ...PALETTE_ALWAYS_VISIBLE_STUBS.filter((stub) => !keys.has(stub.key))];
};

const comparePaletteActions = (left: ActionCatalogEntry, right: ActionCatalogEntry): number => {
  const leftOrder = PALETTE_ACTION_ORDER[left.key] ?? 50;
  const rightOrder = PALETTE_ACTION_ORDER[right.key] ?? 50;
  return leftOrder - rightOrder || left.key.localeCompare(right.key);
};

export function groupActionsForPalette(actionCatalog: ActionCatalogEntry[], query: string): ActionCatalogGroup[] {
  const catalog = withPaletteStubs(actionCatalog);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (entry: ActionCatalogEntry) =>
    !normalizedQuery
    || entry.key.toLowerCase().includes(normalizedQuery)
    || friendlyActionLabel(entry.key).toLowerCase().includes(normalizedQuery)
    || paletteActionDescription(entry.key).toLowerCase().includes(normalizedQuery);

  const byCategory = new Map<ActionCategory, ActionCatalogEntry[]>();
  for (const entry of catalog) {
    if (!matches(entry)) continue;
    const category = actionCategoryOf(entry.key);
    if (category === 'other') continue;
    const list = byCategory.get(category) ?? [];
    list.push(entry);
    byCategory.set(category, list);
  }

  return ACTION_CATEGORY_ORDER
    .filter((category) => byCategory.has(category))
    .map((category) => ({
      category,
      label: ACTION_CATEGORY_LABELS[category],
      actions: (byCategory.get(category) ?? []).sort(comparePaletteActions),
    }));
}
