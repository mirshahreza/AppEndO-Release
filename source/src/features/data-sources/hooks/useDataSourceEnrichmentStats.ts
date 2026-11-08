import { useMemo } from 'react';
import type { DbEnrichmentMetrics, DbEnrichmentQuestion, DbEnrichmentRun } from '../../../shared/api/contracts/db-enrichment';
import {
  useDbEnrichmentMetricsQuery,
  useDbEnrichmentQuestionsQuery,
  useDbEnrichmentRunsQuery,
} from '../../../shared/api/queries/dbEnrichment';

export type DataSourceEnrichmentStats = {
  enrichedAt: string | null;
  tablesEnriched: number;
  tablesTotal: number;
  coverage: number;
  overallConfidence: number | null;
  openQuestionCount: number;
  columnsResolved: number;
  columnsAmbiguous: number;
  humanShare: number;
  latestRun: DbEnrichmentRun | undefined;
  isReady: boolean;
};

const pickStatsRun = (runs: DbEnrichmentRun[]): DbEnrichmentRun | undefined => (
  runs.find((run) => run.status === 'completed')
  ?? runs.find((run) => Boolean(run.finishedAt))
  ?? runs[0]
);

const toConfidence = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const latestQuestionAt = (questions: DbEnrichmentQuestion[]): string | null => (
  questions.reduce<string | null>((latest, question) => {
    const at = question.createdAt?.trim() || null;
    if (!at) {
      return latest;
    }
    return !latest || at > latest ? at : latest;
  }, null)
);

export function deriveDataSourceEnrichmentStats(
  runs: DbEnrichmentRun[] | undefined,
  questions: DbEnrichmentQuestion[] | undefined,
  metrics?: DbEnrichmentMetrics | undefined,
): DataSourceEnrichmentStats {
  const runList = runs ?? [];
  const questionList = questions ?? [];
  const statsRun = pickStatsRun(runList);
  const tablesFromQuestions = new Set(questionList.map((question) => question.objectName)).size;
  const tablesEnriched = (statsRun?.tablesProcessed && statsRun.tablesProcessed > 0)
    ? statsRun.tablesProcessed
    : tablesFromQuestions;
  const tablesTotal = Math.max(statsRun?.tablesTotal ?? 0, tablesEnriched);
  const derived: DataSourceEnrichmentStats = {
    enrichedAt: statsRun?.finishedAt
      ?? statsRun?.startedAt
      ?? statsRun?.createdAt
      ?? latestQuestionAt(questionList),
    tablesEnriched,
    tablesTotal,
    coverage: tablesTotal > 0 ? Math.min(tablesEnriched / tablesTotal, 1) : 0,
    overallConfidence: toConfidence(statsRun?.overallConfidence),
    openQuestionCount: questionList.length,
    columnsResolved: statsRun?.columnsResolved ?? 0,
    columnsAmbiguous: statsRun?.columnsAmbiguous ?? 0,
    humanShare: 0,
    latestRun: runList[0],
    isReady: true,
  };

  if (!metrics) {
    return derived;
  }

  const nextTablesEnriched = Math.max(metrics.tablesEnriched, derived.tablesEnriched);
  const nextTablesTotal = Math.max(metrics.tablesTotal, derived.tablesTotal);
  return {
    ...derived,
    enrichedAt: metrics.enrichedAt ?? derived.enrichedAt,
    tablesEnriched: nextTablesEnriched,
    tablesTotal: nextTablesTotal,
    coverage: nextTablesTotal > 0 ? Math.min(nextTablesEnriched / nextTablesTotal, 1) : derived.coverage,
    overallConfidence: toConfidence(metrics.overallConfidence) ?? derived.overallConfidence,
    openQuestionCount: Math.max(metrics.openQuestionCount, derived.openQuestionCount),
    columnsResolved: metrics.columnsResolved || derived.columnsResolved,
    columnsAmbiguous: metrics.columnsAmbiguous || derived.columnsAmbiguous,
    humanShare: metrics.humanShare,
  };
}

export function useDataSourceEnrichmentStats(
  dataSourceId: string,
  options?: { enabled?: boolean },
): DataSourceEnrichmentStats {
  const enabled = options?.enabled ?? true;
  const runsQuery = useDbEnrichmentRunsQuery(dataSourceId, { enabled });
  const questionsQuery = useDbEnrichmentQuestionsQuery(dataSourceId, 'open', { enabled });
  const metricsQuery = useDbEnrichmentMetricsQuery(dataSourceId, { enabled });

  return useMemo(
    () => ({
      ...deriveDataSourceEnrichmentStats(runsQuery.data, questionsQuery.data, metricsQuery.data),
      isReady: runsQuery.isSuccess || questionsQuery.isSuccess || metricsQuery.isSuccess,
    }),
    [
      metricsQuery.data,
      metricsQuery.isSuccess,
      questionsQuery.data,
      questionsQuery.isSuccess,
      runsQuery.data,
      runsQuery.isSuccess,
    ],
  );
}
