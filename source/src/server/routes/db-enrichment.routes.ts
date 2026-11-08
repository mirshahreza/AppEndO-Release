import { Router, type Express } from 'express';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { DataSourcesService } from '../services/data-sources.service';
import { HttpError, isHttpError } from '../errors/HttpError';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext } from '../utils/requestContext';
import type { EdgeDbQueryFn } from '../services/server-function.service';
import { assertAiAvailableForEnrichment, draftQuestionAnswer } from '../services/db-enrichment/dbEnrichmentService';
import { buildDbEnrichmentDocumentation } from '../services/db-enrichment/dbEnrichmentDocumentation';
import { enqueueDbEnrichmentJob } from '../domain/jobs/jobRepository';
import * as dbEnrichmentRepository from '../domain/db-enrichment/dbEnrichmentRepository';
import {
  triggerDbEnrichmentInputSchema,
  answerDbEnrichmentQuestionInputSchema,
  draftDbEnrichmentQuestionInputSchema,
  dbEnrichmentQuestionStatusSchema,
} from '../../shared/api/contracts/db-enrichment';

export type DbEnrichmentRoutesDeps = {
  settingsPath: string;
  edgeDbQuery?: EdgeDbQueryFn;
};

export const mountDbEnrichmentRoutes = (app: Express, deps: DbEnrichmentRoutesDeps): void => {
  const routeGuard = createBuiltInRouteGuard('ADMIN');
  const dataSourcesService = new DataSourcesService({ settingsPath: deps.settingsPath, edgeDbQuery: deps.edgeDbQuery });
  const router = Router();

  router.post('/runs', asyncHandler(async (req, res) => {
    const parsed = triggerDbEnrichmentInputSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid enrichment trigger payload.');
    }

    // Hard precondition: no enrichment run - not even a pending row - without a usable AI model.
    const modelId = assertAiAvailableForEnrichment(parsed.data.modelId);

    const catalog = (await dataSourcesService.listSchemaCatalog(parsed.data.dataSourceId)).body.catalog;
    const allNames = [...catalog.TABLE, ...catalog.VIEW];
    const tablesTotal = parsed.data.scope === 'TABLES' && parsed.data.tables
      ? parsed.data.tables.filter((name) => allNames.includes(name)).length
      : allNames.length;

    const actor = toActorContext(req, true);
    const runId = await dbEnrichmentRepository.createRun({
      dataSourceId: parsed.data.dataSourceId,
      scope: parsed.data.scope,
      tables: parsed.data.tables,
      modelId,
      tablesTotal,
      createdBy: actor.userId,
    });
    await dbEnrichmentRepository.appendRunLog(
      runId,
      `Queued enrichment of ${tablesTotal} table(s)/view(s).`,
    );

    const jobId = await enqueueDbEnrichmentJob({
      runId,
      dataSourceId: parsed.data.dataSourceId,
      scope: parsed.data.scope,
      tables: parsed.data.tables,
      modelId,
      createdBy: actor.userId,
    });
    await dbEnrichmentRepository.attachJobToRun(runId, jobId);

    res.status(201).json({ success: true, runId, jobId });
  }, 'Failed to start DB enrichment.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      return false;
    },
  }));

  router.get('/runs', asyncHandler(async (req, res) => {
    const dataSourceId = String(req.query.dataSourceId || '').trim();
    if (!dataSourceId) {
      throw new HttpError(400, 'dataSourceId is required.');
    }
    const runs = await dbEnrichmentRepository.listRunsForDataSource(dataSourceId);
    res.json({ success: true, items: runs });
  }, 'Failed to list DB enrichment runs.'));

  router.get('/metrics', asyncHandler(async (req, res) => {
    const dataSourceId = String(req.query.dataSourceId || '').trim();
    if (!dataSourceId) {
      throw new HttpError(400, 'dataSourceId is required.');
    }

    const [knowledgeStats, openQuestionCount, lastRun] = await Promise.all([
      dbEnrichmentRepository.getKnowledgeStatsForDataSource(dataSourceId),
      dbEnrichmentRepository.countOpenQuestions(dataSourceId),
      dbEnrichmentRepository.getLatestStatsRun(dataSourceId),
    ]);
    // Card/modal metrics must stay on the control plane. Do not load columnsJson or
    // introspect the live schema — either path hides stored coverage and open questions.
    const tablesEnriched = Math.max(knowledgeStats.tablesEnriched, lastRun?.tablesProcessed ?? 0);
    const tablesTotal = Math.max(lastRun?.tablesTotal ?? 0, tablesEnriched);

    res.json({
      success: true,
      metrics: {
        dataSourceId,
        tablesTotal,
        tablesEnriched,
        coverage: tablesTotal > 0 ? tablesEnriched / tablesTotal : 0,
        overallConfidence: lastRun?.overallConfidence ?? knowledgeStats.avgTableConfidence,
        openQuestionCount,
        columnsResolved: lastRun?.columnsResolved ?? 0,
        columnsAmbiguous: lastRun?.columnsAmbiguous ?? 0,
        humanShare: 0,
        enrichedAt: lastRun?.finishedAt ?? lastRun?.startedAt ?? lastRun?.createdAt ?? knowledgeStats.latestUpdatedAt,
        lastRun: lastRun ?? null,
      },
    });
  }, 'Failed to load DB enrichment metrics.'));

  router.get('/documentation', asyncHandler(async (req, res) => {
    const dataSourceId = String(req.query.dataSourceId || '').trim();
    if (!dataSourceId) {
      throw new HttpError(400, 'dataSourceId is required.');
    }
    const documentation = await buildDbEnrichmentDocumentation(dataSourcesService, dataSourceId);
    res.json({ success: true, documentation });
  }, 'Failed to build DB enrichment documentation.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      return false;
    },
  }));

  router.get('/questions', asyncHandler(async (req, res) => {
    const dataSourceId = req.query.dataSourceId ? String(req.query.dataSourceId).trim() : undefined;
    const rawStatus = req.query.status ? String(req.query.status).trim() : '';
    const statusParsed = rawStatus && rawStatus !== 'all' ? dbEnrichmentQuestionStatusSchema.safeParse(rawStatus) : undefined;
    if (statusParsed && !statusParsed.success) {
      throw new HttpError(400, 'Invalid status filter.');
    }
    const items = await dbEnrichmentRepository.listQuestions(dataSourceId, statusParsed?.data);
    res.json({ success: true, items });
  }, 'Failed to list DB enrichment questions.'));

  // Express 4 skips path segments containing a dot unless the param pattern allows it.
  router.post('/questions/:id([^/]+)/draft', asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, 'Invalid question id.');
    }
    const parsed = draftDbEnrichmentQuestionInputSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid draft payload.');
    }
    const draft = await draftQuestionAnswer(id, parsed.data.modelId);
    res.json({ success: true, draft });
  }, 'Failed to draft a DB enrichment answer.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      return false;
    },
  }));

  router.patch('/questions/:id([^/]+)', asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, 'Invalid question id.');
    }
    const parsed = answerDbEnrichmentQuestionInputSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid answer payload.');
    }
    const actor = toActorContext(req, true);
    const question = await dbEnrichmentRepository.answerQuestion(id, { answer: parsed.data.answer, answeredBy: actor.userId });
    if (!question) {
      throw new HttpError(404, 'Question not found.');
    }
    res.json({ success: true, item: question });
  }, 'Failed to answer DB enrichment question.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      return false;
    },
  }));

  router.post('/questions/:id([^/]+)/dismiss', asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, 'Invalid question id.');
    }
    await dbEnrichmentRepository.dismissQuestion(id);
    res.json({ success: true });
  }, 'Failed to dismiss DB enrichment question.'));

  app.use('/api/db-enrichment', routeGuard, router);
};
