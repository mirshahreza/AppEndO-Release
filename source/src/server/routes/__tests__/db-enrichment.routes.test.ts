import http from 'http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as dbEnrichmentRepository from '../../domain/db-enrichment/dbEnrichmentRepository';

const draftQuestionAnswer = vi.fn(async () => 'The body column stores HTML content.');

vi.mock('../../middleware/builtInFunctionAccess.middleware', () => ({
  createBuiltInRouteGuard: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/db-enrichment/dbEnrichmentService', () => ({
  assertAiAvailableForEnrichment: vi.fn(),
  draftQuestionAnswer: (...args: unknown[]) => draftQuestionAnswer(...args),
}));

vi.mock('../../services/data-sources.service', () => ({
  DataSourcesService: class {
    listSchemaCatalog = vi.fn();
  },
}));

vi.mock('../../domain/jobs/jobRepository', () => ({
  enqueueDbEnrichmentJob: vi.fn(),
}));

vi.mock('../../domain/db-enrichment/dbEnrichmentRepository', () => ({
  createRun: vi.fn(),
  appendRunLog: vi.fn(),
  attachJobToRun: vi.fn(),
  listRunsForDataSource: vi.fn(),
  listKnowledgeForDataSource: vi.fn(),
  getKnowledgeStatsForDataSource: vi.fn(),
  countOpenQuestions: vi.fn(),
  getLatestCompletedRun: vi.fn(),
  getLatestStatsRun: vi.fn(),
  listQuestions: vi.fn(),
  answerQuestion: vi.fn(),
  dismissQuestion: vi.fn(),
}));

describe('db-enrichment.routes', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    draftQuestionAnswer.mockClear();
    const app = express();
    app.use(express.json());
    const { mountDbEnrichmentRoutes } = await import('../db-enrichment.routes');
    mountDbEnrichmentRoutes(app, { settingsPath: 'settings.json' });

    app.use('/api', (_req, res) => {
      res.status(404).json({ success: false, error: 'API route not found.' });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('registers POST /api/db-enrichment/questions/:id/draft', async () => {
    const response = await fetch(`${baseUrl}/api/db-enrichment/questions/42/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: 'gpt-5.4' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      draft: 'The body column stores HTML content.',
    });
    expect(draftQuestionAnswer).toHaveBeenCalledWith(42, 'gpt-5.4');
  });

  it('returns stored enrichment metrics without introspecting the live schema', async () => {
    vi.mocked(dbEnrichmentRepository.getKnowledgeStatsForDataSource).mockResolvedValue({
      tablesEnriched: 1,
      avgTableConfidence: 0.34,
      latestUpdatedAt: '2024-06-15T10:00:00.000Z',
    });
    vi.mocked(dbEnrichmentRepository.countOpenQuestions).mockResolvedValue(3);
    vi.mocked(dbEnrichmentRepository.getLatestStatsRun).mockResolvedValue({
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
      questionsCreated: 3,
      overallConfidence: 0.4,
      progressLog: [],
      errorMessage: null,
      startedAt: '2024-06-15T09:00:00.000Z',
      finishedAt: '2024-06-15T10:00:00.000Z',
      createdAt: '2024-06-15T09:00:00.000Z',
    } as never);

    const response = await fetch(`${baseUrl}/api/db-enrichment/metrics?dataSourceId=ds-1`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      metrics: {
        dataSourceId: 'ds-1',
        tablesTotal: 10,
        tablesEnriched: 10,
        openQuestionCount: 3,
        enrichedAt: '2024-06-15T10:00:00.000Z',
      },
    });
  });
});
