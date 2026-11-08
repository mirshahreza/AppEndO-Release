import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from '../../../core/packages/packageArtifactHash';
import {
  normalizeArtifactManifestForValidation,
  validateManifest,
  type PackageManifest,
} from '../../../core/packages/PackageManifestValidator';
import { generateDesignerTsx } from '../../../domain/component-designer/codegen';
import { ensurePackageUiModuleDefaultExport } from '../../../shared/packages/packageUiModuleExport';
import { readDraftRecord, readDraftRecordByComponentName } from '../../domain/component-designer/draftIo';
import { listDesignerDrafts } from '../../domain/component-designer/drafts';
import { readNewestDraftTsxSource } from '../../domain/component-designer/draftTsxHydration';
import { buildDesignerComponentPath } from '../../../shared/lib/designerComponentPath';
import type { PackageRepackAdditionsPayload } from '../../../shared/api/contracts/package/repack';

const DEFAULT_UI_SLOT = 'core.dashboard.widgets';

const ensureTrailingNewline = (value: string): string => (
  ensurePackageUiModuleDefaultExport(value.endsWith('\n') ? value : `${value}\n`)
);

const normalizeComponentKey = (componentKey: string): string => componentKey.trim().replace(/^\/+/, '');

export const buildPackageUiEntryPath = (componentKey: string): string => (
  `ui/${normalizeComponentKey(componentKey)}.tsx`
);

export function findDesignerDraftIdForComponentKey(componentKey: string): string | null {
  const normalizedKey = normalizeComponentKey(componentKey);
  if (!normalizedKey) return null;

  for (const draft of listDesignerDrafts()) {
    if (buildDesignerComponentPath(draft.folder, draft.name) === normalizedKey) {
      return draft.id;
    }
  }

  const draft = readDraftRecordByComponentName(normalizedKey);
  return draft?.id ?? null;
}

export function buildDesignerComponentExportBundle(draftId: string):
  | {
      ok: true;
      componentKey: string;
      label: string;
      entry: string;
      code: string;
      draftJson: string;
      draftEntry: string;
      folder: string;
      name: string;
    }
  | { ok: false; error: string } {
  const draft = readDraftRecord(draftId);
  if (!draft) {
    return { ok: false, error: `Designer draft "${draftId}" was not found.` };
  }

  const componentKey = buildDesignerComponentPath(draft.folder, draft.name);
  let code: string;

  if (draft.companionTsx?.trim()) {
    code = ensureTrailingNewline(draft.companionTsx);
  } else {
    const tsxSource = readNewestDraftTsxSource(draft);
    if (tsxSource?.content.trim()) {
      code = ensureTrailingNewline(tsxSource.content);
    } else {
      code = ensureTrailingNewline(generateDesignerTsx(draft.document, draft.bindingDefinitions));
    }
  }

  const draftPayload = {
    schema: draft.schema,
    id: draft.id,
    name: draft.name,
    folder: draft.folder,
    document: draft.document,
    bindingDefinitions: draft.bindingDefinitions,
    workspace: draft.workspace,
    metadata: draft.metadata,
  };

  return {
    ok: true,
    componentKey,
    label: componentKey,
    entry: buildPackageUiEntryPath(componentKey),
    code,
    draftJson: `${JSON.stringify(draftPayload, null, 2)}\n`,
    draftEntry: `designer/pages/${componentKey}.json`,
    folder: draft.folder,
    name: draft.name,
  };
}

const normalizeZipEntryName = (entryName: string): string => entryName.replace(/\\/g, '/').replace(/^\.\//, '');

function resolveDesignerExportForComponentKey(componentKey: string): {
  entry: string;
  code: string;
  draftJson: string;
  draftEntry: string;
} | null {
  const draftId = findDesignerDraftIdForComponentKey(componentKey);
  if (!draftId) return null;

  const bundle = buildDesignerComponentExportBundle(draftId);
  if (!bundle.ok) return null;

  return {
    entry: bundle.entry,
    code: bundle.code,
    draftJson: bundle.draftJson,
    draftEntry: bundle.draftEntry,
  };
}

function resolveDesignerExportForDraftId(draftId: string): {
  entry: string;
  code: string;
  componentKey: string;
  draftJson: string;
  draftEntry: string;
} | null {
  const bundle = buildDesignerComponentExportBundle(draftId);
  if (!bundle.ok) return null;

  return {
    entry: bundle.entry,
    code: bundle.code,
    componentKey: bundle.componentKey,
    draftJson: bundle.draftJson,
    draftEntry: bundle.draftEntry,
  };
}

export function materializeUiComponentRepackAdditions(
  additions: PackageRepackAdditionsPayload | null | undefined,
): PackageRepackAdditionsPayload | null | undefined {
  if (!additions?.ui_components?.length) return additions;

  const fileMap = new Map(
    (additions.files ?? []).map((file) => [normalizeZipEntryName(file.entryPath), file.content]),
  );

  const ui_components = additions.ui_components.map((ui, index) => {
    const originalEntry = normalizeZipEntryName(ui.entry);
    const draftId = ui.designerDraftId?.trim()
      || findDesignerDraftIdForComponentKey(ui.componentKey);
    const exported = draftId ? resolveDesignerExportForDraftId(draftId) : resolveDesignerExportForComponentKey(ui.componentKey);

    if (!exported) {
      return ui;
    }

    const exportedEntry = normalizeZipEntryName(exported.entry);
    if (originalEntry !== exportedEntry) {
      fileMap.delete(originalEntry);
    }
    fileMap.set(exportedEntry, exported.code);
    const draftEntry = normalizeZipEntryName(exported.draftEntry);
    fileMap.set(draftEntry, exported.draftJson);
    return {
      componentKey: exported.componentKey,
      slotId: ui.slotId?.trim() || DEFAULT_UI_SLOT,
      entry: exportedEntry,
      order: ui.order ?? 100 + index,
      ...(draftId ? { designerDraftId: draftId } : {}),
      draftEntry,
    };
  });

  return {
    ...additions,
    ui_components,
    files: Array.from(fileMap.entries()).map(([entryPath, content]) => ({ entryPath, content })),
  };
}

export function enrichRepackAdditionsWithDesignerUiExports(
  additions: PackageRepackAdditionsPayload | null | undefined,
): PackageRepackAdditionsPayload | null | undefined {
  return materializeUiComponentRepackAdditions(additions);
}

export function enrichPackageArtifactBuffer(buffer: Buffer): Buffer {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return buffer;
  }

  let manifestText: string;
  try {
    manifestText = zip.readAsText('package.json');
  } catch {
    return buffer;
  }

  let manifest: PackageManifest;
  try {
    const parsed = JSON.parse(manifestText) as unknown;
    const validation = validateManifest(normalizeArtifactManifestForValidation(parsed));
    if (!validation.valid || !validation.manifest) return buffer;
    manifest = validation.manifest as PackageManifest;
  } catch {
    return buffer;
  }

  if (!Array.isArray(manifest.capabilities.ui_components) || manifest.capabilities.ui_components.length === 0) {
    return buffer;
  }

  let changed = false;
  const ui_components = manifest.capabilities.ui_components.map((ui) => {
    const exported = resolveDesignerExportForComponentKey(ui.componentKey);
    if (!exported) return ui;

    zip.updateFile(normalizeZipEntryName(exported.entry), Buffer.from(exported.code, 'utf8'));
    changed = true;
    return {
      ...ui,
      entry: exported.entry,
    };
  });

  if (!changed) return buffer;

  const updatedManifest: PackageManifest = {
    ...manifest,
    capabilities: {
      ...manifest.capabilities,
      ui_components,
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: computePackageArtifactHashFromZip(zip),
    },
  };
  zip.updateFile('package.json', Buffer.from(`${JSON.stringify(updatedManifest, null, 2)}\n`, 'utf8'));
  return zip.toBuffer();
}
