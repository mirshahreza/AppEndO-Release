import type { Request, Response } from 'express';
import type {
  CreatePlatformMountPayload,
  CreatePlatformPageModulePayload,
  CreatePlatformRouteBindingPayload,
  CreatePlatformShellPayload,
  CreatePlatformShellRulePayload,
  UpdatePlatformMountPayload,
  UpdatePlatformPageModulePayload,
  UpdatePlatformRouteBindingPayload,
  UpdatePlatformShellPayload,
  UpdatePlatformShellRulePayload,
} from '../../shared/api/contracts/platform/types';
import type { UpdatePlatformCulturesPayload } from '../../shared/api/contracts/platform/cultures';
import type { UpdatePlatformCultureTranslationsPayload } from '../../shared/api/contracts/platform/cultureTranslations';
import type { ExperienceManifest } from '../../shared/api/contracts/platform/experienceManifest';
import type { StudioMountExportRequest } from '../../shared/api/contracts/platform/studioMountExport';
import type { PlatformCrudService } from '../services/platform/platformCrud.service';
import { getPlatformRuntimeConfig } from '../services/platform/platformRuntimeConfig.service';
import type { PlatformCultureSettingsService } from '../services/platform/platformCultureSettings.service';
import type { PlatformCultureTranslationsService } from '../services/platform/platformCultureTranslations.service';
import {
  buildStudioMountExport,
  discoverStudioMountExport,
  previewStudioMountExport,
} from '../services/platform/studioPackageExport.service';
import { getDefaultExperienceManifestService } from '../services/platform/experienceManifest.service';
import {
  appendDesignerPageToPortalMenu,
  createPortal as createPortalRecord,
  deletePortal as deletePortalRecord,
  duplicatePortal as duplicatePortalRecord,
  updatePortal as updatePortalRecord,
  uploadPortalLogo as uploadPortalLogoRecord,
} from '../services/platform/portal.service';
import {
  createNavigationManifest,
  deleteNavigationManifest,
  getNavigationManifestSummary,
  listNavigationManifestSummaries,
  renameNavigationManifest,
  updateNavigationManifest,
} from '../services/platform/navigationManifest.service';
import type { ExperienceManifestPortal } from '../../shared/api/contracts/platform/experienceManifest';
import { asyncHandler } from '../utils/asyncHandler';
import { toActorContext } from '../utils/requestContext';

export class PlatformController {
  constructor(
    private readonly platformCrudService: PlatformCrudService,
    private readonly platformCultureSettingsService: PlatformCultureSettingsService,
    private readonly platformCultureTranslationsService: PlatformCultureTranslationsService,
  ) {}

  getRuntimeConfig = asyncHandler(async (_req: Request, res: Response) => {
    const config = await getPlatformRuntimeConfig();
    res.json({ success: true, ...config });
  }, 'Failed to load platform runtime config.');

  getCultures = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.platformCultureSettingsService.getCultures();
    res.json(result.body);
  }, 'Failed to load platform cultures.');

  updateCultures = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCultureSettingsService.updateCultures(
      (req.body || {}) as UpdatePlatformCulturesPayload,
    );
    res.json(result.body);
  }, 'Failed to update platform cultures.');

  getCultureTranslationBundle = asyncHandler(async (req: Request, res: Response) => {
    const result = this.platformCultureTranslationsService.getCultureTranslationBundle(
      String(req.params.bundleId || ''),
    );
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.json(result.body);
  }, 'Failed to load culture translation bundle.');

  getCultureTranslations = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.platformCultureTranslationsService.getTranslations();
    res.json(result.body);
  }, 'Failed to load culture translations.');

  updateCultureTranslations = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCultureTranslationsService.updateTranslations(
      (req.body || {}) as UpdatePlatformCultureTranslationsPayload,
    );
    res.json(result.body);
  }, 'Failed to update culture translations.');

  listMounts = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.platformCrudService.listMounts();
    res.json(result.body);
  }, 'Failed to list platform mounts.');

  getMount = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.getMount(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to load platform mount.');

  createMount = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.createMount(
      toActorContext(req, true),
      (req.body || {}) as CreatePlatformMountPayload,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create platform mount.');

  updateMount = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.updateMount(
      toActorContext(req, true),
      String(req.params.id || ''),
      (req.body || {}) as UpdatePlatformMountPayload,
    );
    res.json(result.body);
  }, 'Failed to update platform mount.');

  deleteMount = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.deleteMount(String(req.params.id || ''));
    res.json(result.body);
  }, 'Failed to delete platform mount.');

  listShells = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.platformCrudService.listShells();
    res.json(result.body);
  }, 'Failed to list platform shells.');

  getShell = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.getShell(String(req.params.shellKey || ''));
    res.json(result.body);
  }, 'Failed to load platform shell.');

  createShell = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.createShell(
      toActorContext(req, true),
      (req.body || {}) as CreatePlatformShellPayload,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create platform shell.');

  updateShell = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.updateShell(
      toActorContext(req, true),
      String(req.params.shellKey || ''),
      (req.body || {}) as UpdatePlatformShellPayload,
    );
    res.json(result.body);
  }, 'Failed to update platform shell.');

  deleteShell = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.deleteShell(String(req.params.shellKey || ''));
    res.json(result.body);
  }, 'Failed to delete platform shell.');

  listPageModules = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.platformCrudService.listPageModules();
    res.json(result.body);
  }, 'Failed to list platform page modules.');

  getPageModule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.getPageModule(String(req.params.pageKey || ''));
    res.json(result.body);
  }, 'Failed to load platform page module.');

  createPageModule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.createPageModule(
      toActorContext(req, true),
      (req.body || {}) as CreatePlatformPageModulePayload,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create platform page module.');

  updatePageModule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.updatePageModule(
      toActorContext(req, true),
      String(req.params.pageKey || ''),
      (req.body || {}) as UpdatePlatformPageModulePayload,
    );
    res.json(result.body);
  }, 'Failed to update platform page module.');

  deletePageModule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.deletePageModule(String(req.params.pageKey || ''));
    res.json(result.body);
  }, 'Failed to delete platform page module.');

  listShellRules = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.platformCrudService.listShellRules();
    res.json(result.body);
  }, 'Failed to list platform shell rules.');

  getShellRule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.getShellRule(Number(req.params.id));
    res.json(result.body);
  }, 'Failed to load platform shell rule.');

  createShellRule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.createShellRule(
      toActorContext(req, true),
      (req.body || {}) as CreatePlatformShellRulePayload,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create platform shell rule.');

  updateShellRule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.updateShellRule(
      toActorContext(req, true),
      Number(req.params.id),
      (req.body || {}) as UpdatePlatformShellRulePayload,
    );
    res.json(result.body);
  }, 'Failed to update platform shell rule.');

  deleteShellRule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.deleteShellRule(Number(req.params.id));
    res.json(result.body);
  }, 'Failed to delete platform shell rule.');

  listRouteBindings = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.platformCrudService.listRouteBindings();
    res.json(result.body);
  }, 'Failed to list platform route bindings.');

  getRouteBinding = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.getRouteBinding(Number(req.params.id));
    res.json(result.body);
  }, 'Failed to load platform route binding.');

  createRouteBinding = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.createRouteBinding(
      toActorContext(req, true),
      (req.body || {}) as CreatePlatformRouteBindingPayload,
    );
    res.status(result.statusCode || 200).json(result.body);
  }, 'Failed to create platform route binding.');

  updateRouteBinding = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.updateRouteBinding(
      toActorContext(req, true),
      Number(req.params.id),
      (req.body || {}) as UpdatePlatformRouteBindingPayload,
    );
    res.json(result.body);
  }, 'Failed to update platform route binding.');

  deleteRouteBinding = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.platformCrudService.deleteRouteBinding(Number(req.params.id));
    res.json(result.body);
  }, 'Failed to delete platform route binding.');

  previewMountExport = asyncHandler(async (req: Request, res: Response) => {
    const mountId = String(req.params.id || '');
    const preview = await previewStudioMountExport(mountId, (req.body || {}) as StudioMountExportRequest);
    if ('ok' in preview && preview.ok === false) {
      res.status(400).json({
        success: false,
        error: preview.error,
        details: preview.details,
      });
      return;
    }
    res.json({ success: true, preview });
  }, 'Failed to preview mount package export.');

  discoverMountExport = asyncHandler(async (req: Request, res: Response) => {
    const mountId = String(req.params.id || '');
    const discovered = await discoverStudioMountExport(mountId);
    if ('ok' in discovered && discovered.ok === false) {
      res.status(400).json({
        success: false,
        error: discovered.error,
        details: discovered.details,
      });
      return;
    }
    res.json({ success: true, discover: discovered });
  }, 'Failed to discover mount export sources.');

  downloadMountExport = asyncHandler(async (req: Request, res: Response) => {
    const mountId = String(req.params.id || '');
    const built = await buildStudioMountExport(mountId, (req.body || {}) as StudioMountExportRequest);
    if (!built.ok) {
      res.status(400).json({
        success: false,
        error: built.error,
        details: built.details,
      });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${built.fileName}"`);
    res.send(built.buffer);
  }, 'Failed to export mount package.');

  getExperienceManifest = asyncHandler(async (req: Request, res: Response) => {
    const manifestId = typeof req.query.id === 'string' ? req.query.id : undefined;
    const result = await getDefaultExperienceManifestService().getManifest(manifestId);
    if (!result.manifest) {
      res.status(404).json({ success: false, error: 'Experience manifest not found.' });
      return;
    }
    res.json({ success: true, manifest: result.manifest });
  }, 'Failed to load experience manifest.');

  compileExperienceManifest = asyncHandler(async (req: Request, res: Response) => {
    const result = await getDefaultExperienceManifestService().compileManifest(
      toActorContext(req, true),
      (req.body || {}) as ExperienceManifest,
    );
    if (!result.ok) {
      res.status(400).json({ success: false, errors: result.errors });
      return;
    }
    res.json({ success: true, manifest: result.manifest, compile: result.result });
  }, 'Failed to compile experience manifest.');

  createPortal = asyncHandler(async (req: Request, res: Response) => {
    const portal = await createPortalRecord(
      (req.body || {}) as ExperienceManifestPortal,
      toActorContext(req, true),
    );
    res.status(201).json({ success: true, portal });
  }, 'Failed to create portal.');

  updatePortal = asyncHandler(async (req: Request, res: Response) => {
    const segment = typeof req.params.segment === 'string' ? req.params.segment : '';
    const portal = await updatePortalRecord(
      segment,
      (req.body || {}) as ExperienceManifestPortal,
      toActorContext(req, true),
    );
    res.json({ success: true, portal });
  }, 'Failed to update portal.');

  deletePortal = asyncHandler(async (req: Request, res: Response) => {
    const segment = typeof req.params.segment === 'string' ? req.params.segment : '';
    await deletePortalRecord(segment, toActorContext(req, true));
    res.json({ success: true });
  }, 'Failed to delete portal.');

  duplicatePortal = asyncHandler(async (req: Request, res: Response) => {
    const segment = typeof req.params.segment === 'string' ? req.params.segment : '';
    const targetSegment = typeof req.body?.segment === 'string' ? req.body.segment : '';
    const targetName = typeof req.body?.name === 'string' ? req.body.name : '';
    const portal = await duplicatePortalRecord(
      segment,
      toActorContext(req, true),
      { targetSegment, targetName },
    );
    res.status(201).json({ success: true, portal });
  }, 'Failed to duplicate portal.');

  uploadPortalLogo = asyncHandler(async (req: Request, res: Response) => {
    const segment = typeof req.params.segment === 'string' ? req.params.segment : '';
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded. Send an image as multipart field "file".' });
      return;
    }

    try {
      const result = await uploadPortalLogoRecord(segment, file.originalname, file.buffer);
      res.json({ success: true, url: result.url });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to upload portal logo.';
      const notFound = message.toLowerCase().includes('not found');
      res.status(notFound ? 404 : 400).json({ success: false, error: message });
    }
  }, 'Failed to upload portal logo.');

  appendPortalPageMenu = asyncHandler(async (req: Request, res: Response) => {
    const segment = typeof req.params.segment === 'string' ? req.params.segment : '';
    const pageKey = typeof req.body?.pageKey === 'string' ? req.body.pageKey : '';
    const path = typeof req.body?.path === 'string' ? req.body.path : undefined;
    const navLabel = typeof req.body?.navLabel === 'string' ? req.body.navLabel : '';
    const loaderRef = typeof req.body?.loaderRef === 'string' ? req.body.loaderRef : undefined;
    const portal = await appendDesignerPageToPortalMenu(
      segment,
      { pageKey, path, navLabel, loaderRef },
      toActorContext(req, true),
    );
    res.json({ success: true, portal });
  }, 'Failed to add page to portal menu.');

  listNavigations = asyncHandler(async (req: Request, res: Response) => {
    const portalSegment = typeof req.query.portalSegment === 'string'
      ? req.query.portalSegment
      : undefined;
    const navigations = listNavigationManifestSummaries(portalSegment);
    res.json({ success: true, navigations });
  }, 'Failed to list navigation manifests.');

  getNavigation = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    const manifest = getNavigationManifestSummary(id);
    if (!manifest) {
      res.status(404).json({ success: false, error: `Navigation "${id}" not found.` });
      return;
    }
    res.json({ success: true, manifest });
  }, 'Failed to load navigation manifest.');

  createNavigation = asyncHandler(async (req: Request, res: Response) => {
    const result = await createNavigationManifest(req.body);
    if (!result.ok) {
      res.status(result.statusCode).json({
        success: false,
        error: result.error,
        errors: result.errors,
      });
      return;
    }
    res.status(201).json({ success: true, manifest: result.manifest });
  }, 'Failed to create navigation manifest.');

  updateNavigation = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    const result = await updateNavigationManifest(id, req.body);
    if (!result.ok) {
      res.status(result.statusCode).json({
        success: false,
        error: result.error,
        errors: result.errors,
      });
      return;
    }
    res.json({ success: true, manifest: result.manifest });
  }, 'Failed to update navigation manifest.');

  renameNavigation = asyncHandler(async (req: Request, res: Response) => {
    const oldId = String(req.params.id || '').trim();
    const newId = typeof req.body?.id === 'string' ? req.body.id : '';
    const result = await renameNavigationManifest(oldId, newId);
    if (!result.ok) {
      res.status(result.statusCode).json({
        success: false,
        error: result.error,
        errors: result.errors,
      });
      return;
    }
    res.json({ success: true, manifest: result.manifest });
  }, 'Failed to rename navigation manifest.');

  deleteNavigation = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    const replacementNavigationRef = req.body?.replacementNavigationRef;
    const result = await deleteNavigationManifest(id, {
      replacementNavigationRef: replacementNavigationRef === undefined
        ? undefined
        : (typeof replacementNavigationRef === 'string'
          ? replacementNavigationRef
          : null),
    });
    if (!result.ok) {
      res.status(result.statusCode).json({
        success: false,
        error: result.error,
        errors: result.errors,
      });
      return;
    }
    res.json({ success: true, manifest: result.manifest });
  }, 'Failed to delete navigation manifest.');
}
