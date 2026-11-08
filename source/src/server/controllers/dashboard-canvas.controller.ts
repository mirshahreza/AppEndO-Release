import type { Request, Response } from 'express';
import { SETTINGS_PATH } from '../config/settingsFile';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../errors/HttpError';
import { parsePivotSpec } from '../../shared/api/contracts/data-api';
import { dashboardCanvasPivotRequestSchema } from '../../shared/api/contracts/dashboard-canvas';
import { normalizeFunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import {
  addWidgetComment,
  assertDashboardPageAccess,
  collectDeveloperWidgetNodeIds,
  executeDashboardDomainPivot,
  listWidgetComments,
  loadDashboardPage,
  readCanvasPersonalization,
  readDashboardSnapshot,
  readPageAccess,
  readPageConfigFromDocument,
  renderPivotSnapshotPdf,
  renderPivotSnapshotPng,
  saveDashboardSnapshot,
  upsertPageAccess,
  writeCanvasPersonalization,
} from '../services/dashboard-canvas/dashboardCanvas.service';
import type { ActorContext } from '../types/requestContext';
import { getDataSourcesFromSettings } from '../db/dataSourcesStore';
import { executePivot } from '../services/data-api/pivotExecute';
import { executeDraftDashboardWidget } from '../../core/ai/tools/native/draftDashboardWidget';

const actorOf = (req: Request): ActorContext => ({
  userId: Number(req.auth?.userId || 0),
  email: req.auth?.email,
  role: req.auth?.role,
  isAdmin: req.auth?.role === 'ADMIN',
});

const accessInput = (req: Request, pageId: string, wantPersonalize = false) => ({
  pageId,
  userId: req.auth?.userId ? Number(req.auth.userId) : null,
  email: req.auth?.email ?? null,
  roles: req.auth?.role ? [req.auth.role] : [],
  isAdmin: req.auth?.role === 'ADMIN',
  wantPersonalize,
});

export class DashboardCanvasController {
  getConfig = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.params.pageId || '');
    await assertDashboardPageAccess(accessInput(req, pageId));
    const { document, config } = loadDashboardPage(pageId);
    res.json({
      success: true,
      config,
      developerNodeIds: [...collectDeveloperWidgetNodeIds(document)],
    });
  }, 'Failed to load dashboard canvas.');

  getPersonalization = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.params.pageId || '');
    const gate = await assertDashboardPageAccess(accessInput(req, pageId));
    if (gate.publicVisitor || !req.auth?.userId) {
      res.json({ success: true, personalization: null, localOnly: true });
      return;
    }
    const { document, config } = loadDashboardPage(pageId);
    const personalization = await readCanvasPersonalization(
      Number(req.auth.userId),
      pageId,
      config,
      collectDeveloperWidgetNodeIds(document),
    );
    res.json({ success: true, personalization, localOnly: false });
  }, 'Failed to load dashboard personalization.');

  putPersonalization = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.params.pageId || '');
    const gate = await assertDashboardPageAccess(accessInput(req, pageId, true));
    if (gate.publicVisitor || !req.auth?.userId) {
      throw new HttpError(401, 'Sign in to save personalization.');
    }
    const { document, config } = loadDashboardPage(pageId);
    const personalization = await writeCanvasPersonalization(
      actorOf(req),
      Number(req.auth.userId),
      pageId,
      config,
      collectDeveloperWidgetNodeIds(document),
      req.body?.personalization ?? req.body,
    );
    res.json({ success: true, personalization });
  }, 'Failed to save dashboard personalization.');

  pivot = asyncHandler(async (req: Request, res: Response) => {
    const parsed = dashboardCanvasPivotRequestSchema.parse({
      ...(req.body || {}),
      pageId: req.body?.pageId || req.params.pageId,
    });
    await assertDashboardPageAccess(accessInput(req, parsed.pageId));
    const result = await executeDashboardDomainPivot({
      pageId: parsed.pageId,
      domainEntryId: parsed.domainEntryId,
      spec: parsed.spec,
      policyContextKey: [
        req.auth?.userId ?? 'anon',
        req.auth?.role ?? '',
      ].join(':'),
      settingsPath: SETTINGS_PATH,
      actorUserId: req.auth?.userId ? Number(req.auth.userId) : null,
    });
    res.json(result);
  }, 'Failed to execute dashboard pivot.');

  listComments = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.query.pageId || '');
    const widgetNodeId = String(req.query.widgetNodeId || '');
    if (!pageId || !widgetNodeId) {
      throw new HttpError(400, 'pageId and widgetNodeId are required.');
    }
    await assertDashboardPageAccess(accessInput(req, pageId));
    const items = await listWidgetComments(pageId, widgetNodeId);
    res.json({ success: true, items });
  }, 'Failed to list widget comments.');

  createComment = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.body?.pageId || '');
    const widgetNodeId = String(req.body?.widgetNodeId || '');
    if (!req.auth?.userId) {
      throw new HttpError(401, 'Sign in to comment.');
    }
    await assertDashboardPageAccess(accessInput(req, pageId));
    const item = await addWidgetComment({
      pageId,
      widgetNodeId,
      authorId: Number(req.auth.userId),
      body: String(req.body?.body || ''),
    });
    res.status(201).json({ success: true, item });
  }, 'Failed to add widget comment.');

  getAccess = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.params.pageId || '');
    if (!req.auth?.userId) {
      throw new HttpError(401, 'Authentication is required.');
    }
    const access = await readPageAccess(pageId);
    res.json({ success: true, access });
  }, 'Failed to load dashboard sharing.');

  putAccess = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.params.pageId || '');
    if (!req.auth?.userId) {
      throw new HttpError(401, 'Authentication is required.');
    }
    const existing = await readPageAccess(pageId);
    if (existing && existing.ownerUserId !== Number(req.auth.userId) && req.auth.role !== 'ADMIN') {
      throw new HttpError(403, 'Only the page owner can change sharing.');
    }
    const access = await upsertPageAccess({
      pageId,
      accessControl: normalizeFunctionAccessControl(req.body?.accessControl),
      accessPermission: req.body?.accessPermission === 'personalize' ? 'personalize' : 'view',
      ownerUserId: Number(req.auth.userId),
      embedAllowedOrigins: Array.isArray(req.body?.embedAllowedOrigins)
        ? req.body.embedAllowedOrigins.map((item: unknown) => String(item))
        : undefined,
      actorUserId: Number(req.auth.userId),
    });
    res.json({ success: true, access });
  }, 'Failed to update dashboard sharing.');

  exportPage = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.params.pageId || req.body?.pageId || '');
    await assertDashboardPageAccess(accessInput(req, pageId));
    const { config } = loadDashboardPage(pageId);
    const input = {
      title: `Dashboard ${pageId}`,
      takenAt: new Date().toISOString(),
      results: Array.isArray(req.body?.results) ? req.body.results : [],
    };
    void config;
    if (req.body?.format === 'png') {
      const png = await renderPivotSnapshotPng(input);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-${pageId}.png"`);
      res.send(png);
      return;
    }
    const pdf = await renderPivotSnapshotPdf(input);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-${pageId}.pdf"`);
    res.send(pdf);
  }, 'Failed to export dashboard.');

  createSnapshot = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.params.pageId || '');
    if (!req.auth?.userId) {
      throw new HttpError(401, 'Sign in to create a snapshot.');
    }
    await assertDashboardPageAccess(accessInput(req, pageId));
    const snapshot = await saveDashboardSnapshot({
      pageId,
      createdBy: Number(req.auth.userId),
      payload: {
        frozen: true,
        takenAt: new Date().toISOString(),
        results: req.body?.results ?? [],
      },
      expiresAt: typeof req.body?.expiresAt === 'string' ? req.body.expiresAt : null,
    });
    res.status(201).json({ success: true, snapshot });
  }, 'Failed to save snapshot.');

  getSnapshot = asyncHandler(async (req: Request, res: Response) => {
    const snapshot = await readDashboardSnapshot(String(req.params.id || ''));
    res.json({
      success: true,
      snapshot: {
        ...snapshot,
        banner: `Snapshot taken at ${snapshot.createdAt}`,
      },
    });
  }, 'Failed to load snapshot.');

  draftWidget = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.body?.pageId || req.params.pageId || '');
    await assertDashboardPageAccess(accessInput(req, pageId, true));
    const result = await executeDraftDashboardWidget({
      pageId,
      prompt: String(req.body?.prompt || ''),
    });
    if (!result.ok) {
      throw new HttpError(400, result.summary);
    }
    res.json({ success: true, ...result.data });
  }, 'Failed to draft dashboard widget.');

  explain = asyncHandler(async (req: Request, res: Response) => {
    const pageId = String(req.body?.pageId || '');
    await assertDashboardPageAccess(accessInput(req, pageId));
    const result = req.body?.result;
    if (!result || typeof result !== 'object') {
      throw new HttpError(400, 'An already-fetched PivotResult is required.');
    }
    const cells = Array.isArray((result as { cells?: unknown }).cells)
      ? (result as { cells: Array<{ values?: unknown[] }> }).cells
      : [];
    const first = cells[0]?.values?.[0];
    const narrative = cells.length === 0
      ? 'This chart has no aggregated cells in the current view.'
      : `This chart shows ${cells.length} aggregated cell${cells.length === 1 ? '' : 's'}. The first plotted value is ${first == null ? 'empty' : String(first)}.`;
    res.json({ success: true, explanation: narrative });
  }, 'Failed to explain chart.');

  dataSourcePivot = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const sources = getDataSourcesFromSettings(SETTINGS_PATH);
    const dataSource = sources.find((item) => item.id === id);
    if (!dataSource) {
      throw new HttpError(404, 'Data source not found.');
    }
    const spec = parsePivotSpec(req.body);
    const result = await executePivot({
      spec,
      dataSource,
      policyContextKey: `admin:${req.auth?.userId ?? 'anon'}`,
      noCache: Boolean((req.body as { noCache?: boolean } | undefined)?.noCache),
    });
    res.json(result);
  }, 'Failed to execute data source pivot.');
}

export { readPageConfigFromDocument };
