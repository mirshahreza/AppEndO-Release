import fs from 'fs';
import path from 'path';
import { atomicWriteText, buildPackageDisplayNameMap } from '../../../core/packages/PackageFileStore';
import { createDefaultBindingDefinitions } from '../../../domain/component-designer/bindingRegistry';
import { generateDesignerTsx, syncCodeToCanvas } from '../../../domain/component-designer/codegen';
import { createInitialDesignerState } from '../../../domain/component-designer/state';
import type { DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import {
  buildDesignerComponentPath,
  parseDesignerComponentPath,
} from '../../../shared/lib/designerComponentPath';
import type { DesignerVersionRecord, DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import { normalizeDesignerComponentName } from '../../../shared/lib/designerIdentity';
import { normalizeComponentFolder } from '../../../shared/lib/designerIdentity';
import { ensurePackageUiModuleDefaultExport } from '../../../shared/packages/packageUiModuleExport';
import { getEnabledInstalledVersionsMap, getRetainedPackageUiVersionsMap } from '../../domain/package-domain/installStateRepository';
import { readObjectRegistry } from '../../domain/package-domain/objectRegistryRepository';
import type { UiRegistryRecord } from '../../domain/package-domain/types';
import { buildDesignerComponentExportBundle } from '../package/packageComponentExport.service';
import { resolveRuntimeEntryPath } from './packageUiRuntime.service';

export type PackageUiCatalogEntry = {
  packageId: string;
  version: string;
  ui: UiRegistryRecord;
};

const encodeComponentKeyForCatalogId = (componentKey: string): string => (
  componentKey.trim().replace(/\//g, '--')
);

export function buildPackageUiCatalogId(packageId: string, componentKey: string): string {
  return `pkg-ui-${packageId}-${encodeComponentKeyForCatalogId(componentKey)}`;
}

export function normalizePackageUiComponentKey(componentKey: string): string {
  return componentKey.trim().replace(/^\/+/, '');
}

export function buildInstalledPackageUiComponentKeySet(): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const item of listInstalledPackageUiCatalogSummaries()) {
    keys.add(normalizePackageUiComponentKey(item.componentKey));
  }
  return keys;
}

/** Hide local designer drafts that duplicate an installed package UI component path. */
export function filterDraftsShadowedByInstalledPackageUi<T extends Pick<
  DesignerVersionSummary,
  'name' | 'folder' | 'isPackageComponent' | 'isBuiltIn'
>>(
  drafts: T[],
  installedKeys: ReadonlySet<string> = buildInstalledPackageUiComponentKeySet(),
): T[] {
  if (installedKeys.size === 0) {
    return drafts;
  }

  return drafts.filter((draft) => {
    if (draft.isPackageComponent || draft.isBuiltIn) {
      return true;
    }

    const componentPath = normalizePackageUiComponentKey(
      buildDesignerComponentPath(draft.folder ?? 'general', draft.name),
    );
    return !installedKeys.has(componentPath);
  });
}

export function isPackageUiCatalogId(catalogId: string): boolean {
  return catalogId.trim().startsWith('pkg-ui-');
}

export type InstalledPackageUiCatalogSummary = DesignerVersionSummary & {
  isPackageComponent: true;
  packageId: string;
  packageDisplayName: string;
  componentKey: string;
  packageVersion: string;
};

function resolvePackageUiFolderAndName(componentKey: string): { folder: string; name: string } {
  const parsed = parseDesignerComponentPath(componentKey);
  if (parsed) {
    return {
      folder: normalizeComponentFolder(parsed.folder),
      name: normalizeDesignerComponentName(parsed.componentName),
    };
  }

  const normalized = componentKey.trim().replace(/^\/+/, '');
  return {
    folder: 'packages',
    name: normalizeDesignerComponentName(normalized.replace(/\//g, '-')),
  };
}

function readPackageUiSourceUpdatedAt(
  packageId: string,
  version: string,
  entry: string,
  fallback: string,
): string {
  const absPath = resolveRuntimeEntryPath(packageId, version, entry);
  if (!absPath || !fs.existsSync(absPath)) {
    return fallback;
  }

  return new Date(fs.statSync(absPath).mtimeMs).toISOString();
}

export function listInstalledPackageUiCatalogSummaries(): InstalledPackageUiCatalogSummary[] {
  const enabledMap = getEnabledInstalledVersionsMap();
  const retainedMap = getRetainedPackageUiVersionsMap();
  const items: InstalledPackageUiCatalogSummary[] = [];

  const packageVersions = new Map<string, string>();
  for (const [packageId, version] of enabledMap.entries()) {
    packageVersions.set(packageId, version);
  }
  for (const [packageId, version] of retainedMap.entries()) {
    if (!packageVersions.has(packageId)) {
      packageVersions.set(packageId, version);
    }
  }

  const displayNames = buildPackageDisplayNameMap();

  for (const [packageId, version] of packageVersions.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry || registry.records.uiComponents.length === 0) {
      continue;
    }

    for (const ui of registry.records.uiComponents) {
      const { folder, name } = resolvePackageUiFolderAndName(ui.componentKey);
      const registeredAt = ui.registeredAt || registry.updatedAt;
      items.push({
        id: buildPackageUiCatalogId(packageId, ui.componentKey),
        name,
        folder,
        createdAt: registeredAt,
        updatedAt: readPackageUiSourceUpdatedAt(packageId, version, ui.entry, registeredAt),
        createdBy: packageId,
        updatedBy: packageId,
        isPackageComponent: true,
        packageId,
        packageDisplayName: displayNames.get(packageId) ?? packageId,
        componentKey: ui.componentKey,
        packageVersion: version,
      });
    }
  }

  return items.sort((left, right) => (
    right.updatedAt.localeCompare(left.updatedAt)
    || left.packageId.localeCompare(right.packageId)
    || left.componentKey.localeCompare(right.componentKey)
  ));
}

function buildPackageUiDraftDocument(
  catalogId: string,
  name: string,
  source: string,
): { document: DesignerDocument; bindingDefinitions: DesignerBindingDefinitions } {
  const baseState = createInitialDesignerState();
  const baseDocument: DesignerDocument = {
    ...baseState.document,
    id: catalogId,
    name,
    metadata: {
      ...baseState.document.metadata,
      createdAt: baseState.document.metadata.createdAt,
      updatedAt: new Date().toISOString(),
    },
  };
  const baseBindings = createDefaultBindingDefinitions();

  const syncResult = syncCodeToCanvas({
    format: 'tsx',
    code: source,
    currentDocument: baseDocument,
    currentBindingDefinitions: baseBindings,
  });

  if (syncResult.ok) {
    return {
      document: syncResult.document,
      bindingDefinitions: syncResult.bindingDefinitions,
    };
  }

  return {
    document: baseDocument,
    bindingDefinitions: baseBindings,
  };
}

export function getInstalledPackageUiDraftRecord(catalogId: string): DesignerVersionRecord | null {
  const resolved = resolvePackageUiCatalogEntry(catalogId);
  if (!resolved) {
    return null;
  }

  const { folder, name } = resolvePackageUiFolderAndName(resolved.ui.componentKey);
  const companionTsx = ensurePackageUiModuleDefaultExport(
    readInstalledPackageUiComponentSource(resolved.packageId, resolved.version, resolved.ui.entry),
  );
  const packedDraft = readInstalledPackageUiDraftJson(
    resolved.packageId,
    resolved.version,
    resolved.ui.draftEntry,
  );
  const fromTsx = packedDraft
    ? null
    : buildPackageUiDraftDocument(catalogId, name, companionTsx);
  const document = packedDraft?.document ?? fromTsx?.document;
  const bindingDefinitions = packedDraft?.bindingDefinitions ?? fromTsx?.bindingDefinitions;
  if (!document || !bindingDefinitions) {
    return null;
  }
  const updatedAt = readPackageUiSourceUpdatedAt(
    resolved.packageId,
    resolved.version,
    resolved.ui.entry,
    resolved.ui.registeredAt,
  );

  return {
    id: catalogId,
    name,
    folder,
    document,
    bindingDefinitions,
    metadata: {
      createdAt: resolved.ui.registeredAt,
      updatedAt,
      createdBy: resolved.packageId,
      updatedBy: resolved.packageId,
    },
    companionTsx,
    hydratedFromTsx: !packedDraft,
    companionTsxPath: resolved.ui.entry,
  };
}

export function updateInstalledPackageUiDraftRecord(
  catalogId: string,
  payload: {
    document?: DesignerDocument;
    bindingDefinitions?: DesignerBindingDefinitions;
  },
): { ok: true; draft: DesignerVersionRecord } | { ok: false; error: string } {
  const existing = getInstalledPackageUiDraftRecord(catalogId);
  if (!existing) {
    return { ok: false, error: 'Package UI component not found or package is not enabled.' };
  }

  const document = payload.document ?? existing.document;
  const bindingDefinitions = payload.bindingDefinitions ?? existing.bindingDefinitions;
  const code = ensurePackageUiModuleDefaultExport(
    generateDesignerTsx(document, bindingDefinitions),
  );
  const saveResult = updateInstalledPackageUiComponent(catalogId, code);
  if (!saveResult.ok) {
    return saveResult;
  }

  const draft = getInstalledPackageUiDraftRecord(catalogId);
  if (!draft) {
    return { ok: false, error: 'Package UI component could not be reloaded after save.' };
  }

  return {
    ok: true,
    draft: {
      ...draft,
      document,
      bindingDefinitions,
    },
  };
}

export function resolvePackageUiCatalogEntry(catalogId: string): PackageUiCatalogEntry | null {
  if (!catalogId.startsWith('pkg-ui-')) {
    return null;
  }

  const enabledMap = getEnabledInstalledVersionsMap();
  const retainedMap = getRetainedPackageUiVersionsMap();
  const packageVersions = new Map<string, string>();
  for (const [packageId, version] of enabledMap.entries()) {
    packageVersions.set(packageId, version);
  }
  for (const [packageId, version] of retainedMap.entries()) {
    if (!packageVersions.has(packageId)) {
      packageVersions.set(packageId, version);
    }
  }

  for (const [packageId, version] of packageVersions.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry || registry.records.uiComponents.length === 0) {
      continue;
    }

    for (const ui of registry.records.uiComponents) {
      if (buildPackageUiCatalogId(packageId, ui.componentKey) === catalogId) {
        return { packageId, version, ui };
      }
    }
  }

  return null;
}

function readInstalledPackageUiDraftJson(
  packageId: string,
  version: string,
  draftEntry: string | undefined,
): { document: DesignerDocument; bindingDefinitions: DesignerBindingDefinitions } | null {
  const entry = draftEntry?.trim();
  if (!entry) return null;
  const absPath = resolveRuntimeEntryPath(packageId, version, entry);
  if (!absPath || !fs.existsSync(absPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8')) as {
      document?: DesignerDocument;
      bindingDefinitions?: DesignerBindingDefinitions;
    };
    if (!parsed.document || typeof parsed.document !== 'object') return null;
    return {
      document: parsed.document,
      bindingDefinitions: parsed.bindingDefinitions ?? createDefaultBindingDefinitions(),
    };
  } catch {
    return null;
  }
}

export function readInstalledPackageUiComponentSource(
  packageId: string,
  version: string,
  entry: string,
): string {
  const absPath = resolveRuntimeEntryPath(packageId, version, entry);
  if (!absPath || !fs.existsSync(absPath)) {
    return `// Package UI component (${packageId})\n// Runtime source is unavailable.\n`;
  }
  return fs.readFileSync(absPath, 'utf8');
}

export function updateInstalledPackageUiComponent(
  catalogId: string,
  code: string,
): { ok: true } | { ok: false; error: string } {
  const resolved = resolvePackageUiCatalogEntry(catalogId);
  if (!resolved) {
    return { ok: false, error: 'Package UI component not found or package is not enabled.' };
  }

  const absPath = resolveRuntimeEntryPath(resolved.packageId, resolved.version, resolved.ui.entry);
  if (!absPath) {
    return { ok: false, error: `Invalid UI entry path "${resolved.ui.entry}".` };
  }

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  atomicWriteText(absPath, code.endsWith('\n') ? code : `${code}\n`);

  return { ok: true };
}

export function syncInstalledPackageUiRuntimeForDraftId(draftId: string): {
  updated: Array<{ packageId: string; version: string; componentKey: string; entry: string }>;
} {
  const bundle = buildDesignerComponentExportBundle(draftId);
  if (!bundle.ok) {
    return { updated: [] };
  }

  return syncInstalledPackageUiRuntimeForComponentKey(bundle.componentKey, bundle.code);
}

export function syncInstalledPackageUiRuntimeForComponentKey(
  componentKey: string,
  code: string,
): {
  updated: Array<{ packageId: string; version: string; componentKey: string; entry: string }>;
} {
  const normalizedKey = componentKey.trim().replace(/^\/+/, '');
  if (!normalizedKey) {
    return { updated: [] };
  }

  const normalizedCode = code.endsWith('\n') ? code : `${code}\n`;
  const enabledMap = getEnabledInstalledVersionsMap();
  const updated: Array<{ packageId: string; version: string; componentKey: string; entry: string }> = [];

  for (const [packageId, version] of enabledMap.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry) continue;

    for (const ui of registry.records.uiComponents) {
      if (ui.componentKey !== normalizedKey) continue;

      const absPath = resolveRuntimeEntryPath(packageId, version, ui.entry);
      if (!absPath) continue;

      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      atomicWriteText(absPath, normalizedCode);
      updated.push({
        packageId,
        version,
        componentKey: ui.componentKey,
        entry: ui.entry,
      });
    }
  }

  return { updated };
}

export function syncInstalledPackageUiRuntimeFromDraftRecord(input: {
  id: string;
  folder: string;
  name: string;
}): {
  updated: Array<{ packageId: string; version: string; componentKey: string; entry: string }>;
} {
  const componentKey = buildDesignerComponentPath(input.folder, input.name);
  const bundle = buildDesignerComponentExportBundle(input.id);
  if (!bundle.ok) {
    return { updated: [] };
  }

  return syncInstalledPackageUiRuntimeForComponentKey(componentKey, bundle.code);
}
