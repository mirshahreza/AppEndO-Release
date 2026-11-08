import fs from 'fs';
import path from 'path';
import { resolveDesignerComponentMetaPath } from '../../../domain/component-designer/designerComponentMetaSidecar';
import { designerStoragePaths } from './storage';

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const DEFAULT_DRAFT_FOLDER = 'general';
export const DRAFT_ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;

/** Filesystem base name derived from the operator-facing component name. */
export const sanitizeComponentFileBaseName = (name: string): string => {
  const sanitized = name
    .trim()
    .replace(/\s+/g, '-')
    .replace(INVALID_FILE_NAME_CHARS, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return sanitized.length > 0 ? sanitized : 'component';
};

export const sanitizeDraftId = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized.length >= 3 && DRAFT_ID_RE.test(normalized)) {
    return normalized;
  }

  const suffix = Date.now().toString(36);
  const base = normalized.length > 0 ? normalized.slice(0, 40) : 'draft';
  return `${base}-${suffix}`;
};

export const sanitizeDraftFolderName = (value: unknown, fallback = DEFAULT_DRAFT_FOLDER): string => {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(INVALID_FOLDER_CHARS, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return sanitized.length > 0 ? sanitized : fallback;
};

export const ensureDirectory = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

export const draftFolderDirectory = (_folder?: unknown): string =>
  path.join(designerStoragePaths.drafts, DEFAULT_DRAFT_FOLDER);

export const draftJsonPath = (componentName: string, folder?: unknown): string =>
  path.join(draftFolderDirectory(folder), `${sanitizeComponentFileBaseName(componentName)}.json`);

export const draftCompanionTsxPath = (componentName: string, folder: unknown): string =>
  path.join(draftFolderDirectory(folder), `${sanitizeComponentFileBaseName(componentName)}.tsx`);

export const draftCompanionMetaPath = (componentName: string, folder: unknown): string =>
  resolveDesignerComponentMetaPath(draftCompanionTsxPath(componentName, folder));

export const draftCompanionTypesPath = (componentName: string, folder: unknown): string =>
  path.join(draftFolderDirectory(folder), `${sanitizeComponentFileBaseName(componentName)}.types.ts`);

/** Pre-migration layout: draft id used as the on-disk filename stem. */
export const legacyIdBasedDraftJsonPath = (draftId: string, folder: unknown): string =>
  path.join(draftFolderDirectory(folder), `${sanitizeDraftId(draftId)}.json`);

export const legacyIdBasedDraftCompanionTsxPath = (draftId: string, folder: unknown): string =>
  path.join(draftFolderDirectory(folder), `${sanitizeDraftId(draftId)}.tsx`);

export const legacyIdBasedDraftCompanionMetaPath = (draftId: string, folder: unknown): string =>
  resolveDesignerComponentMetaPath(legacyIdBasedDraftCompanionTsxPath(draftId, folder));

export const draftSnapshotDirectory = (draftId: string, _folder?: unknown): string =>
  path.join(designerStoragePaths.snapshots, DEFAULT_DRAFT_FOLDER, sanitizeDraftId(draftId));

export const draftSnapshotLatestPath = (draftId: string, folder: unknown): string =>
  path.join(draftSnapshotDirectory(draftId, folder), 'latest.json');

export const versionedDraftSnapshotPath = (draftId: string, folder: unknown, version: number): string =>
  path.join(draftSnapshotDirectory(draftId, folder), `${version}.json`);

export const draftExportDirectory = (_folder?: unknown): string =>
  path.join(designerStoragePaths.exports, DEFAULT_DRAFT_FOLDER);

export const draftExportFilePath = (fileName: string, folder: unknown): string =>
  path.join(draftExportDirectory(folder), fileName);

export const draftExportMetaPath = (tsxFileName: string, folder: unknown): string =>
  resolveDesignerComponentMetaPath(draftExportFilePath(tsxFileName, folder));

export const legacyDraftJsonPath = (draftId: string): string =>
  path.join(designerStoragePaths.drafts, `${sanitizeDraftId(draftId)}.json`);

export const legacyDraftCompanionTsxPath = (draftId: string): string =>
  path.join(designerStoragePaths.drafts, `${sanitizeDraftId(draftId)}.tsx`);

export const legacyDraftSnapshotDirectory = (draftId: string): string =>
  path.join(designerStoragePaths.snapshots, sanitizeDraftId(draftId));

const isDraftJsonFileName = (fileName: string): boolean =>
  fileName.endsWith('.json') && !fileName.endsWith('.meta.json') && fileName !== 'index.json';

const isDesignerCompanionFileName = (fileName: string): boolean =>
  fileName.endsWith('.tsx')
  || fileName.endsWith('.types.ts')
  || fileName.endsWith('.meta.json');

const collectJsonFilesRecursive = (rootDirectory: string): string[] => {
  if (!fs.existsSync(rootDirectory)) {
    return [];
  }

  const results: string[] = [];
  const walk = (currentDirectory: string): void => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (entry.isFile() && isDraftJsonFileName(entry.name)) {
        results.push(entryPath);
      }
    }
  };

  walk(rootDirectory);
  return results;
};

export const listDraftJsonFilePaths = (): string[] =>
  collectJsonFilesRecursive(designerStoragePaths.drafts);

/**
 * Cheap (stat-only, no read+parse) staleness signature for the whole drafts tree. Lets callers
 * cache the expensive part — reading, JSON.parse'ing, and normalizing every draft file — and
 * only redo that work when a file was actually added/removed/modified since the signature was
 * last computed. Deliberately per-file (not a single directory mtime): an in-place overwrite of
 * an existing file's content doesn't bump its *parent directory's* mtime on Windows/most
 * filesystems, only the file's own.
 */
export const computeDraftJsonFilesSignature = (): string => {
  if (!fs.existsSync(designerStoragePaths.drafts)) {
    return '';
  }

  const parts: string[] = [];
  const walk = (currentDirectory: string): void => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (!entry.isFile() || !isDraftJsonFileName(entry.name)) {
        continue;
      }
      try {
        const stat = fs.statSync(entryPath);
        parts.push(`${entryPath}:${stat.mtimeMs}`);
      } catch {
        // Removed between readdir and stat — ignore, next call will reconcile.
      }
    }
  };

  walk(designerStoragePaths.drafts);
  return parts.sort().join(',');
};

export const listExportTsxFilePaths = (): string[] => {
  if (!fs.existsSync(designerStoragePaths.exports)) {
    return [];
  }

  const results: string[] = [];
  const walk = (currentDirectory: string): void => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.tsx')) {
        results.push(entryPath);
      }
    }
  };

  walk(designerStoragePaths.exports);
  return results;
};

export const listExportMetaFilePaths = (): string[] => {
  if (!fs.existsSync(designerStoragePaths.exports)) {
    return [];
  }

  const results: string[] = [];
  const walk = (currentDirectory: string): void => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.meta.json')) {
        results.push(entryPath);
      }
    }
  };

  walk(designerStoragePaths.exports);
  return results;
};

const readDraftIdFromJsonFile = (filePath: string): string | null => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { id?: unknown };
    return typeof parsed.id === 'string' ? parsed.id : null;
  } catch {
    return null;
  }
};

/** Every live draft JSON whose record id matches, including leftover files after a rename. */
export const listDraftJsonFilePathsForDraftId = (draftId: string): string[] => {
  const trimmed = draftId.trim();
  const normalized = sanitizeDraftId(trimmed);
  const candidates = new Set([trimmed, normalized].filter((item) => item.length > 0));
  return listDraftJsonFilePaths().filter((filePath) => {
    const id = readDraftIdFromJsonFile(filePath);
    return Boolean(id) && candidates.has(id);
  });
};

const unlinkIfExists = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
};

const moveFileIfMissingDest = (fromPath: string, toPath: string): boolean => {
  if (!fs.existsSync(fromPath) || fs.existsSync(toPath)) {
    return false;
  }

  ensureDirectory(path.dirname(toPath));
  fs.renameSync(fromPath, toPath);
  return true;
};

const patchDraftFolderField = (jsonPath: string): void => {
  try {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as { folder?: unknown };
    if (parsed && typeof parsed === 'object' && parsed.folder !== DEFAULT_DRAFT_FOLDER) {
      parsed.folder = DEFAULT_DRAFT_FOLDER;
      fs.writeFileSync(jsonPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    }
  } catch {
    // Leave the file as-is if it is not JSON we can patch.
  }
};

const moveDesignerStem = (sourceDir: string, destDir: string, stem: string): void => {
  moveFileIfMissingDest(path.join(sourceDir, `${stem}.json`), path.join(destDir, `${stem}.json`));
  moveFileIfMissingDest(path.join(sourceDir, `${stem}.tsx`), path.join(destDir, `${stem}.tsx`));
  moveFileIfMissingDest(
    path.join(sourceDir, `${stem}.meta.json`),
    path.join(destDir, `${stem}.meta.json`),
  );
  moveFileIfMissingDest(
    path.join(sourceDir, `${stem}.types.ts`),
    path.join(destDir, `${stem}.types.ts`),
  );
};

const directoryHasDraftJson = (directoryPath: string): boolean =>
  collectJsonFilesRecursive(directoryPath).some((filePath) => isDraftJsonFileName(path.basename(filePath)));

const directoryContainsOnlyDesignerCompanions = (directoryPath: string): boolean => {
  if (!fs.existsSync(directoryPath)) {
    return true;
  }

  const walk = (currentDirectory: string): boolean => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      if (entry.name === '.gitkeep') {
        continue;
      }

      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        if (!walk(entryPath)) {
          return false;
        }
        continue;
      }

      if (entry.isFile() && isDesignerCompanionFileName(entry.name)) {
        continue;
      }

      return false;
    }

    return true;
  };

  return walk(directoryPath);
};

const removeLeftoverDraftFolderIfSafe = (folderPath: string): void => {
  if (!fs.existsSync(folderPath)) {
    return;
  }

  if (directoryHasDraftJson(folderPath)) {
    return;
  }

  const leftoverNames = fs.readdirSync(folderPath).filter((entry) => entry !== '.gitkeep');
  if (leftoverNames.length === 0 || directoryContainsOnlyDesignerCompanions(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
};

/** Move every draft artifact into `drafts/general/` so the catalog is a single flat folder. */
export const flattenDesignerDraftStorageToDefaultFolder = (): void => {
  const draftsRoot = designerStoragePaths.drafts;
  if (!fs.existsSync(draftsRoot)) {
    return;
  }

  const destDir = path.join(draftsRoot, DEFAULT_DRAFT_FOLDER);
  ensureDirectory(destDir);

  for (const filePath of listDraftJsonFilePaths()) {
    const relative = path.relative(draftsRoot, filePath);
    const segments = relative.split(path.sep).filter(Boolean);
    if (segments.length === 0) {
      continue;
    }

    const inDefaultFolder = segments[0] === DEFAULT_DRAFT_FOLDER && segments.length >= 2;
    if (inDefaultFolder) {
      patchDraftFolderField(filePath);
      continue;
    }

    const stem = path.basename(filePath, '.json');
    const destJson = path.join(destDir, `${stem}.json`);
    const sourceDir = path.dirname(filePath);
    const sourceFolder = segments[0];

    if (fs.existsSync(destJson)) {
      const destId = readDraftIdFromJsonFile(destJson);
      const sourceId = readDraftIdFromJsonFile(filePath);
      if (destId && sourceId && destId === sourceId) {
        unlinkIfExists(filePath);
        unlinkIfExists(path.join(sourceDir, `${stem}.tsx`));
        unlinkIfExists(path.join(sourceDir, `${stem}.meta.json`));
        unlinkIfExists(path.join(sourceDir, `${stem}.types.ts`));
      }
      patchDraftFolderField(destJson);
      continue;
    }

    moveDesignerStem(sourceDir, destDir, stem);
    patchDraftFolderField(destJson);

    const draftId = readDraftIdFromJsonFile(destJson);
    if (draftId && sourceFolder !== DEFAULT_DRAFT_FOLDER) {
      const sourceSnap = path.join(designerStoragePaths.snapshots, sourceFolder, draftId);
      const destSnap = path.join(designerStoragePaths.snapshots, DEFAULT_DRAFT_FOLDER, draftId);
      moveFileIfMissingDest(sourceSnap, destSnap);
    }
  }

  for (const entry of fs.readdirSync(draftsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === DEFAULT_DRAFT_FOLDER) {
      continue;
    }
    removeLeftoverDraftFolderIfSafe(path.join(draftsRoot, entry.name));
  }
};

export const resolveDraftJsonPath = (
  draftId: string,
  folderHint?: unknown,
): string | null => {
  const normalizedId = sanitizeDraftId(draftId);
  const allPaths = listDraftJsonFilePaths();
  const folderScopedPaths = folderHint !== undefined
    ? allPaths.filter((filePath) => filePath.includes(`${path.sep}${sanitizeDraftFolderName(folderHint)}${path.sep}`))
    : [];
  const orderedPaths = [...folderScopedPaths, ...allPaths];
  const seen = new Set<string>();

  for (const filePath of orderedPaths) {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);

    const recordId = readDraftIdFromJsonFile(filePath);
    if (recordId === normalizedId || recordId === draftId) {
      return filePath;
    }
  }

  const legacyCandidates: string[] = [];
  if (folderHint !== undefined) {
    legacyCandidates.push(legacyIdBasedDraftJsonPath(normalizedId, folderHint));
  }
  legacyCandidates.push(legacyDraftJsonPath(normalizedId));

  for (const candidate of legacyCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const filePath of allPaths) {
    if (path.basename(filePath, '.json') === normalizedId) {
      return filePath;
    }
  }

  return null;
};

const removeDirectoryIfExists = (directoryPath: string): void => {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  fs.rmSync(directoryPath, { recursive: true, force: true });
};

export const removeDraftSnapshotDirectories = (draftId: string, folder: unknown): void => {
  removeDirectoryIfExists(draftSnapshotDirectory(draftId, folder));
  removeDirectoryIfExists(legacyDraftSnapshotDirectory(draftId));
};

export type DraftArtifactIdentity = {
  id: string;
  name: string;
  folder: unknown;
};

export const removeLegacyIdBasedDraftArtifacts = (
  record: Pick<DraftArtifactIdentity, 'id' | 'name' | 'folder'>,
): void => {
  // When draft id equals the component file base name, legacy id-based paths collide with
  // the live name-based draft/companion files — never delete those.
  const liveJson = path.resolve(draftJsonPath(record.name, record.folder));
  const liveTsx = path.resolve(draftCompanionTsxPath(record.name, record.folder));
  const liveMeta = path.resolve(draftCompanionMetaPath(record.name, record.folder));

  const unlinkUnlessLive = (candidate: string): void => {
    const resolved = path.resolve(candidate);
    if (resolved === liveJson || resolved === liveTsx || resolved === liveMeta) {
      return;
    }
    unlinkIfExists(candidate);
  };

  unlinkUnlessLive(legacyIdBasedDraftJsonPath(record.id, record.folder));
  unlinkUnlessLive(legacyIdBasedDraftCompanionTsxPath(record.id, record.folder));
  unlinkUnlessLive(legacyIdBasedDraftCompanionMetaPath(record.id, record.folder));
  unlinkIfExists(legacyDraftJsonPath(record.id));
  unlinkIfExists(legacyDraftCompanionTsxPath(record.id));
};

export const removeDraftJsonAndCompanionFiles = (record: DraftArtifactIdentity): void => {
  unlinkIfExists(draftJsonPath(record.name, record.folder));
  unlinkIfExists(draftCompanionTsxPath(record.name, record.folder));
  unlinkIfExists(draftCompanionMetaPath(record.name, record.folder));
  unlinkIfExists(draftCompanionTypesPath(record.name, record.folder));
  unlinkIfExists(legacyIdBasedDraftJsonPath(record.id, record.folder));
  unlinkIfExists(legacyIdBasedDraftCompanionTsxPath(record.id, record.folder));
  unlinkIfExists(legacyIdBasedDraftCompanionMetaPath(record.id, record.folder));
  unlinkIfExists(legacyDraftJsonPath(record.id));
  unlinkIfExists(legacyDraftCompanionTsxPath(record.id));
};

export const removeDraftCompanionFiles = (record: DraftArtifactIdentity): void => {
  unlinkIfExists(draftCompanionTsxPath(record.name, record.folder));
  unlinkIfExists(draftCompanionMetaPath(record.name, record.folder));
  unlinkIfExists(draftCompanionTypesPath(record.name, record.folder));
  unlinkIfExists(legacyIdBasedDraftCompanionTsxPath(record.id, record.folder));
  unlinkIfExists(legacyIdBasedDraftCompanionMetaPath(record.id, record.folder));
  unlinkIfExists(legacyDraftCompanionTsxPath(record.id));
};
