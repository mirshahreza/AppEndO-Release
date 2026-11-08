import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import { computePackageArtifactHashFromZip } from '../../../core/packages/packageArtifactHash';
import { packageDirs } from '../../../core/packages/PackageFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import type {
  VerticalAppDesignerLayoutCapability,
  VerticalAppDesignerShellCapability,
  VerticalAppManifest,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import { buildDesignerShellEntry, SHELL_DRAFT_FOLDER } from '../../../shared/lib/designerShellEntry';
import { draftJsonPath } from '../../domain/component-designer/draftFolderPaths';
import { getDesignerDraft, readDraftRecordByPath } from '../../domain/component-designer/draftIo';
import { ensureDesignerStoragePaths } from '../../domain/component-designer/storage';
import { saveDesignerDraft } from '../component-designer/draftCoordinator.service';

export type ExportDesignerShellPackageInput = {
  shellKey: string;
  packageId: string;
  version: string;
  title?: string;
};

export type ExportDesignerShellPackageResult =
  | {
      ok: true;
      zipPath: string;
      manifest: VerticalAppManifest;
      shellEntry: string;
    }
  | {
      ok: false;
      error: string;
    };

function resolvePackageZipPath(packageId: string, version: string): string | null {
  const artifactPath = path.join(packageDirs.artifacts, packageId, `${version}.zip`);
  if (!fs.existsSync(artifactPath)) {
    return null;
  }
  return artifactPath;
}

function readZipEntry(zip: AdmZip, entryPath: string): string | null {
  const entry = zip.getEntry(entryPath.replace(/\\/g, '/'));
  if (!entry) {
    return null;
  }
  return entry.getData().toString('utf8');
}

const buildDesignerShellZipEntryPath = (shellKey: string): string =>
  `designer/${SHELL_DRAFT_FOLDER}/${shellKey.trim()}.json`;

export function buildDesignerShellPackageZip(
  input: ExportDesignerShellPackageInput,
): ExportDesignerShellPackageResult {
  const shellKey = input.shellKey.trim();
  const packageId = input.packageId.trim();
  const version = input.version.trim();

  if (!shellKey || !packageId || !version) {
    return { ok: false, error: 'shellKey, packageId, and version are required.' };
  }

  const draftPath = draftJsonPath(shellKey, SHELL_DRAFT_FOLDER);
  const record = readDraftRecordByPath(draftPath);
  if (!record) {
    return { ok: false, error: `Designer shell draft "${shellKey}" was not found.` };
  }

  const shellEntry = buildDesignerShellZipEntryPath(shellKey);
  const shellPayload = {
    schema: record.schema,
    id: record.id,
    name: record.name,
    folder: record.folder,
    document: record.document,
    bindingDefinitions: record.bindingDefinitions,
    workspace: record.workspace,
    metadata: record.metadata,
  };

  const shellBridgeEntry = 'ui/shell/DesignerShellBridge.js';
  const manifestWithoutHash: Omit<VerticalAppManifest, 'integrity'> & {
    integrity: { algorithm: 'sha256'; artifactHash: string };
  } = {
    $schemaVersion: '1.3',
    kind: 'vertical-app',
    id: packageId,
    name: input.title?.trim() || record.name,
    version,
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      shell: {
        key: `${shellKey}-shell`,
        name: `${record.name} Shell`,
        entry: buildDesignerShellEntry(shellKey),
        surface: 'portal',
      },
      designer_shells: [{
        shellKey,
        title: input.title?.trim() || record.name,
        entry: shellEntry,
      }],
      apis: [],
      db_objects: [],
    },
    deployment: {
      applyPolicy: 'propose',
      mount: {
        id: packageId,
        pathPrefix: `/packages/${packageId}`,
        name: input.title?.trim() || record.name,
        defaultRoute: 'home',
      },
      shellRule: {
        pathPrefix: `/packages/${packageId}`,
        shellKey: `${shellKey}-shell`,
      },
      routes: [],
    },
    overridePolicy: {
      apis: 'deny',
      db_objects: 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: '0'.repeat(64),
    },
  };

  const zip = new AdmZip();
  zip.addFile(shellEntry, Buffer.from(`${JSON.stringify(shellPayload, null, 2)}\n`, 'utf8'));
  zip.addFile(shellBridgeEntry, Buffer.from('export default () => ({});\n', 'utf8'));

  const artifactHash = computePackageArtifactHashFromZip(zip);
  manifestWithoutHash.integrity.artifactHash = artifactHash;
  zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifestWithoutHash, null, 2)}\n`, 'utf8'));

  const artifactDirectory = path.join(packageDirs.artifacts, packageId);
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const zipPath = path.join(artifactDirectory, `${version}.zip`);
  zip.writeZip(zipPath);

  return {
    ok: true,
    zipPath,
    manifest: manifestWithoutHash,
    shellEntry,
  };
}

export type DesignerShellSeedManifest = {
  capabilities: {
    designer_shells?: VerticalAppDesignerShellCapability[];
    designer_layouts?: VerticalAppDesignerLayoutCapability[];
  };
};

export function seedDesignerShellsFromManifest(
  packageId: string,
  version: string,
  manifest: DesignerShellSeedManifest,
): { seeded: string[]; seededLayouts: string[]; warnings: string[] } {
  const shells = manifest.capabilities.designer_shells ?? [];
  const layouts = manifest.capabilities.designer_layouts ?? [];

  const zipPath = resolvePackageZipPath(packageId, version);
  if (!zipPath) {
    return {
      seeded: [],
      seededLayouts: [],
      warnings: [`Package artifact not found for ${packageId}@${version}.`],
    };
  }

  ensureDesignerStoragePaths();
  const zip = new AdmZip(zipPath);
  const seeded: string[] = [];
  const seededLayouts: string[] = [];
  const warnings: string[] = [];

  for (const shell of shells) {
    const result = seedDesignerShellFromZip(zip, shell);
    if (result.ok) {
      seeded.push(shell.shellKey);
    } else if ('warning' in result) {
      warnings.push(result.warning);
    }
  }

  for (const layout of layouts) {
    const result = seedDesignerLayoutFromZip(zip, layout);
    if (result.ok) {
      seededLayouts.push(layout.slug);
    } else if ('warning' in result) {
      warnings.push(result.warning);
    }
  }

  return { seeded, seededLayouts, warnings };
}

function seedDesignerShellFromZip(
  zip: AdmZip,
  shell: VerticalAppDesignerShellCapability,
): { ok: true } | { ok: false; warning: string } {
  const shellKey = shell.shellKey.trim();
  const entry = shell.entry.trim().replace(/\\/g, '/');
  if (!shellKey || !entry) {
    return { ok: false, warning: `Designer shell capability is missing shellKey or entry.` };
  }

  const raw = readZipEntry(zip, entry);
  if (!raw) {
    return { ok: false, warning: `Designer shell entry "${entry}" was not found in package ZIP.` };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, warning: `Designer shell entry "${entry}" is not valid JSON.` };
  }

  const document = parsed.document;
  if (!document || typeof document !== 'object') {
    return { ok: false, warning: `Designer shell "${shellKey}" is missing document.` };
  }

  const targetPath = draftJsonPath(shellKey, SHELL_DRAFT_FOLDER);
  if (fs.existsSync(targetPath)) {
    atomicWriteText(targetPath, `${JSON.stringify(parsed, null, 2)}\n`, runtimeDirs.workspaceTemp);
    return { ok: true };
  }

  saveDesignerDraft({
    name: shellKey,
    folder: SHELL_DRAFT_FOLDER,
    document: document as never,
    bindingDefinitions: ((parsed.bindingDefinitions as Record<string, unknown> | undefined) ?? {}) as never,
    workspace: ((parsed.workspace as Record<string, unknown> | undefined) ?? {}) as never,
    actor: 'package-install',
  });

  return { ok: true };
}

function seedDesignerLayoutFromZip(
  zip: AdmZip,
  layout: VerticalAppDesignerLayoutCapability,
): { ok: true } | { ok: false; warning: string } {
  const pageKey = layout.slug.trim();
  const entry = layout.entry.trim().replace(/\\/g, '/');
  if (!pageKey || !entry) {
    return { ok: false, warning: 'Designer layout capability is missing slug or entry.' };
  }

  const raw = readZipEntry(zip, entry);
  if (!raw) {
    return { ok: false, warning: `Designer layout entry "${entry}" was not found in package ZIP.` };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, warning: `Designer layout entry "${entry}" is not valid JSON.` };
  }

  const document = parsed.document;
  if (!document || typeof document !== 'object') {
    return { ok: false, warning: `Designer layout "${pageKey}" is missing document.` };
  }
  const creativeLanding = (document as { metadata?: { creativeLanding?: unknown } }).metadata?.creativeLanding;
  if (
    creativeLanding
    && (
      typeof creativeLanding !== 'object'
      || (creativeLanding as { owner?: unknown; pageKey?: unknown }).owner !== 'creative-landing'
      || (creativeLanding as { pageKey?: unknown }).pageKey !== pageKey
    )
  ) {
    return { ok: false, warning: `Designer layout "${pageKey}" has mismatched Creative Landing metadata.` };
  }

  const folder = typeof parsed.folder === 'string' && parsed.folder.trim()
    ? parsed.folder.trim()
    : 'general';
  const existing = getDesignerDraft(pageKey);
  if (existing) {
    return { ok: false, warning: `Designer layout "${pageKey}" already exists.` };
  }
  saveDesignerDraft({
    name: pageKey,
    folder,
    document: document as never,
    bindingDefinitions: ((parsed.bindingDefinitions as Record<string, unknown> | undefined) ?? {}) as never,
    workspace: ((parsed.workspace as Record<string, unknown> | undefined) ?? {}) as never,
    actor: 'package-install',
  });
  return { ok: true };
}
