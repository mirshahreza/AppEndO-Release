import { aiManager } from '../../../core/ai/AiManager';
import { HttpError } from '../../errors/HttpError';
import { resolveFieldAssistChatModelId } from '../ai/fieldAssistModelResolver';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import type { SchemaFieldInfo } from '../../utils/dataSourceSchemaIntrospection';
import {
  SENSITIVE_COLUMN_PATTERN,
  buildFrequentValuesSql,
  buildScopedReferenceRowsSql,
  mapWithConcurrency,
  tokenizeIdentifier,
} from '../../utils/sqlSchemaSemantics';
import type { DataSourcesService } from '../data-sources.service';
import { getEdgeModelStudioMetaBySchemaKey } from '../data-api/edgeModelStudioMetaStore';
import { readModelStoryFromExtensions } from '../../../shared/lib/edgeModelStory';
import { dispatchNotificationForRole } from '../notifications/notificationDispatch';
import {
  DB_ENRICHMENT_CONFIDENCE_BY_BASIS,
  type DbEnrichmentColumnKnowledge,
  type DbEnrichmentConfidenceBasis,
  type DbEnrichmentQuestion,
  type DbEnrichmentRelationKnowledge,
} from '../../../shared/api/contracts/db-enrichment';
import type { DbEnrichmentJobEnvelope } from '../../domain/jobs/jobTypes';
import * as dbEnrichmentRepository from '../../domain/db-enrichment/dbEnrichmentRepository';

/**
 * Cap on distinct values fetched for a non-FK candidate column before treating it as "too big to
 * glossary". Local inference has no per-token cost, so this is generous - more sample evidence
 * measurably helps a weaker model's value-glossary guesses.
 */
const MAX_DISTINCT_VALUES = 40;
/** How many tables get their per-table LLM call in flight at once. */
const ENRICHMENT_LLM_CONCURRENCY = 3;
/**
 * Columns needing the LLM's help are chunked into calls this size (never dropped past a cap
 * like the old fixed-60 limit did). Smaller batches keep column-tracking reliable on weaker
 * (e.g. local) models that lose track of long lists.
 */
const LLM_COLUMN_BATCH_SIZE = 10;
/**
 * Each batch is asked twice, independently. Disagreement between the two runs (on whether a
 * column is ambiguous) is itself evidence the answer isn't confident enough to trust - this
 * substitutes for weaker models' unreliable self-reported confidence.
 */
const SELF_CONSISTENCY_PASSES = 2;
/** Confidence multiplier applied when a column only resolved after a tie-break pass (2-of-3), not on immediate unanimous agreement. */
const TIE_BREAK_CONFIDENCE_DISCOUNT = 0.9;
/** Cross-table context only reuses knowledge at least this confident, so a low-confidence guess never gets echoed into another table as if it were settled. */
const CROSS_TABLE_CONTEXT_MIN_CONFIDENCE = 0.7;

const SELF_DESCRIBING_TYPE_PATTERN = /bool|date|time|timestamp/i;
const SELF_DESCRIBING_NAME_TOKENS = new Set([
  'id', 'name', 'title', 'label', 'description', 'desc', 'date', 'time', 'created', 'updated', 'deleted',
  'at', 'by', 'amount', 'price', 'cost', 'total', 'count', 'quantity', 'qty', 'url', 'link', 'email',
  'phone', 'address', 'active', 'enabled', 'disabled', 'order', 'sort', 'position', 'index',
  'kind', 'value', 'flag', 'is', 'has', 'can', 'should', 'year', 'month', 'day',
  'first', 'last', 'full', 'username', 'password', 'token', 'note', 'notes', 'comment', 'file', 'path',
  'image', 'photo', 'icon', 'color', 'size', 'width', 'height', 'latitude', 'longitude', 'lat', 'lng', 'lon',
]);

const isSelfDescribing = (field: SchemaFieldInfo): boolean => {
  if (SELF_DESCRIBING_TYPE_PATTERN.test(field.dataType)) {
    return true;
  }
  return tokenizeIdentifier(field.name).some((token) => SELF_DESCRIBING_NAME_TOKENS.has(token));
};

type GroundTruth = {
  columnNotes: Map<string, string>;
  tablePurpose: string | null;
};

const resolveGroundTruth = (dataSourceId: string, objectType: 'TABLE' | 'VIEW', objectName: string): GroundTruth => {
  const meta = getEdgeModelStudioMetaBySchemaKey({ dataSourceId, objectType, objectName });
  const columnNotes = new Map<string, string>();
  if (meta) {
    for (const column of meta.columnMeta) {
      const note = column.developerNotes?.trim() || column.interfaceNotes?.trim() || column.displayLabel?.trim();
      if (note) {
        columnNotes.set(column.columnName, note);
      }
    }
  }
  const story = meta ? readModelStoryFromExtensions(meta.extensions) : '';
  return { columnNotes, tablePurpose: story || null };
};

const DB_ENRICHMENT_SYSTEM_PROMPT = `You are a database documentation assistant helping build a schema knowledge base.
You will be given one table's structure, its relationships, and - for some columns - real sample data.

For each column, think it through first: consider the column name, its data type, any relationship, and any sample values, then decide whether you can confidently state its real-world meaning.

Reply with a single JSON object only, no markdown:
{"tablePurpose":"one sentence describing what this table is for","columns":[{"columnName":"...","reasoning":"one short sentence of your reasoning","meaning":"one short sentence","valueGlossary":[{"value":"...","meaning":"..."}],"ambiguous":false,"ambiguityReason":"..."}]}

Rules:
- Only include entries for the columns explicitly listed as "Columns needing your help" - never for columns only shown for context.
- valueGlossary is optional: include it only when you were given real sample values for that column, and only map values that were actually shown to you - never invent values.
- Set ambiguous:true, with a one-sentence ambiguityReason, when ANY of the following apply - do not guess past these rules:
  - No sample data was given for the column and its name alone does not make the meaning reasonably clear.
  - Sample values were given but there were fewer than 2 distinct values, or the values are opaque codes/numbers with no textual or contextual hint to their meaning.
  - The column name is generic (e.g. "type", "status", "flag", "code") and the given context is not enough to be sure which specific meaning applies.
  - You are not at least 80% confident in the meaning you would otherwise state.
- Otherwise set ambiguous:false.
- Keep every meaning and every reasoning to one short sentence.

A non-FK column's sample, when shown, lists its most frequent values as "value×count" (e.g. "1×8000, 2×150"), with a note on whether that's the complete set of distinct values or just the most common ones among more.

Example:
Input: "Table: orders (TABLE)\\nAll columns: id PK:int, customer_id:int, status:int, created_at:datetime\\nColumns needing your help (with any sample data available):\\n- status (int): [1×450, 2×12, 3×3] (complete set of distinct values)"
Output: {"tablePurpose":"Stores customer purchase orders.","columns":[{"columnName":"status","reasoning":"status is a generic name and only raw integer codes were shown with no labels, so the specific meaning of each code cannot be determined.","meaning":"","ambiguous":true,"ambiguityReason":"Only opaque integer codes were sampled with no labels indicating what each value represents."}]}`;

type LlmColumnResult = {
  columnName?: unknown;
  meaning?: unknown;
  valueGlossary?: unknown;
  ambiguous?: unknown;
  ambiguityReason?: unknown;
};

type LlmTableResult = {
  tablePurpose?: unknown;
  columns?: unknown;
};

const parseLlmTableResult = (raw: string): LlmTableResult => {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return {};
    }
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? parsed as LlmTableResult : {};
  } catch {
    return {};
  }
};

type FrequentValueRow = { value: unknown; frequency: unknown };

type CandidateColumn = {
  field: SchemaFieldInfo;
  /** Set when this column is a foreign key and its target table's values were sampled. */
  fkGlossarySample?: unknown[];
  fkTargetTable?: string;
  /** Set when a non-FK column's most frequent values were sampled directly, each with its row count. */
  distinctValueSample?: FrequentValueRow[];
  /** True when distinctValueSample was capped - more distinct values exist beyond the ones shown. */
  distinctValueSampleTruncated?: boolean;
};

/** Renders one candidate's sample for the prompt: FK rows as-is, frequent-value samples as "value×count" with a completeness note. */
const formatCandidateSample = (candidate: CandidateColumn): string => {
  if (candidate.fkGlossarySample) {
    return JSON.stringify(candidate.fkGlossarySample);
  }
  if (candidate.distinctValueSample) {
    const formatted = candidate.distinctValueSample
      .map((row) => `${JSON.stringify(row.value)}×${row.frequency}`)
      .join(', ');
    const coverage = candidate.distinctValueSampleTruncated
      ? 'showing only the most frequent values - more distinct values exist beyond these'
      : 'complete set of distinct values';
    return `[${formatted}] (${coverage})`;
  }
  return '(no sample available)';
};

const averageConfidence = (columns: DbEnrichmentColumnKnowledge[]): number | null => {
  if (columns.length === 0) {
    return null;
  }
  const sum = columns.reduce((total, column) => total + column.confidence, 0);
  return sum / columns.length;
};

const mapRelationsKnowledge = (edges: SchemaRelationEdge[]): DbEnrichmentRelationKnowledge[] => (
  edges.map((edge) => ({
    fromColumn: edge.fromColumn,
    toTable: edge.toTable,
    toColumn: edge.toColumn,
    intent: `references ${edge.toTable}.${edge.toColumn}`,
    confidence: DB_ENRICHMENT_CONFIDENCE_BY_BASIS.fk_lookup_sampled,
  }))
);

/**
 * One LLM call for a batch, with a single corrective retry if the response isn't valid JSON
 * with a non-empty "columns" array - local models occasionally wrap JSON in prose or drop the
 * array entirely, and a cheap self-correction round recovers most of those for free.
 */
const callEnrichmentModel = async (modelId: string, userContent: string): Promise<LlmTableResult> => {
  const firstRaw = await aiManager.processChat([{ role: 'user', content: userContent }], modelId, DB_ENRICHMENT_SYSTEM_PROMPT);
  const firstParsed = parseLlmTableResult(firstRaw);
  if (Array.isArray(firstParsed.columns) && firstParsed.columns.length > 0) {
    return firstParsed;
  }

  const retryRaw = await aiManager.processChat(
    [
      { role: 'user', content: userContent },
      { role: 'assistant', content: firstRaw },
      {
        role: 'user',
        content: 'That response was not a valid JSON object matching the required schema, or its "columns" array was empty. Reply again with ONLY the JSON object described in the system instructions, nothing else.',
      },
    ],
    modelId,
    DB_ENRICHMENT_SYSTEM_PROMPT,
  );
  return parseLlmTableResult(retryRaw);
};

type ColumnVote = {
  ambiguous: boolean;
  meaning: string;
  ambiguityReason?: string;
  valueGlossary?: Array<{ value: string; meaning: string }>;
  /** True once reconciled, when the column only resolved via the tie-break pass rather than immediate unanimous agreement. */
  resolvedViaTieBreak?: boolean;
};

const toColumnVote = (entry: LlmColumnResult | undefined): ColumnVote => {
  if (!entry) {
    return { ambiguous: true, meaning: '' };
  }
  return {
    ambiguous: entry.ambiguous === true,
    meaning: typeof entry.meaning === 'string' ? entry.meaning : '',
    ambiguityReason: typeof entry.ambiguityReason === 'string' ? entry.ambiguityReason.trim() || undefined : undefined,
    valueGlossary: Array.isArray(entry.valueGlossary)
      ? (entry.valueGlossary as Array<{ value?: unknown; meaning?: unknown }>)
        .filter((item) => typeof item.value !== 'undefined' && typeof item.meaning === 'string')
        .map((item) => ({ value: String(item.value), meaning: String(item.meaning) }))
      : undefined,
  };
};

const findColumnEntry = (pass: LlmTableResult, columnName: string): LlmColumnResult | undefined => (
  Array.isArray(pass.columns)
    ? (pass.columns as LlmColumnResult[]).find((column) => (
      column && typeof column === 'object' && column.columnName === columnName
    ))
    : undefined
);

const extractTablePurpose = (passes: LlmTableResult[]): string | undefined => {
  for (const pass of passes) {
    if (typeof pass.tablePurpose === 'string' && pass.tablePurpose.trim()) {
      return pass.tablePurpose.trim();
    }
  }
  return undefined;
};

/** Minimum word-overlap (Jaccard, over words longer than 2 chars) for two "not ambiguous" meanings to count as the same answer. */
const MEANING_AGREEMENT_THRESHOLD = 0.3;

const tokenizeMeaning = (text: string): Set<string> => (
  new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2))
);

/**
 * Two "not ambiguous" votes can still describe genuinely different things (e.g. one says "the
 * user's account status", the other "the subscription tier") - agreeing on the ambiguous flag
 * alone doesn't mean they agree on the answer. This is a cheap word-overlap proxy for that,
 * not real semantic similarity, but it's enough to catch outright divergent answers.
 */
const meaningsAgree = (a: string, b: string): boolean => {
  const tokensA = tokenizeMeaning(a);
  const tokensB = tokenizeMeaning(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return tokensA.size === tokensB.size;
  }
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union >= MEANING_AGREEMENT_THRESHOLD;
};

/** Largest group of votes whose meanings all agree with a common anchor vote (N is small - at most 3 - so this stays O(n^2)). */
const largestAgreeingCluster = (votes: ColumnVote[]): ColumnVote[] => {
  let best: ColumnVote[] = votes.slice(0, 1);
  for (const anchor of votes) {
    const cluster = votes.filter((vote) => meaningsAgree(anchor.meaning, vote.meaning));
    if (cluster.length > best.length) {
      best = cluster;
    }
  }
  return best;
};

/**
 * Votes can agree on the meaning text yet still map the same sampled value to different labels
 * (e.g. one vote says value "1" means "Male", another says "1" means "Active") - a real
 * disagreement that plain meaning-text comparison can't see. Only compares values that both
 * votes actually mapped, so a vote that simply glossed fewer values isn't treated as conflicting.
 */
const hasConflictingValueGlossary = (votes: ColumnVote[]): boolean => {
  const withGlossary = votes.filter((vote) => vote.valueGlossary && vote.valueGlossary.length > 0);
  for (let i = 0; i < withGlossary.length; i += 1) {
    for (let j = i + 1; j < withGlossary.length; j += 1) {
      for (const entry of withGlossary[i].valueGlossary!) {
        const match = withGlossary[j].valueGlossary!.find((candidate) => candidate.value === entry.value);
        if (match && !meaningsAgree(entry.meaning, match.meaning)) {
          return true;
        }
      }
    }
  }
  return false;
};

/** Reconciles N independent votes for one column into a single answer: a "not ambiguous" cluster that agrees on both the meaning and any value-glossary labels needs a strict majority. */
const reconcileColumnVotes = (votes: ColumnVote[]): ColumnVote => {
  const notAmbiguousVotes = votes.filter((vote) => !vote.ambiguous);
  const bestCluster = largestAgreeingCluster(notAmbiguousVotes);
  const isMajority = bestCluster.length > votes.length / 2;
  const valueConflict = isMajority && hasConflictingValueGlossary(bestCluster);

  if (isMajority && !valueConflict) {
    return { ...bestCluster[0], resolvedViaTieBreak: votes.length > SELF_CONSISTENCY_PASSES };
  }

  const allAmbiguous = notAmbiguousVotes.length === 0;
  const semanticDisagreement = !allAmbiguous && notAmbiguousVotes.length > 1 && bestCluster.length <= 1;
  const reasoned = votes.find((vote) => vote.ambiguityReason);
  return {
    ambiguous: true,
    meaning: bestCluster[0]?.meaning ?? '',
    ambiguityReason: valueConflict
      ? 'The agreed-upon meaning is consistent, but the sampled values were mapped to conflicting labels across attempts, so it needs human confirmation.'
      : allAmbiguous
        ? (reasoned?.ambiguityReason ?? 'The assistant could not confidently determine this column\'s meaning.')
        : semanticDisagreement
          ? 'Repeated attempts to determine this column\'s meaning produced different, disagreeing answers, so it needs human confirmation.'
          : 'Repeated attempts to determine this column\'s meaning did not agree with each other, so it needs human confirmation.',
    valueGlossary: reasoned?.valueGlossary ?? votes.find((vote) => vote.valueGlossary)?.valueGlossary,
  };
};

/**
 * A column is "tied" when the passes split on the ambiguous flag, when they all say "not
 * ambiguous" but describe different things, or when they agree on the meaning but conflict on
 * value-glossary labels - all three are worth one extra tie-breaking call before falling back
 * to ambiguous.
 */
const isTied = (votes: ColumnVote[]): boolean => {
  const notAmbiguousVotes = votes.filter((vote) => !vote.ambiguous);
  if (notAmbiguousVotes.length === 0 || notAmbiguousVotes.length === votes.length) {
    if (notAmbiguousVotes.length <= 1) {
      return false;
    }
    const cluster = largestAgreeingCluster(notAmbiguousVotes);
    return cluster.length < notAmbiguousVotes.length || hasConflictingValueGlossary(cluster);
  }
  return true;
};

/**
 * Runs one column batch through SELF_CONSISTENCY_PASSES independent LLM calls and reconciles the
 * results per column. Columns where those passes disagree get one extra tie-breaking call (shared
 * across all tied columns in the batch, not one call per column) before falling back to ambiguous.
 */
const resolveColumnBatch = async (
  modelId: string,
  dialectLabel: string,
  item: { objectType: 'TABLE' | 'VIEW'; name: string },
  allColumnsLine: string,
  relationsLine: string,
  knownColumnsContext: string,
  crossTableContext: string,
  batch: CandidateColumn[],
): Promise<{ tablePurpose?: string; results: Map<string, ColumnVote> }> => {
  const candidateLines = batch.map((candidate) => (
    `- ${candidate.field.name} (${candidate.field.dataType}): ${formatCandidateSample(candidate)}`
  )).join('\n');

  const userContent = [
    `Dialect: ${dialectLabel}`,
    `Table: ${item.name} (${item.objectType})`,
    `All columns: ${allColumnsLine}`,
    `Outgoing relationships from this table: ${relationsLine}`,
    `Already-known meanings of other columns in this table, for context only - do not repeat these in your answer: ${knownColumnsContext || '(none yet)'}`,
    `Meanings already resolved for same-named columns elsewhere in this data source, for reference only - this table's own context takes precedence: ${crossTableContext || '(none)'}`,
    'Columns needing your help (with any sample data available):',
    candidateLines,
  ].join('\n');

  const initialPasses = await Promise.all(
    Array.from({ length: SELF_CONSISTENCY_PASSES }, () => callEnrichmentModel(modelId, userContent)),
  );

  let tablePurpose = extractTablePurpose(initialPasses);

  const voteMap = new Map<string, ColumnVote[]>();
  for (const candidate of batch) {
    const columnName = candidate.field.name;
    voteMap.set(columnName, initialPasses.map((pass) => toColumnVote(findColumnEntry(pass, columnName))));
  }

  const tiedColumns = batch.filter((candidate) => isTied(voteMap.get(candidate.field.name)!));
  if (tiedColumns.length > 0) {
    const tieBreakPass = await callEnrichmentModel(modelId, userContent);
    if (!tablePurpose) {
      tablePurpose = extractTablePurpose([tieBreakPass]);
    }
    for (const candidate of tiedColumns) {
      const columnName = candidate.field.name;
      voteMap.get(columnName)!.push(toColumnVote(findColumnEntry(tieBreakPass, columnName)));
    }
  }

  const results = new Map<string, ColumnVote>();
  for (const candidate of batch) {
    results.set(candidate.field.name, reconcileColumnVotes(voteMap.get(candidate.field.name)!));
  }

  return { tablePurpose, results };
};

type EnrichTableResult = {
  columnsResolved: number;
  columnsAmbiguous: number;
  questionsCreated: number;
};

type EnrichmentEmit = (message: string) => Promise<void>;

const enrichTable = async (
  dataSourcesService: DataSourcesService,
  dialectLabel: string,
  dataSourceId: string,
  runId: number,
  modelId: string,
  item: { objectType: 'TABLE' | 'VIEW'; name: string },
  emit?: EnrichmentEmit,
): Promise<EnrichTableResult> => {
  const fields = (await dataSourcesService.listObjectFields(dataSourceId, item.objectType, item.name)).body.items;
  const relations = (await dataSourcesService.listObjectRelations(dataSourceId, item.objectType, item.name)).body.data.relations;
  const outgoingEdges = relations.filter((edge) => edge.fromTable === item.name);
  const groundTruth = resolveGroundTruth(dataSourceId, item.objectType, item.name);
  const outgoingEdgeByColumn = new Map(outgoingEdges.map((edge) => [edge.fromColumn, edge]));

  const resolvedColumns: DbEnrichmentColumnKnowledge[] = [];
  const candidates: CandidateColumn[] = [];

  for (const field of fields) {
    if (field.isPrimaryKey) {
      continue;
    }
    const humanNote = groundTruth.columnNotes.get(field.name);
    if (humanNote) {
      resolvedColumns.push({
        columnName: field.name,
        meaning: humanNote,
        confidence: DB_ENRICHMENT_CONFIDENCE_BY_BASIS.human_authored,
        confidenceBasis: 'human_authored',
      });
      continue;
    }
    const edge = outgoingEdgeByColumn.get(field.name);
    if (edge) {
      candidates.push({ field, fkTargetTable: edge.toTable });
      continue;
    }
    if (isSelfDescribing(field)) {
      continue;
    }
    candidates.push({ field });
  }

  if (candidates.length === 0) {
    await dbEnrichmentRepository.upsertKnowledge({
      dataSourceId,
      objectType: item.objectType,
      objectName: item.name,
      tablePurpose: groundTruth.tablePurpose,
      tableConfidence: averageConfidence(resolvedColumns),
      columns: resolvedColumns,
      relations: mapRelationsKnowledge(outgoingEdges),
      sourceOfTruth: resolvedColumns.length > 0 ? 'HUMAN' : 'INFERRED',
      lastEnrichedRunId: runId,
    });
    return { columnsResolved: resolvedColumns.length, columnsAmbiguous: 0, questionsCreated: 0 };
  }

  const sampled = await mapWithConcurrency(candidates, ENRICHMENT_LLM_CONCURRENCY, async (candidate) => {
    if (SENSITIVE_COLUMN_PATTERN.test(candidate.field.name)) {
      return candidate;
    }
    if (candidate.fkTargetTable) {
      try {
        const targetFields = (await dataSourcesService.listObjectFields(dataSourceId, 'TABLE', candidate.fkTargetTable)).body.items;
        if (targetFields.length === 0 || targetFields.some((field) => SENSITIVE_COLUMN_PATTERN.test(field.name))) {
          return candidate;
        }
        const edge = outgoingEdgeByColumn.get(candidate.field.name)!;
        const sql = buildScopedReferenceRowsSql(dialectLabel, edge, MAX_DISTINCT_VALUES + 1);
        if (!sql) return candidate;
        const rows = (await dataSourcesService.executeDataSourceQuery({ dataSourceId, sql })).body.data;
        if (Array.isArray(rows) && rows.length > 0 && rows.length <= MAX_DISTINCT_VALUES) {
          return { ...candidate, fkGlossarySample: rows };
        }
      } catch {
        // fall through with no sample
      }
      return candidate;
    }

    try {
      const sql = buildFrequentValuesSql(dialectLabel, item.name, candidate.field.name, MAX_DISTINCT_VALUES + 1);
      if (!sql) return candidate;
      const rows = (await dataSourcesService.executeDataSourceQuery({ dataSourceId, sql })).body.data;
      if (Array.isArray(rows) && rows.length > 0) {
        // Ordered by frequency, so even a capped sample keeps the dominant values - no more
        // all-or-nothing cutoff for high-cardinality columns like the old plain-DISTINCT sample had.
        const truncated = rows.length > MAX_DISTINCT_VALUES;
        return {
          ...candidate,
          distinctValueSample: (truncated ? rows.slice(0, MAX_DISTINCT_VALUES) : rows) as FrequentValueRow[],
          distinctValueSampleTruncated: truncated,
        };
      }
    } catch {
      // fall through with no sample
    }
    return candidate;
  });

  const undiscoverable = sampled.filter((candidate) => (
    !candidate.fkTargetTable && !candidate.fkGlossarySample && !candidate.distinctValueSample
  ));
  const llmCandidates = sampled.filter((candidate) => !undiscoverable.includes(candidate));

  let questionsCreated = 0;
  for (const candidate of undiscoverable) {
    await dbEnrichmentRepository.createQuestion({
      dataSourceId,
      runId,
      objectType: item.objectType,
      objectName: item.name,
      columnName: candidate.field.name,
      kind: 'value_glossary',
      question: `What does the "${candidate.field.name}" column on "${item.name}" mean, and what do its values represent?`,
      reason: ['No foreign key found for this column.', 'Distinct-value sample was empty or too large to summarize (or the column looks sensitive).'],
    });
    resolvedColumns.push({
      columnName: candidate.field.name,
      meaning: '',
      confidence: DB_ENRICHMENT_CONFIDENCE_BY_BASIS.unresolved,
      confidenceBasis: 'unresolved',
    });
    questionsCreated += 1;
  }

  let tablePurpose = groundTruth.tablePurpose;

  if (llmCandidates.length > 0) {
    const allColumnsLine = fields.map((field) => `${field.name}${field.isPrimaryKey ? ' PK' : ''}:${field.dataType}`).join(', ');

    // Fetched once per table (not per batch): other tables' already-resolved knowledge, used both
    // to enrich the FK relationship line with the target column's meaning, and as cross-table
    // reference context for same-named columns below.
    const otherTablesKnowledge = (await dbEnrichmentRepository.listKnowledgeForDataSource(dataSourceId)).filter((entry) => (
      !(entry.objectName === item.name && entry.objectType === item.objectType)
    ));
    const findKnownColumn = (objectType: 'TABLE' | 'VIEW', objectName: string, columnName: string) => (
      otherTablesKnowledge
        .find((entry) => entry.objectType === objectType && entry.objectName === objectName)
        ?.columns.find((column) => (
          column.columnName === columnName && column.meaning && column.confidence >= CROSS_TABLE_CONTEXT_MIN_CONFIDENCE
        ))
    );

    const relationsLine = outgoingEdges.length > 0
      ? outgoingEdges.map((edge) => {
        const targetMeaning = findKnownColumn('TABLE', edge.toTable, edge.toColumn)?.meaning;
        const base = `${edge.fromColumn} -> ${edge.toTable}.${edge.toColumn}`;
        return targetMeaning ? `${base} (${targetMeaning})` : base;
      }).join('; ')
      : '(none)';

    const candidateNames = new Set(llmCandidates.map((candidate) => candidate.field.name));
    const crossTableContext = Array.from(new Map(
      otherTablesKnowledge
        .flatMap((entry) => entry.columns)
        .filter((column) => (
          candidateNames.has(column.columnName) && column.meaning && column.confidence >= CROSS_TABLE_CONTEXT_MIN_CONFIDENCE
        ))
        .map((column) => [column.columnName, column.meaning] as const),
    ).entries()).map(([columnName, meaning]) => `${columnName}: ${meaning}`).join('; ');

    /** Meanings already known for this table (human-authored + earlier batches), given as grounding context for later batches. */
    const buildKnownColumnsContext = (): string => (
      resolvedColumns
        .filter((column) => column.meaning && column.confidenceBasis !== 'unresolved')
        .map((column) => `${column.columnName}: ${column.meaning}`)
        .join('; ')
    );

    // Shrinks (never grows back) whenever a batch fails outright and has to split - so once this
    // table/model combination shows it can't handle LLM_COLUMN_BATCH_SIZE columns at once, later
    // top-level batches start smaller instead of re-discovering the same failure every time.
    let currentBatchSize = LLM_COLUMN_BATCH_SIZE;

    const processBatch = async (batch: CandidateColumn[]): Promise<void> => {
      try {
        const { tablePurpose: batchTablePurpose, results } = await resolveColumnBatch(
          modelId,
          dialectLabel,
          item,
          allColumnsLine,
          relationsLine,
          buildKnownColumnsContext(),
          crossTableContext,
          batch,
        );
        if (batchTablePurpose && !tablePurpose) {
          tablePurpose = batchTablePurpose;
        }

        for (const candidate of batch) {
          const columnName = candidate.field.name;
          const vote = results.get(columnName);
          const hadSample = Boolean(candidate.fkGlossarySample ?? candidate.distinctValueSample);

          if (!vote || vote.ambiguous) {
            await dbEnrichmentRepository.createQuestion({
              dataSourceId,
              runId,
              objectType: item.objectType,
              objectName: item.name,
              columnName,
              kind: 'column_meaning',
              question: `What does the "${columnName}" column on "${item.name}" represent?`,
              reason: [vote?.ambiguityReason ?? 'The assistant could not confidently determine this column\'s meaning.'],
              candidates: vote?.valueGlossary?.map((entry) => entry.meaning).filter(Boolean),
            });
            resolvedColumns.push({
              columnName,
              meaning: vote?.meaning ?? '',
              confidence: DB_ENRICHMENT_CONFIDENCE_BY_BASIS.unresolved,
              confidenceBasis: 'unresolved',
            });
            questionsCreated += 1;
            continue;
          }

          const basis: DbEnrichmentConfidenceBasis = candidate.fkGlossarySample
            ? 'fk_lookup_sampled'
            : hadSample
              ? 'value_sampled'
              : 'name_pattern_only';
          const confidence = vote.resolvedViaTieBreak
            ? DB_ENRICHMENT_CONFIDENCE_BY_BASIS[basis] * TIE_BREAK_CONFIDENCE_DISCOUNT
            : DB_ENRICHMENT_CONFIDENCE_BY_BASIS[basis];
          resolvedColumns.push({
            columnName,
            meaning: vote.meaning,
            confidence,
            confidenceBasis: basis,
            valueGlossary: vote.valueGlossary,
            sampledAt: hadSample ? new Date().toISOString() : undefined,
          });
        }
      } catch {
        // The whole batch call failed outright (network/timeout/context-overflow, not just
        // malformed JSON - that's already handled per-column inside resolveColumnBatch). A smaller
        // batch may still fit a constrained local model, so split and retry before giving up.
        if (batch.length > 1) {
          if (emit) {
            await emit(`"${item.name}": a batch of ${batch.length} column(s) failed outright, splitting and retrying.`);
          }
          const mid = Math.ceil(batch.length / 2);
          currentBatchSize = Math.min(currentBatchSize, mid);
          await processBatch(batch.slice(0, mid));
          await processBatch(batch.slice(mid));
          return;
        }
        for (const candidate of batch) {
          resolvedColumns.push({
            columnName: candidate.field.name,
            meaning: '',
            confidence: DB_ENRICHMENT_CONFIDENCE_BY_BASIS.unresolved,
            confidenceBasis: 'unresolved',
          });
        }
      }
    };

    const multiBatch = llmCandidates.length > LLM_COLUMN_BATCH_SIZE;
    let cursor = 0;
    while (cursor < llmCandidates.length) {
      const batch = llmCandidates.slice(cursor, cursor + currentBatchSize);
      cursor += batch.length;
      if (multiBatch && emit) {
        await emit(`"${item.name}": resolving columns batch (${batch.length} column(s), ${cursor}/${llmCandidates.length} queued so far).`);
      }
      await processBatch(batch);
    }
  }

  const ambiguousCount = resolvedColumns.filter((column) => column.confidenceBasis === 'unresolved').length;

  await dbEnrichmentRepository.upsertKnowledge({
    dataSourceId,
    objectType: item.objectType,
    objectName: item.name,
    tablePurpose,
    tableConfidence: averageConfidence(resolvedColumns),
    columns: resolvedColumns,
    relations: mapRelationsKnowledge(outgoingEdges),
    sourceOfTruth: resolvedColumns.some((column) => column.confidenceBasis === 'human_authored')
      ? (resolvedColumns.every((column) => column.confidenceBasis === 'human_authored') ? 'HUMAN' : 'MIXED')
      : 'INFERRED',
    lastEnrichedRunId: runId,
  });

  return {
    columnsResolved: resolvedColumns.length - ambiguousCount,
    columnsAmbiguous: ambiguousCount,
    questionsCreated,
  };
};

/** Hard precondition: a chat-capable AI model must be configured and enabled. No degraded mode without one. */
export const assertAiAvailableForEnrichment = (requestedModelId?: string): string => {
  const settings = aiManager.getSettings();
  if (!settings?.enabled) {
    throw new HttpError(503, 'AI is disabled in platform settings. Configure and enable a chat model before running the DB Enricher.');
  }
  const modelId = resolveFieldAssistChatModelId(settings, requestedModelId);
  if (!modelId) {
    throw new HttpError(
      requestedModelId?.trim() ? 400 : 503,
      requestedModelId?.trim()
        ? 'The selected model is not available for chat.'
        : 'No chat-capable AI model is configured. Configure one before running the DB Enricher.',
    );
  }
  return modelId;
};

export const isAiAvailableForEnrichment = (): boolean => {
  try {
    assertAiAvailableForEnrichment();
    return true;
  } catch {
    return false;
  }
};

export const runEnrichment = async (
  envelope: DbEnrichmentJobEnvelope,
  dataSourcesService: DataSourcesService,
  onProgress?: (processed: number, total: number, message: string) => Promise<void>,
): Promise<void> => {
  const modelId = assertAiAvailableForEnrichment(envelope.modelId);

  const sources = dataSourcesService.list({}).body.items;
  const source = sources.find((item) => item.id === envelope.dataSourceId);
  if (!source) {
    throw new HttpError(404, 'Data source not found.');
  }

  const catalog = (await dataSourcesService.listSchemaCatalog(envelope.dataSourceId)).body.catalog;
  const allObjects: { objectType: 'TABLE' | 'VIEW'; name: string }[] = [
    ...catalog.TABLE.map((name) => ({ objectType: 'TABLE' as const, name })),
    ...catalog.VIEW.map((name) => ({ objectType: 'VIEW' as const, name })),
  ];
  const scopeSet = envelope.scope === 'TABLES' && envelope.tables ? new Set(envelope.tables) : null;
  const objects = scopeSet ? allObjects.filter((object) => scopeSet.has(object.name)) : allObjects;

  await dbEnrichmentRepository.startRun(envelope.runId, modelId);

  let tablesProcessed = 0;
  const emit: EnrichmentEmit = async (message) => {
    await dbEnrichmentRepository.appendRunLog(envelope.runId, message);
    if (onProgress) {
      await onProgress(Math.min(tablesProcessed, objects.length), objects.length, message);
    }
  };

  let columnsResolvedTotal = 0;
  let columnsAmbiguousTotal = 0;
  let questionsCreatedTotal = 0;
  const tableConfidences: { confidence: number; columnCount: number }[] = [];

  await emit(`Using model ${modelId}.`);
  await emit(`Found ${objects.length} table(s)/view(s) to enrich.`);

  for (const object of objects) {
    try {
      const result = await enrichTable(
        dataSourcesService,
        source.type,
        envelope.dataSourceId,
        envelope.runId,
        modelId,
        object,
        emit,
      );
      columnsResolvedTotal += result.columnsResolved;
      columnsAmbiguousTotal += result.columnsAmbiguous;
      questionsCreatedTotal += result.questionsCreated;
      const columnCount = result.columnsResolved + result.columnsAmbiguous;
      if (columnCount > 0) {
        const knowledge = await dbEnrichmentRepository.getKnowledgeForObject(envelope.dataSourceId, object.objectType, object.name);
        if (knowledge?.tableConfidence !== null && knowledge?.tableConfidence !== undefined) {
          tableConfidences.push({ confidence: knowledge.tableConfidence, columnCount });
        }
      }
    } catch (error) {
      // One table's introspection itself failing (e.g. a transient DB error) shouldn't sink the whole run.
      const message = error instanceof Error ? error.message : 'Unknown error';
      await emit(`Enrichment failed for "${object.name}": ${message}`);
      await dbEnrichmentRepository.createQuestion({
        dataSourceId: envelope.dataSourceId,
        runId: envelope.runId,
        objectType: object.objectType,
        objectName: object.name,
        kind: 'table_purpose',
        question: `Enrichment failed for "${object.name}" - what is this table for?`,
        reason: [`Automated enrichment errored: ${message}`],
      });
      questionsCreatedTotal += 1;
    }

    tablesProcessed += 1;
    await dbEnrichmentRepository.updateRunProgress(envelope.runId, {
      tablesProcessed,
      columnsResolved: columnsResolvedTotal,
      columnsAmbiguous: columnsAmbiguousTotal,
      questionsCreated: questionsCreatedTotal,
    });
    await emit(`Finished "${object.name}" (${tablesProcessed}/${objects.length}).`);
  }

  const totalWeight = tableConfidences.reduce((sum, entry) => sum + entry.columnCount, 0);
  const overallConfidence = totalWeight > 0
    ? tableConfidences.reduce((sum, entry) => sum + entry.confidence * entry.columnCount, 0) / totalWeight
    : null;

  await dbEnrichmentRepository.completeRun(envelope.runId, overallConfidence);
  const confidenceLabel = overallConfidence !== null ? `${Math.round(overallConfidence * 100)}%` : 'n/a';
  await emit(
    `Completed. ${columnsResolvedTotal} column(s) resolved, ${columnsAmbiguousTotal} ambiguous, ${questionsCreatedTotal} question(s), overall confidence ${confidenceLabel}.`,
  );

  if (questionsCreatedTotal > 0) {
    await dispatchNotificationForRole({
      roleId: 'ADMIN',
      title: 'DB Enricher needs your input',
      body: `${questionsCreatedTotal} open question(s) on "${source.name}" after enrichment.`,
      href: null,
      eventType: 'db_enrichment',
      metadata: { dataSourceId: envelope.dataSourceId, runId: envelope.runId },
    }).catch(() => undefined);
  }
};

const QUESTION_DRAFT_SYSTEM_PROMPT = `You draft a short answer for a database documentation question.
The operator will edit and save it. You do not save anything.
Reply with the draft answer only: plain text, one or two short paragraphs, no markdown fences, no quotes, no preamble.
If candidates are listed, pick the best one or write a clearer equivalent.
Do not invent schema objects that were not provided.`;

const normalizeQuestionDraftAnswer = (raw: string): string => {
  const trimmed = raw.trim()
    .replace(/^```(?:\w+)?\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
  return trimmed.replace(/^["']|["']$/g, '').trim();
};

const buildQuestionDraftUserContent = (
  question: DbEnrichmentQuestion,
  tablePurpose: string | null,
  siblingColumnMeanings: Array<{ columnName: string; meaning: string }>,
): string => {
  const lines = [
    `Kind: ${question.kind}`,
    `Object: ${question.objectType} ${question.objectName}${question.columnName ? `.${question.columnName}` : ''}`,
    `Question: ${question.question}`,
  ];
  if (tablePurpose) {
    lines.push(`Known table purpose: ${tablePurpose}`);
  }
  if (siblingColumnMeanings.length > 0) {
    lines.push('Already-known meanings of other columns on this table, for context:');
    for (const sibling of siblingColumnMeanings) {
      lines.push(`- ${sibling.columnName}: ${sibling.meaning}`);
    }
  }
  if (question.reason.length > 0) {
    lines.push('Why this was asked:');
    for (const reason of question.reason) {
      lines.push(`- ${reason}`);
    }
  }
  if (question.candidates.length > 0) {
    lines.push('Suggested candidates:');
    for (const candidate of question.candidates) {
      lines.push(`- ${candidate}`);
    }
  }
  return lines.join('\n');
};

/** Returns a draft answer for an open question. Does not persist. The operator edits and saves. */
export const draftQuestionAnswer = async (
  questionId: number,
  requestedModelId?: string,
): Promise<string> => {
  const question = await dbEnrichmentRepository.getQuestion(questionId);
  if (!question) {
    throw new HttpError(404, 'Question not found.');
  }
  if (question.status !== 'open') {
    throw new HttpError(409, 'Only open questions can receive an AI draft.');
  }

  const settings = aiManager.getSettings();
  if (!settings?.enabled) {
    throw new HttpError(503, 'AI is disabled in platform settings. Configure and enable a chat model before drafting an answer.');
  }
  const modelId = resolveFieldAssistChatModelId(settings, requestedModelId);
  if (!modelId) {
    throw new HttpError(
      requestedModelId?.trim() ? 400 : 503,
      requestedModelId?.trim()
        ? 'The selected model is not available for chat.'
        : 'No chat-capable AI model is configured. Configure one before drafting an answer.',
    );
  }

  const knowledge = await dbEnrichmentRepository.getKnowledgeForObject(
    question.dataSourceId,
    question.objectType,
    question.objectName,
  );
  const siblingColumnMeanings = (knowledge?.columns ?? [])
    .filter((column) => column.columnName !== question.columnName && column.meaning && column.confidenceBasis !== 'unresolved')
    .map((column) => ({ columnName: column.columnName, meaning: column.meaning }));
  const userContent = buildQuestionDraftUserContent(question, knowledge?.tablePurpose ?? null, siblingColumnMeanings);

  let raw: string;
  try {
    raw = await aiManager.processChat(
      [{ role: 'user', content: userContent }],
      modelId,
      QUESTION_DRAFT_SYSTEM_PROMPT,
    );
  } catch (error) {
    throw new HttpError(502, error instanceof Error ? error.message : 'Failed to generate a draft answer.');
  }

  const draft = normalizeQuestionDraftAnswer(raw);
  if (!draft) {
    throw new HttpError(502, 'The model returned an empty draft.');
  }
  return draft;
};
