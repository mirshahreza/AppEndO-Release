import type { Request, Response } from 'express';
import { isHttpError } from '../errors/HttpError';
import { normalizeAuthRoles } from '../middleware/auth.middleware';
import type { ComponentDesignerService } from '../services/component-designer.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendHttpError } from '../utils/controllerHttp';
import { createId } from '../utils/createId';

const designerHttpError = (
  error: unknown,
  res: Response,
  fallbackMessage: string,
  nonHttpStatusCode: number,
) => {
  if (isHttpError(error)) {
    sendHttpError(res, error, error.message);
    return true;
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  res.status(nonHttpStatusCode).json({ success: false, error: message });
  return true;
};

const rolesOf = (req: Request): string[] => normalizeAuthRoles(req);

export class ComponentDesignerController {
  constructor(private readonly service: ComponentDesignerService) {}

  listDrafts = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.listDrafts(rolesOf(req));
    res.json(result.body);
  }, 'Failed to list designer drafts.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to list designer drafts.',
      500,
    ),
  });

  createDraft = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = this.service.createDraft((req.body || {}) as Record<string, unknown>, actor, rolesOf(req));
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to save designer version.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to save designer version.',
      400,
    ),
  });

  getDraft = asyncHandler(async (req: Request, res: Response) => {
    const version = typeof req.query.version === 'string' ? req.query.version : undefined;
    const result = this.service.getDraft(String(req.params.id || ''), version, rolesOf(req));
    res.json(result.body);
  }, 'Failed to load designer version.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load designer version.',
      500,
    ),
  });

  getDraftByPath = asyncHandler(async (req: Request, res: Response) => {
    const componentPath = typeof req.query.path === 'string' ? req.query.path : '';
    const versionRaw = typeof req.query.version === 'string' ? req.query.version : undefined;
    const result = this.service.getDraft(componentPath, versionRaw, rolesOf(req));
    res.json(result.body);
  }, 'Failed to load designer version.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load designer version.',
      500,
    ),
  });

  listVersions = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.listVersions(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to load designer versions.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load designer versions.',
      500,
    ),
  });

  updateDraft = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = this.service.updateDraft(
      String(req.params.id || ''),
      (req.body || {}) as Record<string, unknown>,
      actor,
      rolesOf(req),
    );
    res.json(result.body);
  }, 'Failed to update designer version.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to update designer version.',
      400,
    ),
  });

  deleteDraft = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.deleteDraft(String(req.params.id || ''), rolesOf(req));
    res.json(result.body);
  }, 'Failed to delete designer version.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to delete designer version.',
      500,
    ),
  });

  previewRuntime = asyncHandler(async (req: Request, res: Response) => {
    const traceId = createId('component_designer_preview');
    res.locals.componentDesignerPreviewTraceId = traceId;
    const result = await this.service.previewRuntime(traceId, (req.body || {}) as Record<string, unknown>);
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to execute runtime preview.', {
    onError: (error, _req, res) => {
      const traceId = typeof res.locals.componentDesignerPreviewTraceId === 'string'
        ? res.locals.componentDesignerPreviewTraceId
        : createId('component_designer_preview');
      const message = error instanceof Error ? error.message : 'Failed to execute runtime preview.';
      res.status(500).json({
        success: false,
        traceId,
        error: {
          code: 'preview-runtime-failed',
          message,
        },
      });
      return true;
    },
  });

  validate = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.validateDocument(req.body?.document);
    res.status(result.statusCode || 200).json(result.body);
  }, 'Validation failed.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Validation failed.',
      500,
    ),
  });

  systemCatalog = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.service.systemComponentsCatalog();
    res.json(result.body);
  }, 'Failed to load system component catalog.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load system component catalog.',
      500,
    ),
  });

  reusableCatalog = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.service.reusableComponentsCatalog();
    res.json(result.body);
  }, 'Failed to load reusable component catalog.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load reusable component catalog.',
      500,
    ),
  });

  syncCodeToCanvas = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.syncCodeToCanvas((req.body || {}) as Record<string, unknown>);
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to sync code to canvas.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to sync code to canvas.',
      500,
    ),
  });

  duplicateShellLayout = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = this.service.duplicateShellLayout((req.body || {}) as Record<string, unknown>, actor);
    res.status(result.statusCode || 201).json(result.body);
  }, 'Failed to duplicate shell layout.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to duplicate shell layout.',
      500,
    ),
  });

  getPublishState = asyncHandler(async (req: Request, res: Response) => {
    const hasUnsavedChanges = req.query.unsaved === '1';
    const result = this.service.getPublishState(String(req.params.id || ''), hasUnsavedChanges);
    res.json(result.body);
  }, 'Failed to load publish state.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load publish state.',
      500,
    ),
  });

  getPublishDiff = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.getPublishDiff(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to load publish diff.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load publish diff.',
      500,
    ),
  });

  getUsage = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.getUsage(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to load component usage.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load component usage.',
      500,
    ),
  });

  listUnusedComponents = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.service.listUnusedComponents();
    res.json(result.body);
  }, 'Failed to load unused components.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load unused components.',
      500,
    ),
  });

  publishDraft = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = this.service.publishDraft(String(req.params.id || ''), actor);
    res.json(result.body);
  }, 'Failed to publish component.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to publish component.',
      400,
    ),
  });

  rollbackDraft = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const version = Number((req.body as { version?: unknown })?.version);
    const result = this.service.rollbackDraft(String(req.params.id || ''), version, actor);
    res.json(result.body);
  }, 'Failed to rollback component.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to rollback component.',
      400,
    ),
  });

  createStagingPreview = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.createStagingPreview(String(req.params.id || ''));
    res.status(result.statusCode || 201).json(result.body);
  }, 'Failed to create staging preview.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to create staging preview.',
      400,
    ),
  });

  getStagingPreview = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.getStagingPreview(String(req.params.token || ''));
    res.json(result.body);
  }, 'Failed to load staging preview.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load staging preview.',
      404,
    ),
  });

  listDataConnectors = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.service.listDataConnectors();
    res.json(result.body);
  }, 'Failed to list data connectors.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to list data connectors.',
      500,
    ),
  });

  createDataConnector = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.upsertDataConnector(
      (req.body || {}) as Record<string, unknown>,
      createId('conn'),
    );
    res.status(result.statusCode || 201).json(result.body);
  }, 'Failed to create data connector.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to create data connector.',
      400,
    ),
  });

  updateDataConnector = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.upsertDataConnector({
      ...((req.body || {}) as Record<string, unknown>),
      id: String(req.params.id || ''),
    });
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to update data connector.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to update data connector.',
      400,
    ),
  });

  deleteDataConnector = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.deleteDataConnector(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to delete data connector.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to delete data connector.',
      400,
    ),
  });

  queryDataConnector = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.queryDataConnector(
      String(req.params.id || ''),
      (req.body || {}) as Record<string, unknown>,
      req.query as Record<string, unknown>,
    );
    res.json(result.body);
  }, 'Failed to query data connector.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to query data connector.',
      400,
    ),
  });

  uploadDataConnectorFile = asyncHandler(async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, error: 'File is required.' });
      return;
    }
    const result = this.service.uploadDataConnectorFile(
      String(req.params.id || ''),
      file.originalname || 'data.json',
      file.buffer,
    );
    res.json(result.body);
  }, 'Failed to upload connector file.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to upload connector file.',
      400,
    ),
  });

  exportDesignerData = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.exportDesignerData(req.body);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/"/g, '')}"`,
    );
    res.status(200).send(result.buffer);
  }, 'Failed to export designer data.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to export designer data.',
      400,
    ),
  });

  importTabularFile = asyncHandler(async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, error: 'File is required.' });
      return;
    }
    const result = this.service.importTabularFile(
      file.originalname || 'import.csv',
      file.buffer,
    );
    res.json(result.body);
  }, 'Failed to import tabular file.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to import tabular file.',
      400,
    ),
  });

  listDraftComments = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.listDraftComments(String(req.params.id || ''), rolesOf(req));
    res.json(result.body);
  }, 'Failed to list canvas comments.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to list canvas comments.',
      500,
    ),
  });

  addDraftComment = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = this.service.addDraftComment(
      String(req.params.id || ''),
      (req.body || {}) as Record<string, unknown>,
      actor,
      rolesOf(req),
    );
    res.status(result.statusCode || 201).json(result.body);
  }, 'Failed to add canvas comment.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to add canvas comment.',
      400,
    ),
  });

  resolveDraftComment = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = this.service.resolveDraftComment(
      String(req.params.id || ''),
      String(req.params.commentId || ''),
      actor,
      rolesOf(req),
    );
    res.json(result.body);
  }, 'Failed to resolve canvas comment.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to resolve canvas comment.',
      400,
    ),
  });

  listDraftAuditLog = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.listDraftAuditLog(String(req.params.id || ''), rolesOf(req));
    res.json(result.body);
  }, 'Failed to load draft audit log.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load draft audit log.',
      500,
    ),
  });

  getFolderPermissions = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.getFolderPermissions(rolesOf(req));
    res.json(result.body);
  }, 'Failed to load folder permissions.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to load folder permissions.',
      500,
    ),
  });

  updateFolderPermissions = asyncHandler(async (req: Request, res: Response) => {
    const result = this.service.updateFolderPermissions(
      (req.body || {}) as Record<string, unknown>,
      rolesOf(req),
    );
    res.json(result.body);
  }, 'Failed to update folder permissions.', {
    onError: (error, _req, res) => designerHttpError(
      error,
      res,
      'Failed to update folder permissions.',
      400,
    ),
  });

}
