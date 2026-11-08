import type { Request, Response } from 'express';
import path from 'path';
import { readPackageUiModuleKeyFromParams } from '../../shared/api/contracts/package-manifest/extensionUiRoutes';
import type { PackagesService } from '../services/packages.service';
import { asyncHandler } from '../utils/asyncHandler';
import { toRequestDbContext } from '../utils/requestContext';
import { getAccessTokenFromRequest, toJwtAuthPayload } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import { getAccessTokenSecret } from '../constants/auth';
import { resolveSessionPackageCreatedBy } from '../services/package/resolveSessionPackageCreatedBy';

function tryAttachAuth(req: Request): boolean {
  const token = getAccessTokenFromRequest(req);
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, getAccessTokenSecret());
    const payload = toJwtAuthPayload(decoded);
    if (!payload || payload.type !== 'access') return false;
    const effectiveRoles = payload.roles && payload.roles.length > 0
      ? payload.roles.map((role) => role.toUpperCase())
      : [payload.role.toUpperCase()];
    req.auth = {
      userId: Number(payload.sub),
      email: payload.email,
      role: effectiveRoles[0] || payload.role,
      roles: effectiveRoles,
    };
    return true;
  } catch {
    return false;
  }
}

export class PackagesController {
  constructor(private readonly pluginsService: PackagesService) {}

  featureFlags = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.pluginsService.getFeatureFlags();
    res.json(result.body);
  }, 'Failed to read package feature flags.');

  builderCatalog = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.pluginsService.getBuilderCatalog(toRequestDbContext(req));
    res.json(result.body);
  }, 'Failed to load package builder catalog.');

  listWorkspaceAssets = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.pluginsService.listWorkspaceAssets();
    res.json(result.body);
  }, 'Failed to list workspace assets.');

  readWorkspaceAsset = asyncHandler(async (req: Request, res: Response) => {
    const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
    const result = this.pluginsService.readWorkspaceAsset(relativePath);
    res.type(path.extname(result.absPath));
    res.send(result.content);
  }, 'Failed to read workspace asset.');

  readPlatformFontAsset = asyncHandler(async (req: Request, res: Response) => {
    const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
    const result = this.pluginsService.readPlatformFontAsset(relativePath);
    res.type(path.extname(result.absPath));
    res.send(result.content);
  }, 'Failed to read platform font.');

  uploadWorkspaceAsset = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded. Send a file as multipart field "file".' });
      return;
    }

    const result = this.pluginsService.uploadWorkspaceAsset(req.file.originalname, req.file.buffer);
    res.status(201).json(result.body);
  }, 'Failed to upload workspace asset.');

  deleteWorkspaceAsset = asyncHandler(async (req: Request, res: Response) => {
    const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
    const result = this.pluginsService.deleteWorkspaceAsset(relativePath);
    res.json(result.body);
  }, 'Failed to delete workspace asset.');

  listCapturableSqlFiles = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.pluginsService.listCapturableSqlFiles();
    res.json(result.body);
  }, 'Failed to list SQL files.');

  readCapturableSqlFile = asyncHandler(async (req: Request, res: Response) => {
    const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
    const result = this.pluginsService.readCapturableSqlFile(relativePath);
    res.json(result.body);
  }, 'Failed to read SQL file.');

  captureSeedInserts = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const dataSourceId = typeof body.dataSourceId === 'string' ? body.dataSourceId : '';
    const tableName = typeof body.tableName === 'string' ? body.tableName : '';
    if (!dataSourceId || !tableName) {
      res.status(400).json({ success: false, error: 'dataSourceId and tableName are required.' });
      return;
    }
    const parseStringList = (value: unknown): string[] | undefined => {
      if (Array.isArray(value)) {
        const items = value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
        return items.length > 0 ? items : undefined;
      }
      if (typeof value === 'string') {
        const items = value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
        return items.length > 0 ? items : undefined;
      }
      return undefined;
    };
    const parseBoolean = (value: unknown): boolean | undefined => (
      typeof value === 'boolean' ? value : undefined
    );
    const parseLimit = (value: unknown): number | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        return Number(value);
      }
      return undefined;
    };
    const result = await this.pluginsService.captureSeedInserts({
      dataSourceId,
      tableName,
      relatedTables: parseStringList(body.relatedTables),
      where: typeof body.where === 'string' ? body.where : undefined,
      orderBy: typeof body.orderBy === 'string' ? body.orderBy : undefined,
      limit: parseLimit(body.limit),
      includeBinary: parseBoolean(body.includeBinary),
      includeDescendants: parseBoolean(body.includeDescendants),
      parentColumn: typeof body.parentColumn === 'string' ? body.parentColumn : undefined,
    });
    res.json(result.body);
  }, 'Failed to capture seed data.');

  captureCmsModule = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const dataSourceId = typeof body.dataSourceId === 'string' ? body.dataSourceId : '';
    if (!dataSourceId) {
      res.status(400).json({ success: false, error: 'dataSourceId is required.' });
      return;
    }
    const result = await this.pluginsService.captureCmsModule({
      dataSourceId,
      includeOptionalRecords: typeof body.includeOptionalRecords === 'boolean'
        ? body.includeOptionalRecords
        : undefined,
    });
    res.json(result.body);
  }, 'Failed to pack the CMS module.');

  edgeDataExport = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const result = this.pluginsService.buildEdgeDataExport({
      edgeModelIds: body.edgeModelIds,
      edgeApiIds: body.edgeApiIds,
    });
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to export edge data for package builder.');

  workflowExport = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const result = await this.pluginsService.buildWorkflowExport({
      workflowDefinitionIds: body.workflowDefinitionIds,
      workflowKeys: body.workflowKeys,
    });
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to export workflows for package builder.');

  upload = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded. Send a .zip file as multipart field "file".' });
      return;
    }
    const actor = req.auth?.email ?? 'unknown';
    const bodyCreatedBy = typeof req.body?.createdBy === 'string' ? req.body.createdBy.trim() : '';
    const createdBy = bodyCreatedBy
      || (req.auth?.userId && req.auth.email
        ? await resolveSessionPackageCreatedBy({ userId: req.auth.userId, email: req.auth.email })
        : undefined);
    const result = await this.pluginsService.uploadArtifact(
      req.file.buffer,
      req.file.originalname,
      actor,
      { createdBy },
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Upload failed.', {
    onError: (error, _req, res) => {
      const err = error as { code?: string; message?: string };
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ success: false, error: 'File exceeds 512 MB limit.' });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Upload failed.';
      res.status(500).json({ success: false, error: message || 'Upload failed.' });
      return true;
    },
  });

  list = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.pluginsService.list();
    res.json(result.body);
  }, 'Failed to list packages.');

  dependencyGraph = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.pluginsService.getDependencyGraph();
    res.json(result.body);
  }, 'Failed to read dependency graph.');

  detail = asyncHandler(async (req: Request, res: Response) => {
    const version = typeof req.query.version === 'string' ? req.query.version.trim() : undefined;
    const result = this.pluginsService.getDetail(String(req.params.id || ''), version);
    res.json(result.body);
  }, 'Failed to fetch package.');

  download = asyncHandler(async (req: Request, res: Response) => {
    const requestedVersion = typeof req.query.version === 'string' ? req.query.version.trim() : undefined;
    const resolved = this.pluginsService.resolveDownload(String(req.params.id || ''), requestedVersion);
    res.setHeader('Content-Type', 'application/zip');
    res.download(resolved.absArtifactPath, resolved.fileName);
  }, 'Failed to download package artifact.');

  remove = asyncHandler(async (req: Request, res: Response) => {
    const actor = (req as Request & { user?: { username?: string } }).user?.username ?? 'unknown';
    const version = typeof req.query.version === 'string' ? req.query.version.trim() : undefined;
    const result = this.pluginsService.delete(String(req.params.id || ''), actor, version);
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to delete package.');

  install = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = await this.pluginsService.install(
      String(req.params.id || ''),
      actor,
      (req.body || {}) as Record<string, unknown>,
    );
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to install package.');

  uninstall = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = await this.pluginsService.uninstall(
      String(req.params.id || ''),
      actor,
      (req.body || {}) as Record<string, unknown>,
    );
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to uninstall package.');

  reinstall = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = await this.pluginsService.reinstall(
      String(req.params.id || ''),
      actor,
      (req.body || {}) as Record<string, unknown>,
    );
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to reinstall package.');

  repackDrift = asyncHandler(async (req: Request, res: Response) => {
    const result = this.pluginsService.getRepackDrift(String(req.params.id || ''));
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to load package repack drift.');

  repackDiff = asyncHandler(async (req: Request, res: Response) => {
    const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : '';
    const result = this.pluginsService.getRepackDiff(String(req.params.id || ''), itemId);
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to load package repack diff.');

  repackRevert = asyncHandler(async (req: Request, res: Response) => {
    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId : '';
    const result = this.pluginsService.revertRepackItem(String(req.params.id || ''), itemId);
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to revert package repack item.');

  repack = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const createdBy = typeof req.body?.createdBy === 'string' ? req.body.createdBy : undefined;
    const result = await this.pluginsService.repack(
      String(req.params.id || ''),
      actor,
      { ...(req.body || {}), createdBy } as Record<string, unknown>,
    );
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to repack package.');

  enable = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = this.pluginsService.enable(String(req.params.id || ''), actor);
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to enable package.');

  disable = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const result = this.pluginsService.disable(String(req.params.id || ''), actor);
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to disable package.');

  serveUiModule = asyncHandler(async (req: Request, res: Response) => {
    const packageId = String(req.params.id || '').trim();
    const componentKey = readPackageUiModuleKeyFromParams(req.params);
    const resolved = await this.pluginsService.resolveUiModule(packageId, componentKey);
    res.setHeader('Content-Type', resolved.contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(resolved.body);
  }, 'Failed to load package UI module.');

  serveStaticAsset = asyncHandler(async (req: Request, res: Response) => {
    const packageId = String(req.params.id || '').trim();
    const assetKey = String(req.params.assetKey || '').trim();
    const resolved = this.pluginsService.resolveStaticAsset(packageId, assetKey);

    if (!resolved.isPublic) {
      tryAttachAuth(req);
      if (!req.auth) {
        res.status(401).json({ success: false, error: 'Authentication required for this asset.' });
        return;
      }
    }

    res.setHeader('Content-Type', resolved.contentType);
    res.setHeader('Cache-Control', resolved.isPublic ? 'public, max-age=300' : 'private, no-cache');
    res.sendFile(resolved.absPath);
  }, 'Failed to load package static asset.');

  deploymentPreview = asyncHandler(async (req: Request, res: Response) => {
    const result = this.pluginsService.getDeploymentPreview(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to load deployment preview.');

  applyDeployment = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.auth?.email ?? 'unknown';
    const actorId = typeof req.auth?.userId === 'number' ? req.auth.userId : null;
    const result = await this.pluginsService.applyDeployment(
      String(req.params.id || ''),
      actor,
      actorId,
    );
    if (result.statusCode) {
      res.status(result.statusCode).json(result.body);
      return;
    }
    res.json(result.body);
  }, 'Failed to apply package deployment.');
}
