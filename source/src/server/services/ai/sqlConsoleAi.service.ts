import type { ChatMessage } from '../../../core/ai/IAiProvider';
import { aiManager } from '../../../core/ai/AiManager';
import { HttpError } from '../../errors/HttpError';
import { resolveFieldAssistChatModelId } from './fieldAssistModelResolver';
import { parseRemoteAssistResponse } from '../../../shared/lib/remoteAssist/parseRemoteAssistResponse';
import { validateExecuteDataSourceSql } from '../../../shared/lib/executeDataSourceQuery';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import type { SchemaFieldInfo } from '../../utils/dataSourceSchemaIntrospection';
import {
  SENSITIVE_COLUMN_PATTERN,
  buildScopedReferenceRowsSql,
  mapWithConcurrency,
  tokenizeIdentifier,
} from '../../utils/sqlSchemaSemantics';
import type { DataSourcesService } from '../data-sources.service';
import * as dbEnrichmentRepository from '../../domain/db-enrichment/dbEnrichmentRepository';
import type { DbEnrichmentKnowledge } from '../../../shared/api/contracts/db-enrichment';

const MAX_SNAPSHOT_CHARS = 4_000;
const MAX_HISTORY_ITEMS = 20;
const MAX_PROMPT_CHARS = 4_000;
const MAX_RESULT_PREVIEW_CHARS = 4_000;

/**
 * Below this many tables/views, every single one gets full columns embedded -
 * no ranking, no omissions, guaranteed complete recall. Configured chat models here
 * have 1M-token context windows, so this can be generous; it only falls back to
 * lexical ranking for genuinely huge schemas.
 */
const MAX_SCHEMA_OBJECTS_BEFORE_RANKING = 200;
/** Above that, how many top-scoring objects still get full columns. */
const MAX_SCHEMA_OBJECTS_WITH_COLUMNS = 80;
const MAX_COLUMNS_PER_OBJECT = 40;
/** Caps concurrent column-introspection queries against the target DB when a schema is huge. */
const SCHEMA_INTROSPECTION_CONCURRENCY = 12;

/**
 * Any table that is the *target* of a foreign key is a lookup/reference table by definition -
 * that is what a foreign key means. If it is small and none of its columns look sensitive,
 * its actual rows (not just its schema) are fetched so the model never has to guess a code's
 * real-world meaning (e.g. a status/category/gender code table). This is schema-shape driven,
 * not tied to any specific table or column name.
 */
const MAX_REFERENCE_TABLE_ROWS = 30;
const MAX_REFERENCE_EDGES_SAMPLED = 25;

const buildSqlConsoleAssistSystemPrompt = (allowWrite: boolean): string => `You are a ${allowWrite ? "read-and-write" : "read-only"} SQL assistant inside the AppEndO SQL Console.
${allowWrite
    ? 'The operator has switched this session to read-and-write mode: SELECT / WITH / PRAGMA / EXPLAIN / CALL / EXEC / INSERT / UPDATE / DELETE / MERGE statements may run, and the console runs them without asking for confirmation first. Schema-changing DDL (CREATE / DROP / ALTER / TRUNCATE / GRANT / REVOKE) is still never allowed, no matter what - the console rejects it outright.'
    : 'The operator can only ever run SELECT / WITH / PRAGMA / EXPLAIN / CALL / EXEC statements - the console rejects anything else, so never suggest INSERT, UPDATE, DELETE, MERGE, or DDL.'}
You are given the target database dialect and a summary of its schema (tables/views with columns when known). Only reference tables and columns that appear in that summary; never invent names.
Reply with a single JSON object only, no markdown:
{"text":"short explanation for the operator","commands":["exact SQL statement"]}
Rules:
- Put explanation in text. Do not repeat the SQL inside text; it is rendered as a highlighted code block.
- commands are one or more complete, ready-to-run SQL statements for the target dialect. Usually a single statement is enough.
- Do not include a trailing semicolon or SQL comments.
- Write valid syntax for the stated dialect (e.g. LIMIT vs TOP vs FETCH FIRST, quoting style).
- The schema summary includes a "Relationships" list of real foreign keys (fromTable.fromColumn -> toTable.toColumn). Use those exact keys to JOIN; do not invent a join column that is not listed as a foreign key or a matching name.
- The schema summary may include "Reference data for <table>" lines with the small lookup table's actual rows (this only happens for tables that are foreign-key targets, small, and free of sensitive-looking columns). When a request implies filtering by a category/status/code that a reference table covers, look up the real row there and use its exact stored value - do not guess it.
- For anything else, you are not shown row data, so you cannot know the exact stored spelling/case/language of a value (e.g. how "male" might be stored: 'M', 'Male', ...). When the request implies filtering by such a value and no reference data covers it, either pick the most conventional-looking value and say in text that it is a best guess, or - if a wrong guess would likely return zero rows - propose a quick SELECT DISTINCT on the relevant column/table instead, and explain that a second, more specific request can follow once the operator sees the real values.
- If the schema summary does not include a table you would need, say so in text (name the table) and return an empty commands array instead of guessing.
- If no data source is connected, say so in text and return an empty commands array.
- If the current editor already has SQL and the request is a refinement of it, build on that SQL rather than starting over.
- Never reply with only a plan or a promise to act in a later turn (e.g. "next I will...", "continuing now...", "I'll build a dashboard with several parts"). You get exactly one turn per operator message, so commands must make real progress on the request right now, in this same reply - not describe what a future reply will do. Returning an empty commands array is only correct for the specific exceptions listed above (missing table, no data source, or an ambiguous write needing clarification).
- This console only ever displays plain tabular query results - it has no charts, graphs, or interactive dashboard UI. If the operator asks for something the console literally cannot render (a "dashboard", "chart", "visualization", etc.), say that plainly and specifically in text - do not silently reinterpret it or pretend you built it - then immediately offer the closest real equivalent as one or more separate SELECT statements (data sheets) in commands, with a short note on what each one shows.
- If a request has multiple parts (e.g. several metrics at once), put one complete SELECT per part in commands instead of narrating them - the console runs and displays each one as its own data sheet.${allowWrite ? `
- Since these statements run immediately with no confirmation step: never write an UPDATE or DELETE without a WHERE clause unless the operator explicitly asked to affect every row - a missing WHERE is almost always a mistake, not intent. State plainly in text what the statement will change (which rows, roughly how many if it can be inferred) before it runs. Prefer the narrowest statement that satisfies the request. If the request is ambiguous about scope (e.g. "remove the test orders" without saying which ones), ask a clarifying question in text and return an empty commands array rather than guessing at scope for a write.` : ''}`;

type AssistHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

const normalizeHistory = (value: unknown): AssistHistoryItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: AssistHistoryItem[] = [];
  for (const entry of value.slice(-MAX_HISTORY_ITEMS)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as { role?: unknown; content?: unknown };
    if ((record.role !== 'user' && record.role !== 'assistant') || typeof record.content !== 'string') {
      continue;
    }
    const content = record.content.trim();
    if (!content) {
      continue;
    }
    items.push({ role: record.role, content });
  }
  return items;
};

const clipSnapshot = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.replace(/\0/g, '');
  if (trimmed.length <= MAX_SNAPSHOT_CHARS) {
    return trimmed;
  }
  return trimmed.slice(0, MAX_SNAPSHOT_CHARS);
};

const tokenizePrompt = (prompt: string): Set<string> => {
  const matches = prompt.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(matches);
};

const scoreObjectName = (name: string, promptTokens: Set<string>): number => {
  if (promptTokens.size === 0) {
    return 0;
  }
  let score = 0;
  for (const token of tokenizeIdentifier(name)) {
    if (token.length < 2) {
      continue;
    }
    if (promptTokens.has(token)) {
      score += 1;
      continue;
    }
    for (const promptToken of promptTokens) {
      if (promptToken.length >= 3 && (token.includes(promptToken) || promptToken.includes(token))) {
        score += 0.5;
        break;
      }
    }
  }
  return score;
};

type QueryableObject = { name: string; objectType: 'TABLE' | 'VIEW' };

const buildSchemaContext = async (
  dataSourcesService: DataSourcesService,
  dataSourceId: string,
  promptTokens: Set<string>,
): Promise<{ dialectLabel: string; schemaText: string }> => {
  const sources = dataSourcesService.list({}).body.items;
  const source = sources.find((item) => item.id === dataSourceId);
  if (!source) {
    throw new HttpError(404, 'Data source not found.');
  }

  const catalog = (await dataSourcesService.listSchemaCatalog(dataSourceId)).body.catalog;
  const queryable: QueryableObject[] = [
    ...catalog.TABLE.map((name) => ({ name, objectType: 'TABLE' as const })),
    ...catalog.VIEW.map((name) => ({ name, objectType: 'VIEW' as const })),
  ];

  let withColumns = queryable;
  let omittedNames: string[] = [];
  if (queryable.length > MAX_SCHEMA_OBJECTS_BEFORE_RANKING) {
    const ranked = queryable
      .map((item) => ({ item, score: scoreObjectName(item.name, promptTokens) }))
      .sort((left, right) => right.score - left.score);
    const top = ranked.filter((entry) => entry.score > 0).slice(0, MAX_SCHEMA_OBJECTS_WITH_COLUMNS);
    withColumns = (top.length > 0 ? top : ranked.slice(0, MAX_SCHEMA_OBJECTS_WITH_COLUMNS)).map((entry) => entry.item);
    const keep = new Set(withColumns.map((item) => `${item.objectType}:${item.name}`));
    omittedNames = queryable
      .filter((item) => !keep.has(`${item.objectType}:${item.name}`))
      .map((item) => item.name);
  }

  const [fieldEntries, relationLists] = await Promise.all([
    mapWithConcurrency(withColumns, SCHEMA_INTROSPECTION_CONCURRENCY, async (item) => {
      try {
        const fields = (await dataSourcesService.listObjectFields(dataSourceId, item.objectType, item.name)).body.items;
        return { item, fields };
      } catch {
        return { item, fields: [] as SchemaFieldInfo[] };
      }
    }),
    mapWithConcurrency(withColumns, SCHEMA_INTROSPECTION_CONCURRENCY, async (item) => {
      try {
        return (await dataSourcesService.listObjectRelations(dataSourceId, item.objectType, item.name)).body.data.relations;
      } catch {
        return [] as SchemaRelationEdge[];
      }
    }),
  ]);

  // Enrichment knowledge is a higher-trust layer in front of bare structure: when present at
  // decent confidence, its one-line "meaning" rides along the plain name:type column entry.
  // Structure (columns/types/PK) always still comes from live introspection above - enrichment
  // is never the source of truth for structure, only for meaning, so schema drift can't go stale.
  const MIN_KNOWLEDGE_CONFIDENCE = 0.7;
  const knowledgeList = await dbEnrichmentRepository.listKnowledgeForDataSource(dataSourceId).catch((): DbEnrichmentKnowledge[] => []);
  const knowledgeByObject = new Map(knowledgeList.map((entry) => [`${entry.objectType}:${entry.objectName}`, entry]));

  const lines = fieldEntries.map(({ item, fields }) => {
    const knowledge = knowledgeByObject.get(`${item.objectType}:${item.name}`);
    const columnMeaningByName = new Map((knowledge?.columns ?? [])
      .filter((column) => column.confidence >= MIN_KNOWLEDGE_CONFIDENCE && column.meaning)
      .map((column) => [column.columnName, column.meaning]));

    const columns = fields
      .slice(0, MAX_COLUMNS_PER_OBJECT)
      .map((field) => {
        const base = `${field.name}${field.isPrimaryKey ? ' PK' : ''}:${field.dataType}`;
        const meaning = columnMeaningByName.get(field.name);
        return meaning ? `${base} — ${meaning}` : base;
      })
      .join(', ');
    const purpose = knowledge?.tableConfidence !== null
      && knowledge?.tableConfidence !== undefined
      && knowledge.tableConfidence >= MIN_KNOWLEDGE_CONFIDENCE
      && knowledge.tablePurpose
      ? ` — ${knowledge.tablePurpose}`
      : '';
    return columns ? `${item.objectType} ${item.name}${purpose} (${columns})` : `${item.objectType} ${item.name}${purpose}`;
  });

  const uniqueRelations = new Map<string, SchemaRelationEdge>();
  for (const edges of relationLists) {
    for (const edge of edges) {
      uniqueRelations.set(`${edge.fromTable}.${edge.fromColumn}->${edge.toTable}.${edge.toColumn}`, edge);
    }
  }
  if (uniqueRelations.size > 0) {
    lines.push(`Relationships (foreign keys, use these exact columns to JOIN): ${[...uniqueRelations.keys()].sort().join('; ')}`);
  }

  const fieldsByTableName = new Map(fieldEntries.map(({ item, fields }) => [item.name, fields]));

  const referenceEdgeCandidates = [...uniqueRelations.values()]
    .filter((edge) => {
      const targetFields = fieldsByTableName.get(edge.toTable);
      return Boolean(targetFields?.length) && !targetFields!.some((field) => SENSITIVE_COLUMN_PATTERN.test(field.name));
    })
    .slice(0, MAX_REFERENCE_EDGES_SAMPLED);

  const referenceDataLines = (await mapWithConcurrency(referenceEdgeCandidates, SCHEMA_INTROSPECTION_CONCURRENCY, async (edge) => {
    // Enrichment already resolved this exact FK column's values with a real value glossary -
    // skip the live sampling round trip entirely and use the stored answer.
    const sourceKnowledge = knowledgeByObject.get(`TABLE:${edge.fromTable}`) ?? knowledgeByObject.get(`VIEW:${edge.fromTable}`);
    const sourceColumnKnowledge = sourceKnowledge?.columns.find((column) => column.columnName === edge.fromColumn);
    if (
      sourceColumnKnowledge
      && sourceColumnKnowledge.confidence >= 0.7
      && sourceColumnKnowledge.valueGlossary?.length
    ) {
      return `Reference data for ${edge.toTable} (values used by ${edge.fromTable}.${edge.fromColumn}, from DB Enricher, use these exact stored values, do not guess): ${JSON.stringify(sourceColumnKnowledge.valueGlossary)}`;
    }

    const sampleSql = buildScopedReferenceRowsSql(source.type, edge, MAX_REFERENCE_TABLE_ROWS + 1);
    if (!sampleSql) {
      return null;
    }
    try {
      const rows = (await dataSourcesService.executeDataSourceQuery({ dataSourceId, sql: sampleSql })).body.data;
      if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_REFERENCE_TABLE_ROWS) {
        return null;
      }
      return `Reference data for ${edge.toTable} (values used by ${edge.fromTable}.${edge.fromColumn}, use these exact stored values, do not guess): ${JSON.stringify(rows)}`;
    } catch {
      return null;
    }
  })).filter((line): line is string => line !== null);

  lines.push(...referenceDataLines);

  if (omittedNames.length > 0) {
    lines.push(`Other tables/views without columns shown here - mention one by name if you need it: ${omittedNames.join(', ')}`);
  }
  if (catalog.PROCEDURE.length > 0) {
    lines.push(`Procedures: ${catalog.PROCEDURE.join(', ')}`);
  }
  if (catalog.FUNCTION.length > 0) {
    lines.push(`Functions: ${catalog.FUNCTION.join(', ')}`);
  }

  return {
    dialectLabel: source.type,
    schemaText: lines.join('\n') || '(no tables or views found)',
  };
};

export class SqlConsoleAiService {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  async assist(params: {
    prompt: unknown;
    dataSourceId?: unknown;
    sqlSnapshot?: unknown;
    previousResultPreview?: unknown;
    allowWrite?: unknown;
    modelId?: unknown;
    history?: unknown;
  }) {
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) {
      throw new HttpError(400, 'prompt is required.');
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new HttpError(400, `prompt exceeds ${MAX_PROMPT_CHARS} characters.`);
    }

    const settings = aiManager.getSettings();
    if (!settings?.enabled) {
      throw new HttpError(503, 'AI is disabled in platform settings.');
    }

    const requestedModelId = typeof params.modelId === 'string' ? params.modelId.trim() : '';
    const modelId = resolveFieldAssistChatModelId(settings, requestedModelId || undefined);
    if (!modelId) {
      throw new HttpError(400, 'No chat-capable AI model is configured.');
    }

    const dataSourceId = typeof params.dataSourceId === 'string' ? params.dataSourceId.trim() : '';
    const allowWrite = params.allowWrite === true;
    const promptTokens = tokenizePrompt(prompt);

    const previousResultPreview = clipSnapshot(params.previousResultPreview).slice(0, MAX_RESULT_PREVIEW_CHARS);

    const contentSections = ['Operator request:', prompt];
    if (previousResultPreview) {
      contentSections.unshift(
        'Result of the most recent query the operator ran (use these real values, do not re-guess them):',
        '```',
        previousResultPreview,
        '```',
        '',
      );
    }
    if (dataSourceId) {
      const { dialectLabel, schemaText } = await buildSchemaContext(this.dataSourcesService, dataSourceId, promptTokens);
      contentSections.unshift(
        'Current editor SQL:',
        '```sql',
        clipSnapshot(params.sqlSnapshot) || '(empty)',
        '```',
        '',
      );
      contentSections.unshift(
        `Target database dialect: ${dialectLabel}`,
        'Schema summary:',
        schemaText,
        '',
      );
    } else {
      contentSections.unshift('No data source is connected for this query tab.', '');
    }

    const history = normalizeHistory(params.history);
    const messages: ChatMessage[] = [
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: 'user', content: contentSections.join('\n') },
    ];

    const raw = await aiManager.processChat(messages, modelId, buildSqlConsoleAssistSystemPrompt(allowWrite));
    const parsed = parseRemoteAssistResponse(raw);

    const validCommands = parsed.commands.filter((command) => validateExecuteDataSourceSql(command, { allowWrite }).ok);
    const droppedCount = parsed.commands.length - validCommands.length;
    const text = droppedCount > 0 && validCommands.length === 0
      ? [parsed.text, 'The suggested SQL was not a read-only statement, so it was withheld.'].filter(Boolean).join('\n\n')
      : parsed.text;

    return {
      body: {
        text,
        commands: validCommands,
        modelId,
      },
    };
  }
}
