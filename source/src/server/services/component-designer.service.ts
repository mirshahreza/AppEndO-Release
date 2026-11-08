import {
  getDesignerDraft,
  getDesignerDraftVersion,
  listDesignerDrafts,
  listDesignerDraftVersions,
} from '../domain/component-designer/drafts';
import {
  deleteWorkspaceDataConnector,
  getWorkspaceDataConnector,
  listWorkspaceDataConnectorSummaries,
  saveConnectorStaticFile,
  toConnectorSummary,
  upsertWorkspaceDataConnector,
} from '../domain/component-designer/connectors/connectorsStore';
import { executeWorkspaceConnectorQuery } from '../domain/component-designer/connectors';
import {
  buildDesignerExportFile,
  parseDesignerExportRequestBody,
} from '../domain/component-designer/export/exportDataFiles';
import { parseXlsxBufferToRows } from '../domain/component-designer/import/xlsxImport';
import {
  guessTabularColumnSchema,
  parseCsvText,
  suggestedNameFromFileName,
} from '../../domain/component-designer/csvExcelImport';
import {
  addDesignerCanvasComment,
  listDesignerCanvasComments,
  resolveDesignerCanvasComment,
} from '../domain/component-designer/canvasCommentsStore';
import {
  assertBuilderFolderAccess,
  canAccessAnyBuilderFolder,
  getBuilderFolderPermissions,
  setBuilderFolderPermissions,
} from '../domain/component-designer/builderFolderPermissions';
import {
  listDesignerDraftAuditLog,
  recordDesignerDraftAuditOnSave,
} from '../domain/component-designer/draftAuditLog';
import type { AddCanvasCommentInput } from '../../domain/component-designer/canvasComments';
import {
  createDesignerComponentStagingPreview,
  getDesignerPublishDiff,
  getDesignerPublishState,
  loadDesignerStagingPreviewPayload,
  publishDesignerComponent,
  resolvePublishedDesignerDraftLookup,
  rollbackDesignerPublishedVersion,
} from './component-designer/publishCoordinator.service';
import {
  computeDesignerComponentUsage,
  listUnusedDesignerComponents,
} from './component-designer/designerComponentUsage.service';
import {
  deleteDesignerDraft,
  duplicateDesignerDraft,
  duplicateShellLayoutDraft,
  saveDesignerDraft,
} from './component-designer/draftCoordinator.service';
import { reconcileDeletedDesignerArtifacts } from './component-designer/designerDeleteCleanup';
import { listDesignerPublishedVersionSummaries } from '../domain/component-designer/publishIo';
import { parsePinnedDesignerLoaderRef } from '../../domain/component-designer/publishLoaderRef';
import { DESIGNER_PALETTE } from '../../domain/component-designer/catalog';
import { buildReusablePaletteItems } from '../../domain/component-designer/reusablePalette';
import { syncCodeToCanvas } from '../../domain/component-designer/codegen';
import { collectBindingDependencies, resolveRuntimeBinding } from '../../domain/component-designer/runtime';
import { writeDesignerPreviewLog } from '../domain/component-designer/storage';
import { normalizeDesignerViewport } from '../../domain/component-designer/state';
import type { DesignerBindingDefinition, DesignerDocument, DesignerWorkspacePrefs } from '../../domain/component-designer/types';
import { validateDesignerDocument } from '../../domain/component-designer/validation';
import { HttpError } from '../errors/HttpError';
import {
  getBuiltInComponentRecord,
  getBuiltInComponentRecordByName,
  isBuiltInComponentId,
  mergeComponentsCatalog,
} from '../../domain/component-designer/layout-presets/builtInComponents';
import {
  parseCatalogKind,
  resolveOperatorCatalogKind,
} from '../../domain/component-designer/layout-presets/catalogSystemTags';
import { isSystemManagedShellLayoutDraft } from '../../shared/lib/designerShellEntry';
import { isRetiredDesignerCatalogComponent } from '../../shared/lib/packageStudioSidebar';
import { normalizeDesignerComponentName } from '../../shared/lib/designerIdentity';
import {
  filterDraftsShadowedByInstalledPackageUi,
  getInstalledPackageUiDraftRecord,
  isPackageUiCatalogId,
  listInstalledPackageUiCatalogSummaries,
  updateInstalledPackageUiDraftRecord,
} from '../services/package-runtime/packageUiCatalog.service';

export type ComponentDesignerServiceDeps = {
  serverPort: number;
};

const normalizeRoles = (roles: readonly string[] | undefined): string[] =>
  (roles ?? []).map((role) => role.trim().toUpperCase()).filter(Boolean);

export class ComponentDesignerService {
  constructor(private readonly deps: ComponentDesignerServiceDeps) {}

  private assertStudioAccess(userRoles: readonly string[]): void {
    if (canAccessAnyBuilderFolder(userRoles)) {
      return;
    }
    throw new HttpError(403, 'Forbidden: no builder studio access.');
  }

  private assertDraftFolderAccess(draftId: string, userRoles: readonly string[]): void {
    if (isBuiltInComponentId(draftId) || isPackageUiCatalogId(draftId)) {
      this.assertStudioAccess(userRoles);
      return;
    }
    const existing = getDesignerDraft(draftId);
    if (!existing) {
      throw new HttpError(404, 'Version not found.');
    }
    assertBuilderFolderAccess(existing.folder, userRoles);
  }

  listDrafts(userRoles: readonly string[] = ['ADMIN']) {
    this.assertStudioAccess(userRoles);
    reconcileDeletedDesignerArtifacts();
    const items = listDesignerDrafts()
      .filter((item) => !isSystemManagedShellLayoutDraft(item))
      .filter((item) => !isRetiredDesignerCatalogComponent(item.name))
      .filter((item) => {
        try {
          assertBuilderFolderAccess(item.folder, userRoles);
          return true;
        } catch {
          return false;
        }
      });
    const packageItems = listInstalledPackageUiCatalogSummaries()
      .filter((item) => !isRetiredDesignerCatalogComponent(item.name));
    const visibleItems = filterDraftsShadowedByInstalledPackageUi(items);
    return { body: { success: true as const, items: mergeComponentsCatalog([...visibleItems, ...packageItems]) } };
  }

  createDraft(payload: Record<string, unknown>, actor: string, userRoles: readonly string[] = ['ADMIN']) {
    this.assertStudioAccess(userRoles);
    const duplicateFromId = typeof payload.duplicateFromId === 'string' ? payload.duplicateFromId : null;

    if (duplicateFromId) {
      this.assertDraftFolderAccess(duplicateFromId, userRoles);
      const draft = duplicateDesignerDraft(
        duplicateFromId,
        typeof payload.name === 'string' ? payload.name : undefined,
        actor,
        typeof payload.folder === 'string' ? payload.folder : undefined,
        Array.isArray(payload.tags) ? payload.tags as string[] : undefined,
      );
      if (typeof payload.folder === 'string') {
        assertBuilderFolderAccess(payload.folder, userRoles);
      } else {
        assertBuilderFolderAccess(draft.folder, userRoles);
      }
      return { statusCode: 201, body: { success: true as const, draft } };
    }

    const folder = typeof payload.folder === 'string' ? payload.folder : undefined;
    assertBuilderFolderAccess(folder, userRoles);

    const draft = saveDesignerDraft({
      id: typeof payload.id === 'string' ? payload.id : undefined,
      name: typeof payload.name === 'string' ? payload.name : 'Untitled Component',
      folder,
      catalogKind: parseCatalogKind(payload.catalogKind),
      tags: Array.isArray(payload.tags) ? payload.tags as string[] : undefined,
      document: payload.document as DesignerDocument | undefined,
      bindingDefinitions: (payload.bindingDefinitions ?? {}) as Record<string, DesignerBindingDefinition>,
      workspace: (() => {
        if (typeof payload.workspace !== 'object' || payload.workspace === null) {
          return undefined;
        }

        const workspacePayload = payload.workspace as Record<string, unknown>;
        const viewport = normalizeDesignerViewport(workspacePayload.viewport);
        return viewport ? { viewport } satisfies DesignerWorkspacePrefs : undefined;
      })(),
      actor,
    });
    return { statusCode: 201, body: { success: true as const, draft } };
  }

  duplicateShellLayout(payload: Record<string, unknown>, actor: string) {
    const sourceShellKey = typeof payload.sourceShellKey === 'string' ? payload.sourceShellKey : '';
    const targetShellKey = typeof payload.targetShellKey === 'string' ? payload.targetShellKey : '';
    if (!sourceShellKey.trim() || !targetShellKey.trim()) {
      throw new HttpError(400, 'sourceShellKey and targetShellKey are required.');
    }

    const draft = duplicateShellLayoutDraft(sourceShellKey, targetShellKey, actor);
    return { statusCode: 201, body: { success: true as const, draft } };
  }

  getDraft(id: string, versionRaw?: string, userRoles: readonly string[] = ['ADMIN']) {
    const requestedVersion = versionRaw && versionRaw.trim().length > 0
      ? Number(versionRaw)
      : undefined;

    if (typeof requestedVersion === 'number' && (!Number.isInteger(requestedVersion) || requestedVersion < 1)) {
      throw new HttpError(400, 'Invalid version.');
    }

    const pinnedLoader = parsePinnedDesignerLoaderRef(id);
    const publishedLookup = resolvePublishedDesignerDraftLookup(id);
    const versionFromLoader = pinnedLoader.publishedVersion;
    // Publish index draftId wins over sanitize(componentPath): folder/name@vN pins often
    // store a different draft id than the path with slashes replaced by dashes.
    const draftIdCandidates = [...new Set(
      [
        publishedLookup?.draftId,
        versionFromLoader ? pinnedLoader.componentPath : null,
        id,
        pinnedLoader.componentPath,
      ].filter((value): value is string => Boolean(value && value.trim())),
    )];

    if (typeof requestedVersion === 'number') {
      for (const draftId of draftIdCandidates) {
        const draft = getDesignerDraftVersion(draftId, requestedVersion);
        if (draft) {
          assertBuilderFolderAccess(draft.folder, userRoles);
          return { body: { success: true as const, draft } };
        }
      }
      throw new HttpError(404, 'Version not found.');
    }

    const pinnedVersion = versionFromLoader ?? publishedLookup?.version;
    if (typeof pinnedVersion === 'number') {
      for (const draftId of draftIdCandidates) {
        const draft = getDesignerDraftVersion(draftId, pinnedVersion);
        if (draft) {
          assertBuilderFolderAccess(draft.folder, userRoles);
          return { body: { success: true as const, draft } };
        }
      }
      throw new HttpError(404, 'Version not found.');
    }

    for (const draftId of draftIdCandidates) {
      const storedDraft = getDesignerDraft(draftId);
      if (storedDraft) {
        assertBuilderFolderAccess(storedDraft.folder, userRoles);
        return { body: { success: true as const, draft: storedDraft } };
      }
    }

    if (isPackageUiCatalogId(id)) {
      this.assertStudioAccess(userRoles);
      const packageDraft = getInstalledPackageUiDraftRecord(id);
      if (!packageDraft) {
        throw new HttpError(404, 'Version not found.');
      }
      return { body: { success: true as const, draft: packageDraft } };
    }

    const builtInDraft = getBuiltInComponentRecord(id) ?? getBuiltInComponentRecordByName(id);
    if (!builtInDraft) {
      throw new HttpError(404, 'Version not found.');
    }

    this.assertStudioAccess(userRoles);
    return { body: { success: true as const, draft: builtInDraft } };
  }

  listVersions(id: string) {
    const storedDraft = getDesignerDraft(id);
    if (!storedDraft) {
      return { body: { success: true as const, items: listDesignerDraftVersions(id) } };
    }

    const publishedVersions = listDesignerPublishedVersionSummaries(storedDraft.id, storedDraft.folder);
    if (publishedVersions.length === 0) {
      return { body: { success: true as const, items: listDesignerDraftVersions(id) } };
    }

    return {
      body: {
        success: true as const,
        items: publishedVersions.map((item) => ({
          id: storedDraft.id,
          name: item.name,
          folder: storedDraft.folder,
          version: item.version,
          createdAt: item.publishedAt,
          updatedAt: item.publishedAt,
          createdBy: item.publishedBy,
          updatedBy: item.publishedBy,
        })),
      },
    };
  }

  getPublishState(id: string, hasUnsavedChanges = false) {
    return { body: { success: true as const, state: getDesignerPublishState(id, { hasUnsavedChanges }) } };
  }

  getPublishDiff(id: string) {
    return { body: { success: true as const, diff: getDesignerPublishDiff(id) } };
  }

  getUsage(id: string) {
    return { body: { success: true as const, usage: computeDesignerComponentUsage(id) } };
  }

  async listUnusedComponents() {
    return { body: { success: true as const, components: await listUnusedDesignerComponents() } };
  }

  publishDraft(id: string, actor: string) {
    return { body: { success: true as const, state: publishDesignerComponent(id, actor) } };
  }

  rollbackDraft(id: string, version: number, actor: string) {
    return { body: { success: true as const, state: rollbackDesignerPublishedVersion(id, version, actor) } };
  }

  createStagingPreview(id: string) {
    return { statusCode: 201, body: { success: true as const, ...createDesignerComponentStagingPreview(id) } };
  }

  getStagingPreview(token: string) {
    const payload = loadDesignerStagingPreviewPayload(token);
    return {
      body: {
        success: true as const,
        preview: {
          componentPath: payload.componentPath,
          document: payload.document,
          bindingDefinitions: payload.bindingDefinitions,
          expiresAt: payload.expiresAt,
        },
      },
    };
  }

  updateDraft(id: string, payload: Record<string, unknown>, actor: string, userRoles: readonly string[] = ['ADMIN']) {
    if (isBuiltInComponentId(id)) {
      this.assertStudioAccess(userRoles);
      const builtIn = getBuiltInComponentRecord(id);
      if (!builtIn) {
        throw new HttpError(404, 'Version not found.');
      }

      const overlayName = normalizeDesignerComponentName(builtIn.name);
      const overlay = listDesignerDrafts().find(
        (item) => normalizeDesignerComponentName(item.name) === overlayName,
      );
      if (overlay && !isBuiltInComponentId(overlay.id)) {
        return this.updateDraft(overlay.id, payload, actor, userRoles);
      }

      const poisonedOverlay = overlay && isBuiltInComponentId(overlay.id)
        ? getDesignerDraft(overlay.id)
        : null;
      const source = poisonedOverlay ?? builtIn;
      const hasDocumentPayload = typeof payload.document === 'object' && payload.document !== null;
      const hasBindingsPayload = typeof payload.bindingDefinitions === 'object' && payload.bindingDefinitions !== null;
      const draft = saveDesignerDraft({
        id: poisonedOverlay?.id,
        name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : source.name,
        folder: 'general',
        catalogKind: typeof payload.catalogKind === 'string'
          ? parseCatalogKind(payload.catalogKind)
          : resolveOperatorCatalogKind({ ...source, isBuiltIn: true }),
        tags: Array.isArray(payload.tags) ? payload.tags as string[] : (source.tags ?? builtIn.tags ?? []),
        document: hasDocumentPayload ? payload.document as DesignerDocument : source.document,
        bindingDefinitions: hasBindingsPayload
          ? payload.bindingDefinitions as Record<string, DesignerBindingDefinition>
          : source.bindingDefinitions,
        actor,
      });
      return { body: { success: true as const, draft: { ...draft, tags: draft.tags ?? [] } } };
    }

    if (isPackageUiCatalogId(id)) {
      this.assertStudioAccess(userRoles);
      const hasDocumentPayload = typeof payload.document === 'object' && payload.document !== null;
      const hasBindingsPayload = typeof payload.bindingDefinitions === 'object' && payload.bindingDefinitions !== null;
      if (!hasDocumentPayload && !hasBindingsPayload) {
        throw new HttpError(400, 'Package UI components can only be updated with document or binding changes.');
      }

      const result = updateInstalledPackageUiDraftRecord(id, {
        document: hasDocumentPayload ? payload.document as DesignerDocument : undefined,
        bindingDefinitions: hasBindingsPayload
          ? payload.bindingDefinitions as Record<string, DesignerBindingDefinition>
          : undefined,
      });
      if (!result.ok) {
        throw new HttpError(400, result.error);
      }

      return { body: { success: true as const, draft: result.draft } };
    }

    const existing = getDesignerDraft(id);
    if (!existing) {
      throw new HttpError(404, 'Version not found.');
    }
    assertBuilderFolderAccess(existing.folder, userRoles);

    const hasDocumentPayload = typeof payload.document === 'object' && payload.document !== null;
    const hasBindingsPayload = typeof payload.bindingDefinitions === 'object' && payload.bindingDefinitions !== null;
    const hasWorkspacePayload = typeof payload.workspace === 'object' && payload.workspace !== null;
    const nextFolder = typeof payload.folder === 'string' ? payload.folder : existing.folder;
    if (nextFolder !== existing.folder) {
      assertBuilderFolderAccess(nextFolder, userRoles);
    }

    const workspace = (() => {
      if (!hasWorkspacePayload) {
        return existing.workspace;
      }

      const workspacePayload = payload.workspace as Record<string, unknown>;
      const viewport = normalizeDesignerViewport(workspacePayload.viewport);
      return viewport ? { viewport } satisfies DesignerWorkspacePrefs : existing.workspace;
    })();

    const isMetadataOnly = !hasDocumentPayload && !hasBindingsPayload;
    const nextDocument = hasDocumentPayload ? payload.document as DesignerDocument : existing.document;
    const draft = saveDesignerDraft({
      id: existing.id,
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : existing.name,
      folder: nextFolder,
      catalogKind: typeof payload.catalogKind === 'string'
        ? parseCatalogKind(payload.catalogKind)
        : existing.catalogKind,
      tags: Array.isArray(payload.tags)
        ? payload.tags as string[]
        : (payload.tags === null ? [] : existing.tags),
      document: nextDocument,
      bindingDefinitions: hasBindingsPayload
        ? payload.bindingDefinitions as Record<string, DesignerBindingDefinition>
        : existing.bindingDefinitions,
      workspace,
      actor,
      expectedStateVersion: typeof payload.expectedStateVersion === 'number'
        ? payload.expectedStateVersion
        : (isMetadataOnly ? existing.metadata.stateVersion : undefined),
      preserveStateVersion: isMetadataOnly,
    });

    if (hasDocumentPayload) {
      recordDesignerDraftAuditOnSave({
        draftId: existing.id,
        actor,
        previousDocument: existing.document,
        nextDocument,
      });
    }

    return { body: { success: true as const, draft: { ...draft, tags: draft.tags ?? [] } } };
  }

  deleteDraft(id: string, userRoles: readonly string[] = ['ADMIN']) {
    if (isBuiltInComponentId(id)) {
      throw new HttpError(400, 'Built-in components cannot be deleted.');
    }

    if (isPackageUiCatalogId(id)) {
      throw new HttpError(400, 'Installed package UI components cannot be deleted from Client Components. Uninstall the package instead.');
    }

    this.assertDraftFolderAccess(id, userRoles);
    const deleted = deleteDesignerDraft(id);
    if (!deleted) {
      throw new HttpError(404, 'Version not found.');
    }
    return { body: { success: true as const } };
  }

  async previewRuntime(traceId: string, payload: Record<string, unknown>) {
    const rawBindingDefinitions = payload.bindingDefinitions;
    const context = typeof payload.context === 'object' && payload.context !== null ? payload.context : {};
    const bindingDefinitions = rawBindingDefinitions && typeof rawBindingDefinitions === 'object'
      ? rawBindingDefinitions as Record<string, DesignerBindingDefinition>
      : {};

    const bindingKeys = Object.keys(bindingDefinitions);
    const bindingSet = new Set(bindingKeys);
    const dependencyMap = new Map<string, string[]>();
    const graph = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    const blockedByDependency = new Set<string>();
    const cycleBindings = new Set<string>();
    const diagnostics: Array<Record<string, unknown>> = [];
    const results: Record<string, unknown> = {};
    const logs: Array<Record<string, unknown>> = [];

    for (const key of bindingKeys) {
      indegree.set(key, 0);
      graph.set(key, []);
    }

    for (const [bindingKey, definition] of Object.entries(bindingDefinitions)) {
      const dependencies = collectBindingDependencies(definition);
      dependencyMap.set(bindingKey, dependencies);

      const unresolvedDeps = dependencies.filter((item) => !bindingSet.has(item));
      if (unresolvedDeps.length > 0) {
        blockedByDependency.add(bindingKey);
        diagnostics.push({
          id: `binding-dependency:${bindingKey}`,
          code: 'binding-dependency',
          level: 'error',
          field: bindingKey,
          message: `Binding '${bindingKey}' references unknown dependencies: ${unresolvedDeps.join(', ')}.`,
          traceId,
        });
      }

      const internalDeps = dependencies.filter((item) => bindingSet.has(item) && item !== bindingKey);
      for (const dep of internalDeps) {
        graph.get(dep)?.push(bindingKey);
        indegree.set(bindingKey, (indegree.get(bindingKey) ?? 0) + 1);
      }
    }

    const queue = bindingKeys.filter((item) => (indegree.get(item) ?? 0) === 0);
    const resolutionOrder: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      resolutionOrder.push(current);
      for (const next of graph.get(current) ?? []) {
        const nextDegree = (indegree.get(next) ?? 0) - 1;
        indegree.set(next, nextDegree);
        if (nextDegree === 0) {
          queue.push(next);
        }
      }
    }

    if (resolutionOrder.length !== bindingKeys.length) {
      for (const key of bindingKeys) {
        if (!resolutionOrder.includes(key)) {
          cycleBindings.add(key);
        }
      }
      diagnostics.push({
        id: 'binding-dependency:cycle',
        code: 'binding-dependency',
        level: 'error',
        message: `Binding dependency cycle detected: ${[...cycleBindings].join(', ')}.`,
        traceId,
      });
    }

    const baseUrl = `http://127.0.0.1:${this.deps.serverPort}`;
    const fetchImpl = (input: string, init?: RequestInit) => {
      const absolute = /^https?:\/\//i.test(input)
        ? input
        : `${baseUrl}${input.startsWith('/') ? input : `/${input}`}`;
      return fetch(absolute, init);
    };

    const resolvedBindings = {
      ...((context as Record<string, unknown>).bindings && typeof (context as Record<string, unknown>).bindings === 'object'
        ? (context as Record<string, unknown>).bindings as Record<string, unknown>
        : {}),
    };

    const blockedKeys = new Set<string>([...blockedByDependency, ...cycleBindings]);
    const activeOrder = resolutionOrder.filter((item) => !blockedKeys.has(item));
    let sequence = 0;

    for (const bindingKey of activeOrder) {
      const definition = bindingDefinitions[bindingKey];
      if (!definition) {
        continue;
      }

      sequence += 1;
      const resolved = await resolveRuntimeBinding(definition, {
        fetchImpl,
        context: {
          ...(context as Record<string, unknown>),
          bindings: resolvedBindings,
        },
      });

      results[bindingKey] = resolved.value;
      resolvedBindings[bindingKey] = resolved.value;
      diagnostics.push(...resolved.diagnostics.map((item) => ({ ...item, field: item.field ?? bindingKey, traceId })));
      logs.push({ traceId, sequence, bindingKey, dependencies: dependencyMap.get(bindingKey) ?? [], ...resolved.log });
    }

    for (const bindingKey of blockedKeys) {
      const definition = bindingDefinitions[bindingKey];
      results[bindingKey] = definition?.fallbackValue ?? null;
      sequence += 1;
      logs.push({
        traceId,
        sequence,
        bindingKey,
        dependencies: dependencyMap.get(bindingKey) ?? [],
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        endpoint: definition?.endpointRef ?? definition?.sourcePath ?? 'unknown',
        method: definition?.requestConfig?.method ?? 'GET',
        attempts: 0,
        ok: false,
        durationMs: 0,
        errorCode: 'binding-invalid',
        errorMessage: cycleBindings.has(bindingKey)
          ? `Skipped because '${bindingKey}' is part of a dependency cycle.`
          : `Skipped because '${bindingKey}' has unresolved dependencies.`,
      });
    }

    let previewLogPath: string | null = null;
    try {
      previewLogPath = writeDesignerPreviewLog({
        traceId,
        createdAt: new Date().toISOString(),
        diagnosticsCount: diagnostics.length,
        bindingCount: bindingKeys.length,
        entries: logs,
      });
    } catch {
      previewLogPath = null;
    }

    return {
      statusCode: diagnostics.length > 0 ? 207 : 200,
      body: {
        success: diagnostics.length === 0,
        traceId,
        results,
        diagnostics,
        logs,
        previewLogPath,
      },
    };
  }

  validateDocument(document: unknown) {
    if (!document || typeof document !== 'object' || !(document as DesignerDocument).rootNodeId || !(document as DesignerDocument).nodes) {
      throw new HttpError(400, 'Invalid or missing document payload.');
    }
    const diagnostics = validateDesignerDocument(document as DesignerDocument);
    return {
      statusCode: diagnostics.length > 0 ? 207 : 200,
      body: { success: diagnostics.length === 0, diagnostics },
    };
  }

  systemComponentsCatalog() {
    const items = DESIGNER_PALETTE.filter((item) => item.sourceType === 'system');
    return { body: { success: true as const, items } };
  }

  reusableComponentsCatalog() {
    const packageItems = listInstalledPackageUiCatalogSummaries()
      .filter((item) => !isRetiredDesignerCatalogComponent(item.name));
    const visibleDrafts = filterDraftsShadowedByInstalledPackageUi(
      listDesignerDrafts()
        .filter((item) => !isSystemManagedShellLayoutDraft(item))
        .filter((item) => !isRetiredDesignerCatalogComponent(item.name)),
    );
    const items = mergeComponentsCatalog([
      ...visibleDrafts,
      ...packageItems,
    ]);
    const paletteItems = buildReusablePaletteItems(
      items.map((draft) => ({
        id: draft.id,
        name: draft.name,
        folder: draft.folder,
      })),
    );
    return { body: { success: true as const, items: paletteItems } };
  }

  syncCodeToCanvas(payload: Record<string, unknown>) {
    const format = payload.format;
    const code = payload.code;

    if ((format !== 'json' && format !== 'tsx') || typeof code !== 'string') {
      throw new HttpError(400, 'Invalid payload. Expected format (json|tsx) and code string.');
    }

    const result = syncCodeToCanvas({ format, code });
    if ('diagnostics' in result) {
      return { statusCode: 207, body: { success: false, diagnostics: result.diagnostics } };
    }

    return {
      body: {
        success: true as const,
        document: result.document,
        bindingDefinitions: result.bindingDefinitions,
      },
    };
  }

  listDataConnectors() {
    return {
      body: {
        success: true as const,
        items: listWorkspaceDataConnectorSummaries(),
      },
    };
  }

  upsertDataConnector(payload: Record<string, unknown>, createId?: string) {
    const connector = upsertWorkspaceDataConnector(payload, { createId });
    return {
      statusCode: createId || !payload.id ? 201 : 200,
      body: {
        success: true as const,
        connector: toConnectorSummary(connector),
      },
    };
  }

  deleteDataConnector(id: string) {
    deleteWorkspaceDataConnector(id);
    return { body: { success: true as const } };
  }

  async queryDataConnector(id: string, payload: Record<string, unknown>, query: Record<string, unknown>) {
    const readString = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;

    const result = await executeWorkspaceConnectorQuery({
      connectorId: id,
      path: readString(payload.path) ?? readString(query.path),
      method: readString(payload.method),
      query: isStringRecord(payload.query) ? payload.query : undefined,
      graphqlQuery: readString(payload.graphqlQuery) ?? readString(payload.queryText),
      graphqlVariables: isPlainObject(payload.graphqlVariables) ? payload.graphqlVariables : undefined,
      staticFilePath: readString(payload.staticFilePath) ?? readString(query.file),
      staticFileFormat: payload.staticFileFormat === 'csv' || payload.staticFileFormat === 'json'
        ? payload.staticFileFormat
        : undefined,
      responseMapping: isPlainObject(payload.responseMapping)
        ? payload.responseMapping as import('../../domain/component-designer/types').DesignerResponseMapping
        : undefined,
      op: query.op === 'detail' || payload.op === 'detail' ? 'detail' : 'list',
      primaryKey: readString(payload.primaryKey) ?? readString(query.primaryKey),
      id: readString(payload.id) ?? readString(query.id),
    });

    return {
      body: {
        success: true as const,
        data: result.data,
        total: result.total,
      },
    };
  }

  uploadDataConnectorFile(id: string, fileName: string, contents: Buffer) {
    const connector = getWorkspaceDataConnector(id);
    if (!connector) {
      throw new HttpError(404, `Connector "${id}" was not found.`);
    }
    if (connector.connectorType !== 'static-file') {
      throw new HttpError(400, 'File upload is only supported for static-file connectors.');
    }

    const lower = fileName.toLowerCase();
    let savedName = fileName;
    let savedContents: Buffer | string = contents;
    let format: 'csv' | 'json' = lower.endsWith('.csv') ? 'csv' : 'json';

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const rows = parseXlsxBufferToRows(contents);
      savedName = fileName.replace(/\.(xlsx|xls)$/i, '.json');
      savedContents = JSON.stringify(rows, null, 2);
      format = 'json';
    }

    const saved = saveConnectorStaticFile(id, savedName, savedContents);
    const updated = upsertWorkspaceDataConnector({
      ...connector,
      staticFilePath: saved.relativePath,
      staticFileFormat: format,
    });

    return {
      body: {
        success: true as const,
        relativePath: saved.relativePath,
        connector: toConnectorSummary(updated),
      },
    };
  }

  importTabularFile(fileName: string, contents: Buffer) {
    const lower = fileName.toLowerCase();
    let rows: Record<string, unknown>[];
    let format: 'csv' | 'xlsx' | 'json';

    if (lower.endsWith('.csv')) {
      rows = parseCsvText(contents.toString('utf8'));
      format = 'csv';
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      rows = parseXlsxBufferToRows(contents);
      format = 'xlsx';
    } else if (lower.endsWith('.json')) {
      const parsed = JSON.parse(contents.toString('utf8')) as unknown;
      if (!Array.isArray(parsed)) {
        throw new HttpError(400, 'JSON import must be an array of row objects.');
      }
      rows = parsed.map((entry) => (
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? entry as Record<string, unknown>
          : {}
      ));
      format = 'json';
    } else {
      throw new HttpError(400, 'Only .csv, .xlsx, or .json files are accepted.');
    }

    const columns = guessTabularColumnSchema(rows);
    return {
      body: {
        success: true as const,
        format,
        rows,
        columns,
        suggestedName: suggestedNameFromFileName(fileName),
      },
    };
  }

  async exportDesignerData(body: unknown) {
    try {
      const request = parseDesignerExportRequestBody(body);
      return await buildDesignerExportFile(request);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid export request.');
    }
  }

  listDraftComments(draftId: string, userRoles: readonly string[] = ['ADMIN']) {
    this.assertDraftFolderAccess(draftId, userRoles);
    return { body: { success: true as const, comments: listDesignerCanvasComments(draftId) } };
  }

  addDraftComment(
    draftId: string,
    payload: Record<string, unknown>,
    actor: string,
    userRoles: readonly string[] = ['ADMIN'],
  ) {
    this.assertDraftFolderAccess(draftId, userRoles);
    const comment = addDesignerCanvasComment(draftId, payload as AddCanvasCommentInput, actor);
    return { statusCode: 201, body: { success: true as const, comment } };
  }

  resolveDraftComment(
    draftId: string,
    commentId: string,
    actor: string,
    userRoles: readonly string[] = ['ADMIN'],
  ) {
    this.assertDraftFolderAccess(draftId, userRoles);
    const comment = resolveDesignerCanvasComment(draftId, commentId, actor);
    return { body: { success: true as const, comment } };
  }

  listDraftAuditLog(draftId: string, userRoles: readonly string[] = ['ADMIN']) {
    this.assertDraftFolderAccess(draftId, userRoles);
    return { body: { success: true as const, entries: listDesignerDraftAuditLog(draftId) } };
  }

  getFolderPermissions(userRoles: readonly string[] = ['ADMIN']) {
    this.assertStudioAccess(userRoles);
    const file = getBuilderFolderPermissions();
    return {
      body: {
        success: true as const,
        defaultRoles: file.defaultRoles,
        folderPermissions: file.folderPermissions,
        updatedAt: file.updatedAt,
      },
    };
  }

  updateFolderPermissions(payload: Record<string, unknown>, userRoles: readonly string[] = ['ADMIN']) {
    const roles = normalizeRoles(userRoles);
    if (!roles.includes('ADMIN')) {
      throw new HttpError(403, 'Only ADMIN can update builder folder permissions.');
    }
    const file = setBuilderFolderPermissions({
      defaultRoles: Array.isArray(payload.defaultRoles) ? payload.defaultRoles as string[] : undefined,
      folderPermissions: (
        payload.folderPermissions
        && typeof payload.folderPermissions === 'object'
        && !Array.isArray(payload.folderPermissions)
      )
        ? payload.folderPermissions as Record<string, string[]>
        : undefined,
    });
    return {
      body: {
        success: true as const,
        defaultRoles: file.defaultRoles,
        folderPermissions: file.folderPermissions,
        updatedAt: file.updatedAt,
      },
    };
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === 'string');
};
