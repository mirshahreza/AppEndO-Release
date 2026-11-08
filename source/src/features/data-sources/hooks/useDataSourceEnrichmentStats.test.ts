import { describe, expect, it } from 'vitest';
import type { DbEnrichmentQuestion, DbEnrichmentRun } from '../../../shared/api/contracts/db-enrichment';
import { deriveDataSourceEnrichmentStats } from './useDataSourceEnrichmentStats';

const completedRun: DbEnrichmentRun = {
  id: 1,
  dataSourceId: 'ds-1',
  scope: 'FULL',
  status: 'completed',
  jobId: 9,
  modelId: 'gpt-test',
  tablesTotal: 10,
  tablesProcessed: 10,
  columnsResolved: 4,
  columnsAmbiguous: 2,
  questionsCreated: 366,
  overallConfidence: 0.3,
  progressLog: [],
  errorMessage: null,
  startedAt: '2024-06-15T09:00:00.000Z',
  finishedAt: '2024-06-15T10:00:00.000Z',
  createdAt: '2024-06-15T09:00:00.000Z',
};

const openQuestion = (objectName: string, index: number): DbEnrichmentQuestion => ({
  id: index,
  dataSourceId: 'ds-1',
  runId: 1,
  objectType: 'TABLE',
  objectName,
  columnName: null,
  kind: 'table_purpose',
  question: 'What is this table for?',
  reason: [],
  candidates: [],
  status: 'open',
  answer: null,
  answeredBy: null,
  answeredAt: null,
  createdAt: '2024-06-15T10:00:00.000Z',
});

describe('deriveDataSourceEnrichmentStats', () => {
  it('keeps coverage, confidence, open questions, and finishedAt from a completed run', () => {
    const stats = deriveDataSourceEnrichmentStats(
      [completedRun],
      [openQuestion('users', 1), openQuestion('orders', 2)],
    );
    expect(stats.enrichedAt).toBe('2024-06-15T10:00:00.000Z');
    expect(stats.coverage).toBe(1);
    expect(stats.overallConfidence).toBe(0.3);
    expect(stats.openQuestionCount).toBe(2);
  });

  it('falls back to the latest open question when no run timestamps exist', () => {
    const stats = deriveDataSourceEnrichmentStats(
      [],
      [
        openQuestion('users', 1),
        { ...openQuestion('orders', 2), createdAt: '2024-07-01T12:00:00.000Z' },
      ],
    );
    expect(stats.enrichedAt).toBe('2024-07-01T12:00:00.000Z');
    expect(stats.openQuestionCount).toBe(2);
  });

  it('falls back to startedAt and unique question tables when the run is unfinished', () => {
    const stats = deriveDataSourceEnrichmentStats(
      [{
        ...completedRun,
        status: 'running',
        tablesProcessed: 0,
        overallConfidence: null,
        finishedAt: null,
      }],
      [openQuestion('users', 1), openQuestion('users', 2), openQuestion('orders', 3)],
    );
    expect(stats.enrichedAt).toBe('2024-06-15T09:00:00.000Z');
    expect(stats.tablesEnriched).toBe(2);
    expect(stats.tablesTotal).toBe(10);
    expect(stats.openQuestionCount).toBe(3);
  });
});
