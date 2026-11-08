import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';
import type {
  DbEnrichmentColumnKnowledge,
  DbEnrichmentKnowledge,
  DbEnrichmentProgressLogEntry,
  DbEnrichmentQuestion,
  DbEnrichmentQuestionKind,
  DbEnrichmentQuestionStatus,
  DbEnrichmentRelationKnowledge,
  DbEnrichmentRun,
  DbEnrichmentRunStatus,
  DbEnrichmentScope,
  DbEnrichmentSourceOfTruth,
} from '../../../shared/api/contracts/db-enrichment';
import { DB_ENRICHMENT_CONFIDENCE_BY_BASIS } from '../../../shared/api/contracts/db-enrichment';

const toIsoString = (value: Date | null | undefined): string | null => (
  value instanceof Date ? value.toISOString() : value ? String(value) : null
);

const parseJsonArray = <T>(raw: string | null | undefined): T[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

type RunRow = {
  id: bigint;
  dataSourceId: string;
  scope: string;
  status: string;
  jobId: bigint | null;
  modelId: string | null;
  tablesTotal: number;
  tablesProcessed: number;
  columnsResolved: number;
  columnsAmbiguous: number;
  questionsCreated: number;
  overallConfidence: number | null;
  progressLogJson: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date | null;
};

const MAX_PROGRESS_LOG_ENTRIES = 2000;

const RUN_LIST_SELECT = {
  id: true,
  dataSourceId: true,
  scope: true,
  status: true,
  jobId: true,
  modelId: true,
  tablesTotal: true,
  tablesProcessed: true,
  columnsResolved: true,
  columnsAmbiguous: true,
  questionsCreated: true,
  overallConfidence: true,
  errorMessage: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
} as const;

const mapRun = (row: RunRow): DbEnrichmentRun => ({
  id: fromUserId(row.id),
  dataSourceId: row.dataSourceId,
  scope: row.scope as DbEnrichmentScope,
  status: row.status as DbEnrichmentRunStatus,
  jobId: row.jobId !== null ? fromUserId(row.jobId) : null,
  modelId: row.modelId,
  tablesTotal: row.tablesTotal,
  tablesProcessed: row.tablesProcessed,
  columnsResolved: row.columnsResolved,
  columnsAmbiguous: row.columnsAmbiguous,
  questionsCreated: row.questionsCreated,
  overallConfidence: row.overallConfidence == null ? null : Number(row.overallConfidence),
  progressLog: parseJsonArray<DbEnrichmentProgressLogEntry>(row.progressLogJson),
  errorMessage: row.errorMessage,
  startedAt: toIsoString(row.startedAt),
  finishedAt: toIsoString(row.finishedAt),
  createdAt: toIsoString(row.createdAt),
});

export const createRun = async (input: {
  dataSourceId: string;
  scope: DbEnrichmentScope;
  tables?: string[];
  modelId?: string;
  tablesTotal: number;
  createdBy?: number | null;
}): Promise<number> => {
  const actor = input.createdBy !== undefined && input.createdBy !== null ? toUserId(input.createdBy) : null;
  const row = await prisma().dbEnrichmentRun.create({
    data: {
      dataSourceId: input.dataSourceId,
      scope: input.scope,
      scopeTablesJson: input.tables ? JSON.stringify(input.tables) : null,
      status: 'pending',
      modelId: input.modelId ?? null,
      tablesTotal: input.tablesTotal,
      createdBy: actor,
    },
    select: { id: true },
  });
  return fromUserId(row.id);
};

export const attachJobToRun = async (runId: number, jobId: number): Promise<void> => {
  await prisma().dbEnrichmentRun.update({
    where: { id: toUserId(runId) },
    data: { jobId: toUserId(jobId) },
  });
};

export const startRun = async (runId: number, modelId?: string): Promise<void> => {
  await prisma().dbEnrichmentRun.update({
    where: { id: toUserId(runId) },
    data: {
      status: 'running',
      startedAt: new Date(),
      updatedAt: new Date(),
      ...(modelId ? { modelId } : {}),
    },
  });
};

export const appendRunLog = async (runId: number, message: string): Promise<void> => {
  const row = await prisma().dbEnrichmentRun.findUnique({
    where: { id: toUserId(runId) },
    select: { progressLogJson: true },
  });
  const log = parseJsonArray<DbEnrichmentProgressLogEntry>(row?.progressLogJson);
  log.push({ at: new Date().toISOString(), message });
  const trimmed = log.length > MAX_PROGRESS_LOG_ENTRIES ? log.slice(-MAX_PROGRESS_LOG_ENTRIES) : log;
  await prisma().dbEnrichmentRun.update({
    where: { id: toUserId(runId) },
    data: { progressLogJson: JSON.stringify(trimmed), updatedAt: new Date() },
  });
};

export const updateRunProgress = async (runId: number, patch: {
  tablesProcessed?: number;
  columnsResolved?: number;
  columnsAmbiguous?: number;
  questionsCreated?: number;
}): Promise<void> => {
  await prisma().dbEnrichmentRun.update({
    where: { id: toUserId(runId) },
    data: { ...patch, updatedAt: new Date() },
  });
};

export const completeRun = async (runId: number, overallConfidence: number | null): Promise<void> => {
  await prisma().dbEnrichmentRun.update({
    where: { id: toUserId(runId) },
    data: {
      status: 'completed',
      overallConfidence,
      finishedAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

export const failRun = async (runId: number, errorMessage: string): Promise<void> => {
  await prisma().dbEnrichmentRun.update({
    where: { id: toUserId(runId) },
    data: {
      status: 'failed',
      errorMessage: errorMessage.slice(0, 4000),
      finishedAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

export const getRun = async (runId: number): Promise<DbEnrichmentRun | undefined> => {
  const row = await prisma().dbEnrichmentRun.findUnique({ where: { id: toUserId(runId) } });
  return row ? mapRun(row) : undefined;
};

export const listRunsForDataSource = async (dataSourceId: string, limit = 20): Promise<DbEnrichmentRun[]> => {
  const rows = await prisma().dbEnrichmentRun.findMany({
    where: { dataSourceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: RUN_LIST_SELECT,
  });
  const latest = rows[0];
  const includeLiveLog = Boolean(
    latest && (latest.status === 'pending' || latest.status === 'running'),
  );
  let liveLog: string | null = null;
  if (includeLiveLog && latest) {
    const logRow = await prisma().dbEnrichmentRun.findUnique({
      where: { id: latest.id },
      select: { progressLogJson: true },
    });
    liveLog = logRow?.progressLogJson ?? null;
  }
  return rows.map((row, index) => mapRun({
    ...row,
    progressLogJson: index === 0 && includeLiveLog ? liveLog : null,
  }));
};

const mapRunWithoutLog = (row: Omit<RunRow, 'progressLogJson'>): DbEnrichmentRun => (
  mapRun({ ...row, progressLogJson: null })
);

export const getLatestCompletedRun = async (dataSourceId: string): Promise<DbEnrichmentRun | undefined> => {
  const row = await prisma().dbEnrichmentRun.findFirst({
    where: { dataSourceId, status: 'completed' },
    orderBy: { finishedAt: 'desc' },
    select: RUN_LIST_SELECT,
  });
  return row ? mapRunWithoutLog(row) : undefined;
};

export const getLatestStatsRun = async (dataSourceId: string): Promise<DbEnrichmentRun | undefined> => {
  const completed = await getLatestCompletedRun(dataSourceId);
  if (completed) {
    return completed;
  }
  const latest = await prisma().dbEnrichmentRun.findFirst({
    where: { dataSourceId },
    orderBy: { createdAt: 'desc' },
    select: RUN_LIST_SELECT,
  });
  return latest ? mapRunWithoutLog(latest) : undefined;
};

export type DbEnrichmentKnowledgeStats = {
  tablesEnriched: number;
  avgTableConfidence: number | null;
  latestUpdatedAt: string | null;
};

export const getKnowledgeStatsForDataSource = async (
  dataSourceId: string,
): Promise<DbEnrichmentKnowledgeStats> => {
  const stats = await prisma().dbEnrichmentKnowledge.aggregate({
    where: { dataSourceId },
    _count: { _all: true },
    _avg: { tableConfidence: true },
    _max: { updatedAt: true },
  });
  const avg = stats._avg.tableConfidence;
  return {
    tablesEnriched: stats._count._all,
    avgTableConfidence: avg == null ? null : Number(avg),
    latestUpdatedAt: stats._max.updatedAt ? stats._max.updatedAt.toISOString() : null,
  };
};

const mapKnowledge = (row: {
  dataSourceId: string;
  objectType: string;
  objectName: string;
  tablePurpose: string | null;
  tableConfidence: number | null;
  columnsJson: string;
  relationsJson: string;
  sourceOfTruth: string;
  lastEnrichedRunId: bigint | null;
  staleSince: Date | null;
  updatedAt: Date | null;
}): DbEnrichmentKnowledge => ({
  dataSourceId: row.dataSourceId,
  objectType: row.objectType as 'TABLE' | 'VIEW',
  objectName: row.objectName,
  tablePurpose: row.tablePurpose,
  tableConfidence: row.tableConfidence,
  columns: parseJsonArray<DbEnrichmentColumnKnowledge>(row.columnsJson),
  relations: parseJsonArray<DbEnrichmentRelationKnowledge>(row.relationsJson),
  sourceOfTruth: row.sourceOfTruth as DbEnrichmentSourceOfTruth,
  lastEnrichedRunId: row.lastEnrichedRunId !== null ? fromUserId(row.lastEnrichedRunId) : null,
  staleSince: toIsoString(row.staleSince),
  updatedAt: toIsoString(row.updatedAt),
});

export const upsertKnowledge = async (input: {
  dataSourceId: string;
  objectType: 'TABLE' | 'VIEW';
  objectName: string;
  tablePurpose?: string | null;
  tableConfidence?: number | null;
  columns: DbEnrichmentColumnKnowledge[];
  relations: DbEnrichmentRelationKnowledge[];
  sourceOfTruth: DbEnrichmentSourceOfTruth;
  lastEnrichedRunId?: number | null;
}): Promise<void> => {
  const data = {
    tablePurpose: input.tablePurpose ?? null,
    tableConfidence: input.tableConfidence ?? null,
    columnsJson: JSON.stringify(input.columns),
    relationsJson: JSON.stringify(input.relations),
    sourceOfTruth: input.sourceOfTruth,
    lastEnrichedRunId: input.lastEnrichedRunId !== undefined && input.lastEnrichedRunId !== null
      ? toUserId(input.lastEnrichedRunId)
      : null,
    staleSince: null,
    updatedAt: new Date(),
  };
  await prisma().dbEnrichmentKnowledge.upsert({
    where: {
      dataSourceId_objectType_objectName: {
        dataSourceId: input.dataSourceId,
        objectType: input.objectType,
        objectName: input.objectName,
      },
    },
    create: {
      dataSourceId: input.dataSourceId,
      objectType: input.objectType,
      objectName: input.objectName,
      ...data,
    },
    update: data,
  });
};

export const getKnowledgeForObject = async (
  dataSourceId: string,
  objectType: 'TABLE' | 'VIEW',
  objectName: string,
): Promise<DbEnrichmentKnowledge | undefined> => {
  const row = await prisma().dbEnrichmentKnowledge.findUnique({
    where: { dataSourceId_objectType_objectName: { dataSourceId, objectType, objectName } },
  });
  return row ? mapKnowledge(row) : undefined;
};

export const listKnowledgeForDataSource = async (dataSourceId: string): Promise<DbEnrichmentKnowledge[]> => {
  const rows = await prisma().dbEnrichmentKnowledge.findMany({ where: { dataSourceId } });
  return rows.map(mapKnowledge);
};

/** Patches one column's knowledge entry after a human answers a question, without waiting for the next full run. */
export const patchColumnKnowledgeFromAnswer = async (input: {
  dataSourceId: string;
  objectType: 'TABLE' | 'VIEW';
  objectName: string;
  columnName: string | null;
  answer: string;
}): Promise<void> => {
  const existing = await getKnowledgeForObject(input.dataSourceId, input.objectType, input.objectName);
  const confidence = DB_ENRICHMENT_CONFIDENCE_BY_BASIS.human_answered;

  if (input.columnName === null) {
    await upsertKnowledge({
      dataSourceId: input.dataSourceId,
      objectType: input.objectType,
      objectName: input.objectName,
      tablePurpose: input.answer,
      tableConfidence: confidence,
      columns: existing?.columns ?? [],
      relations: existing?.relations ?? [],
      sourceOfTruth: existing?.sourceOfTruth === 'HUMAN' ? 'HUMAN' : 'MIXED',
    });
    return;
  }

  const columns = existing?.columns ? [...existing.columns] : [];
  const index = columns.findIndex((column) => column.columnName === input.columnName);
  const nextColumn: DbEnrichmentColumnKnowledge = {
    columnName: input.columnName,
    meaning: input.answer,
    confidence,
    confidenceBasis: 'human_answered',
  };
  if (index >= 0) {
    columns[index] = nextColumn;
  } else {
    columns.push(nextColumn);
  }

  await upsertKnowledge({
    dataSourceId: input.dataSourceId,
    objectType: input.objectType,
    objectName: input.objectName,
    tablePurpose: existing?.tablePurpose ?? null,
    tableConfidence: existing?.tableConfidence ?? null,
    columns,
    relations: existing?.relations ?? [],
    sourceOfTruth: existing?.sourceOfTruth === 'HUMAN' ? 'HUMAN' : 'MIXED',
  });
};

const mapQuestion = (row: {
  id: bigint;
  dataSourceId: string;
  runId: bigint | null;
  objectType: string;
  objectName: string;
  columnName: string | null;
  kind: string;
  question: string;
  reasonJson: string;
  candidatesJson: string | null;
  status: string;
  answer: string | null;
  answeredBy: bigint | null;
  answeredAt: Date | null;
  createdAt: Date | null;
}): DbEnrichmentQuestion => ({
  id: fromUserId(row.id),
  dataSourceId: row.dataSourceId,
  runId: row.runId !== null ? fromUserId(row.runId) : null,
  objectType: row.objectType as 'TABLE' | 'VIEW',
  objectName: row.objectName,
  columnName: row.columnName,
  kind: row.kind as DbEnrichmentQuestionKind,
  question: row.question,
  reason: parseJsonArray<string>(row.reasonJson),
  candidates: parseJsonArray<string>(row.candidatesJson),
  status: row.status as DbEnrichmentQuestionStatus,
  answer: row.answer,
  answeredBy: row.answeredBy !== null ? fromUserId(row.answeredBy) : null,
  answeredAt: toIsoString(row.answeredAt),
  createdAt: toIsoString(row.createdAt),
});

export const createQuestion = async (input: {
  dataSourceId: string;
  runId?: number | null;
  objectType: 'TABLE' | 'VIEW';
  objectName: string;
  columnName?: string | null;
  kind: DbEnrichmentQuestionKind;
  question: string;
  reason: string[];
  candidates?: string[];
}): Promise<number> => {
  const row = await prisma().dbEnrichmentQuestion.create({
    data: {
      dataSourceId: input.dataSourceId,
      runId: input.runId !== undefined && input.runId !== null ? toUserId(input.runId) : null,
      objectType: input.objectType,
      objectName: input.objectName,
      columnName: input.columnName ?? null,
      kind: input.kind,
      question: input.question,
      reasonJson: JSON.stringify(input.reason),
      candidatesJson: input.candidates ? JSON.stringify(input.candidates) : null,
      status: 'open',
    },
    select: { id: true },
  });
  return fromUserId(row.id);
};

export const listQuestions = async (
  dataSourceId?: string,
  status?: DbEnrichmentQuestionStatus,
): Promise<DbEnrichmentQuestion[]> => {
  const rows = await prisma().dbEnrichmentQuestion.findMany({
    where: { ...(status ? { status } : {}), ...(dataSourceId ? { dataSourceId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapQuestion);
};

export const getQuestion = async (id: number): Promise<DbEnrichmentQuestion | undefined> => {
  const row = await prisma().dbEnrichmentQuestion.findUnique({ where: { id: toUserId(id) } });
  return row ? mapQuestion(row) : undefined;
};

export const answerQuestion = async (
  id: number,
  input: { answer: string; answeredBy?: number | null },
): Promise<DbEnrichmentQuestion | undefined> => {
  const question = await getQuestion(id);
  if (!question) return undefined;

  const answeredBy = input.answeredBy !== undefined && input.answeredBy !== null ? toUserId(input.answeredBy) : null;
  const row = await prisma().dbEnrichmentQuestion.update({
    where: { id: toUserId(id) },
    data: {
      status: 'answered',
      answer: input.answer,
      answeredBy,
      answeredAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await patchColumnKnowledgeFromAnswer({
    dataSourceId: question.dataSourceId,
    objectType: question.objectType,
    objectName: question.objectName,
    columnName: question.columnName,
    answer: input.answer,
  });

  return mapQuestion(row);
};

export const dismissQuestion = async (id: number): Promise<void> => {
  await prisma().dbEnrichmentQuestion.update({
    where: { id: toUserId(id) },
    data: { status: 'dismissed', updatedAt: new Date() },
  });
};

export const countOpenQuestions = async (dataSourceId: string): Promise<number> => (
  prisma().dbEnrichmentQuestion.count({ where: { dataSourceId, status: 'open' } })
);
