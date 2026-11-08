import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import type { DesignerBindingDefinition, DesignerDocument } from '../../../domain/component-designer/types';
import { normalizeDesignerViewport } from '../../../domain/component-designer/state';
import {
  computeDraftJsonFilesSignature,
  DRAFT_ID_RE,
  draftFolderDirectory,
  draftJsonPath,
  draftSnapshotLatestPath,
  ensureDirectory,
  flattenDesignerDraftStorageToDefaultFolder,
  listDraftJsonFilePaths,
  resolveDraftJsonPath,
  sanitizeComponentFileBaseName,
  sanitizeDraftFolderName,
  sanitizeDraftId,
  versionedDraftSnapshotPath,
} from './draftFolderPaths';
import { normalizeDesignerDocumentFromPersist } from '../../../domain/component-designer/documentPersist';
import { designerStoragePaths, ensureDesignerStoragePaths } from './storage';
import { hydrateDraftRecordFromTsxSources } from './draftTsxHydration';
import type { DesignerDraftIndex, DesignerDraftRecord, DesignerDraftSummary } from './draftTypes';
import { parseDesignerComponentPath } from '../../../shared/lib/designerComponentPath';
import { normalizeDesignerComponentName } from '../../../shared/lib/designerIdentity';
import {
  creativeLandingMetadataV1Schema,
  shellDesignerMetadataV1Schema,
} from '../../../shared/api/contracts/shell-designer/schemas';
import { normalizeCatalogTags } from '../../../shared/lib/catalogTags';
import { parseCatalogKind } from '../../../domain/component-designer/layout-presets/catalogSystemTags';
import { ShellDesignerContractError } from '../../../shared/api/contracts/shell-designer/errors';
import type {
  CreativeLandingMetadataV1,
  ShellDesignerMetadataV1,
} from '../../../shared/api/contracts/shell-designer/types';

export type DesignerDraftLoadPayload = DesignerDraftRecord & {
  companionTsx?: string | null;
  hydratedFromTsx?: boolean;
  companionTsxPath?: string | null;
};

export { DRAFT_ID_RE, sanitizeDraftId, sanitizeDraftFolderName } from './draftFolderPaths';

export const DESIGNER_STORAGE_DIR = designerStoragePaths.root;
export const DESIGNER_DRAFTS_DIR = designerStoragePaths.drafts;
export const DESIGNER_SNAPSHOTS_DIR = designerStoragePaths.snapshots;
export const DESIGNER_INDEX_PATH = designerStoragePaths.index;

export const ensureDesignerStorageDirs = (): void => {
  ensureDesignerStoragePaths();
  fs.mkdirSync(DESIGNER_STORAGE_DIR, { recursive: true });
  fs.mkdirSync(DESIGNER_DRAFTS_DIR, { recursive: true });
  fs.mkdirSync(DESIGNER_SNAPSHOTS_DIR, { recursive: true });
};

export const draftFilePath = (componentName: string, folder: unknown = 'general'): string =>
  draftJsonPath(componentName, folder);

export const DRAFT_SNAPSHOT_FILE_NAME = 'latest.json';

export const draftSnapshotFilePath = (draftId: string, folder: unknown = 'general'): string =>
  draftSnapshotLatestPath(draftId, folder);

export const versionedDraftSnapshotFilePath = (draftId: string, version: number, folder: unknown = 'general'): string =>
  versionedDraftSnapshotPath(draftId, folder, version);

export const draftSnapshotDir = (draftId: string, folder: unknown = 'general'): string =>
  path.dirname(draftSnapshotLatestPath(draftId, folder));

export const makeEmptyIndex = (): DesignerDraftIndex => ({
  schema: 'component-designer-drafts-index',
  updatedAt: new Date().toISOString(),
  drafts: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidIsoDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

export const assertValidDocument = (document: DesignerDocument): void => {
  if (!isRecord(document) || !isRecord(document.nodes) || typeof document.rootNodeId !== 'string') {
    throw new Error('Draft document is invalid.');
  }

  if (!document.nodes[document.rootNodeId]) {
    throw new Error('Draft document root node is missing.');
  }
};

export const toSummary = (record: DesignerDraftRecord): DesignerDraftSummary => ({
  id: record.id,
  name: record.name,
  folder: sanitizeDraftFolderName(record.folder),
  catalogKind: record.catalogKind,
  tags: record.tags ?? [],
  createdAt: record.metadata.createdAt,
  updatedAt: record.metadata.updatedAt,
  createdBy: record.metadata.createdBy,
  updatedBy: record.metadata.updatedBy,
});

const DESIGNER_TMP_DIR = runtimeDirs.workspaceTemp;

export const writeDraftIndex = (index: DesignerDraftIndex): void => {
  index.updatedAt = new Date().toISOString();
  ensureDirectory(path.dirname(DESIGNER_INDEX_PATH));
  atomicWriteText(DESIGNER_INDEX_PATH, JSON.stringify(index, null, 2), DESIGNER_TMP_DIR);
};

export const writeDraftFile = (record: DesignerDraftRecord): void => {
  const filePath = draftFilePath(record.name, record.folder);
  ensureDirectory(path.dirname(filePath));
  atomicWriteText(filePath, JSON.stringify(record, null, 2), DESIGNER_TMP_DIR);
};

const readVersionedDraftRecordBySnapshot = (draftId: string, version: number, folderHint?: string): DesignerDraftRecord | null => {
  const normalizedId = sanitizeDraftId(draftId);
  const folderCandidates = new Set<string>();

  if (folderHint) {
    folderCandidates.add(sanitizeDraftFolderName(folderHint));
  }

  const resolvedPath = resolveDraftJsonPath(normalizedId, folderHint);
  if (resolvedPath) {
    const record = readDraftRecordByPath(resolvedPath);
    if (record) {
      folderCandidates.add(record.folder);
    }
  }

  for (const folder of folderCandidates) {
    const filePath = versionedDraftSnapshotFilePath(normalizedId, version, folder);
    if (fs.existsSync(filePath)) {
      return readDraftRecordByPath(filePath);
    }
  }

  return null;
};

export const parseDraftRecord = (value: unknown): DesignerDraftRecord | null => {
  if (!isRecord(value) || value.schema !== 'component-designer-draft') {
    return null;
  }

  if (typeof value.id !== 'string' || !DRAFT_ID_RE.test(value.id)) {
    return null;
  }

  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    return null;
  }

  if (!isRecord(value.document) || !isRecord(value.bindingDefinitions) || !isRecord(value.metadata)) {
    return null;
  }

  const metadata = value.metadata;
  if (!isValidIsoDate(metadata.createdAt) || !isValidIsoDate(metadata.updatedAt)) {
    return null;
  }

  const document = value.document as DesignerDocument & { schemaVersion?: string };
  if (!isRecord(document.nodes) || typeof document.rootNodeId !== 'string' || !document.nodes[document.rootNodeId]) {
    return null;
  }

  const documentMetadata = isRecord(document.metadata) ? document.metadata : null;
  const normalizedMetadata: DesignerDocument['metadata'] = {
    ...(documentMetadata ? structuredClone(documentMetadata) : {}),
    createdAt: documentMetadata && isValidIsoDate(documentMetadata.createdAt)
      ? documentMetadata.createdAt
      : metadata.createdAt,
    updatedAt: documentMetadata && isValidIsoDate(documentMetadata.updatedAt)
      ? documentMetadata.updatedAt
      : metadata.updatedAt,
  };
  if (documentMetadata && isRecord(documentMetadata.shellDesigner) && documentMetadata.shellDesigner.owner === 'shell-designer') {
    const parsed = shellDesignerMetadataV1Schema.safeParse(documentMetadata.shellDesigner);
    if (!parsed.success) {
      throw new ShellDesignerContractError(
        'SHELL_METADATA_INVALID',
        'Shell Designer document metadata is invalid.',
        parsed.error.issues[0]?.path.join('.'),
      );
    }
    normalizedMetadata.shellDesigner = parsed.data as unknown as ShellDesignerMetadataV1;
    if (!Number.isInteger(metadata.stateVersion) || Number(metadata.stateVersion) < 1) {
      throw new ShellDesignerContractError('SHELL_METADATA_INVALID', 'Shell Designer draft stateVersion is required.', 'metadata.stateVersion');
    }
  }
  if (documentMetadata && isRecord(documentMetadata.creativeLanding) && documentMetadata.creativeLanding.owner === 'creative-landing') {
    const parsed = creativeLandingMetadataV1Schema.safeParse(documentMetadata.creativeLanding);
    if (!parsed.success) {
      throw new ShellDesignerContractError(
        'SHELL_METADATA_INVALID',
        'Creative Landing document metadata is invalid.',
        parsed.error.issues[0]?.path.join('.'),
      );
    }
    normalizedMetadata.creativeLanding = parsed.data as CreativeLandingMetadataV1;
  }
  const normalizedDocument: DesignerDocument = normalizeDesignerDocumentFromPersist({
    ...structuredClone(document),
    metadata: normalizedMetadata,
  } as DesignerDocument);

  const tags = normalizeCatalogTags(value.tags);
  const catalogKind = parseCatalogKind(value.catalogKind);

  return {
    schema: 'component-designer-draft',
    id: value.id,
    name: value.name.trim(),
    folder: sanitizeDraftFolderName(value.folder),
    catalogKind,
    tags,
    document: normalizedDocument,
    bindingDefinitions: structuredClone(value.bindingDefinitions as Record<string, DesignerBindingDefinition>),
    workspace: (() => {
      if (!isRecord(value.workspace) || !isRecord(value.workspace.viewport)) {
        return undefined;
      }

      const viewport = normalizeDesignerViewport(value.workspace.viewport);
      return viewport ? { viewport } : undefined;
    })(),
    metadata: {
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      createdBy: typeof metadata.createdBy === 'string' ? metadata.createdBy : undefined,
      updatedBy: typeof metadata.updatedBy === 'string'
        ? metadata.updatedBy
        : (typeof metadata.lastEditedBy === 'string' ? metadata.lastEditedBy : undefined),
      stateVersion: Number.isInteger(metadata.stateVersion) && Number(metadata.stateVersion) >= 1
        ? Number(metadata.stateVersion)
        : undefined,
    },
  };
};

const componentNameLookupKey = (value: string): string =>
  sanitizeComponentFileBaseName(value).toLowerCase();

const reconcileDraftRecordWithFilePath = (
  record: DesignerDraftRecord,
  filePath: string,
): DesignerDraftRecord => {
  const draftsRoot = path.resolve(designerStoragePaths.drafts);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${draftsRoot}${path.sep}`)) {
    return record;
  }

  const relative = path.relative(draftsRoot, resolved);
  const segments = relative.split(path.sep).filter(Boolean);
  if (segments.length < 2) {
    return record;
  }

  const folderFromDisk = sanitizeDraftFolderName(segments[0]);
  const stemFromDisk = path.basename(segments[segments.length - 1], '.json');
  const folderMatches = folderFromDisk === sanitizeDraftFolderName(record.folder);
  const nameMatches = componentNameLookupKey(stemFromDisk) === componentNameLookupKey(record.name);

  if (folderMatches && nameMatches) {
    return record;
  }

  return {
    ...record,
    folder: folderFromDisk,
    name: nameMatches ? record.name : normalizeDesignerComponentName(stemFromDisk),
  };
};

export const readDraftRecordByPath = (filePath: string): DesignerDraftRecord | null => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const record = parseDraftRecord(parsed);
    if (!record) {
      return null;
    }
    return reconcileDraftRecordWithFilePath(record, filePath);
  } catch (error) {
    if (error instanceof ShellDesignerContractError) throw error;
    return null;
  }
};

const compareDraftSummariesByRecency = (left: DesignerDraftSummary, right: DesignerDraftSummary): number => {
  const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
  if (byUpdatedAt !== 0) {
    return byUpdatedAt;
  }

  return left.id.localeCompare(right.id);
};

type DraftFileScanResult = {
  summaries: DesignerDraftSummary[];
  filePathById: Map<string, string>;
};

// listDraftJsonFilePaths()+readDraftRecordByPath() used to run on every single list/get call —
// a full recursive directory walk plus a read+JSON.parse+normalize of every draft file, even
// when nothing changed since the last call. Cache the result behind a cheap (stat-only)
// signature of the drafts tree so repeated calls within the same unchanged state are O(1).
let draftFileScanCache: { signature: string; result: DraftFileScanResult } | null = null;

const collectDraftSummariesFromFiles = (): DraftFileScanResult => {
  ensureDesignerStorageDirs();
  flattenDesignerDraftStorageToDefaultFolder();

  const signature = computeDraftJsonFilesSignature();
  if (draftFileScanCache && draftFileScanCache.signature === signature) {
    return draftFileScanCache.result;
  }

  const filePathById = new Map<string, string>();
  const summaries = listDraftJsonFilePaths()
    .map((filePath) => {
      let record: DesignerDraftRecord | null = null;
      try {
        record = readDraftRecordByPath(filePath);
      } catch {
        return null;
      }
      if (record) {
        filePathById.set(record.id, filePath);
      }
      return record;
    })
    .filter((record): record is DesignerDraftRecord => Boolean(record))
    .map(toSummary)
    .sort(compareDraftSummariesByRecency);

  const result: DraftFileScanResult = { summaries, filePathById };
  draftFileScanCache = { signature, result };
  return result;
};

const normalizeIndex = (value: unknown): DesignerDraftIndex | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (value.schema !== 'component-designer-drafts-index' || !Array.isArray(value.drafts)) {
    return null;
  }

  const drafts = value.drafts
    .filter((item): item is Record<string, unknown> => isRecord(item)
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && isValidIsoDate(item.createdAt)
      && isValidIsoDate(item.updatedAt))
    .map((item) => ({
      id: sanitizeDraftId(String(item.id)),
      name: String(item.name).trim(),
      folder: sanitizeDraftFolderName(item.folder),
      createdAt: String(item.createdAt),
      updatedAt: String(item.updatedAt),
      createdBy: typeof item.createdBy === 'string' ? item.createdBy : undefined,
      updatedBy: typeof item.updatedBy === 'string'
        ? item.updatedBy
        : (typeof item.lastEditedBy === 'string' ? item.lastEditedBy : undefined),
    }));

  return {
    schema: 'component-designer-drafts-index',
    updatedAt: isValidIsoDate(value.updatedAt) ? value.updatedAt : new Date().toISOString(),
    drafts,
  };
};

export const readDraftIndex = (): DesignerDraftIndex => {
  ensureDesignerStorageDirs();

  const { summaries: summariesFromFiles } = collectDraftSummariesFromFiles();

  if (!fs.existsSync(DESIGNER_INDEX_PATH)) {
    const recovered = makeEmptyIndex();
    recovered.drafts = summariesFromFiles;
    writeDraftIndex(recovered);
    return recovered;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DESIGNER_INDEX_PATH, 'utf8')) as unknown;
    const index = normalizeIndex(parsed);
    if (!index) {
      const recovered = makeEmptyIndex();
      recovered.drafts = summariesFromFiles;
      writeDraftIndex(recovered);
      return recovered;
    }

    const summaryById = new Map(summariesFromFiles.map((item) => [item.id, item]));
    const reconciledDrafts = summariesFromFiles.map((summary) => summary);

    const needsRewrite = index.drafts.length !== reconciledDrafts.length
      || index.drafts.some((item) => {
        const current = summaryById.get(item.id);
        return !current
          || current.updatedAt !== item.updatedAt
          || current.name !== item.name
          || current.folder !== item.folder;
      });

    if (needsRewrite) {
      const repaired = {
        ...index,
        drafts: reconciledDrafts,
      };
      writeDraftIndex(repaired);
      return repaired;
    }

    return {
      ...index,
      drafts: reconciledDrafts,
    };
  } catch {
    const recovered = makeEmptyIndex();
    recovered.drafts = summariesFromFiles;
    writeDraftIndex(recovered);
    return recovered;
  }
};

export const upsertDraftIndexSummary = (summary: DesignerDraftSummary): void => {
  const index = readDraftIndex();
  const draftIndex = index.drafts.findIndex((item) => item.id === summary.id);
  if (draftIndex >= 0) {
    index.drafts[draftIndex] = summary;
  } else {
    index.drafts.push(summary);
  }
  writeDraftIndex(index);
};

export const removeDraftFromIndex = (draftId: string): void => {
  const index = readDraftIndex();
  index.drafts = index.drafts.filter((item) => item.id !== draftId);
  writeDraftIndex(index);
};

export const readDraftRecord = (draftId: string, version?: number): DesignerDraftLoadPayload | null => {
  ensureDesignerStorageDirs();
  const normalizedId = sanitizeDraftId(draftId);
  const { filePathById } = collectDraftSummariesFromFiles();
  const indexFolder = readDraftIndex().drafts.find((item) => item.id === normalizedId)?.folder;

  let record: DesignerDraftRecord | null;

  if (typeof version === 'number') {
    record = readVersionedDraftRecordBySnapshot(normalizedId, version, indexFolder);
    return record;
  }

  // Fast path: the file-scan cache already maps id -> path from the pass above (O(1) on a warm
  // cache). Fall back to the full scan/legacy-path search only for cases the cache can't cover
  // (e.g. a file whose stored id doesn't match its filename yet).
  const targetPath = filePathById.get(normalizedId) ?? resolveDraftJsonPath(normalizedId, indexFolder);
  if (!targetPath) {
    return null;
  }

  record = readDraftRecordByPath(targetPath);
  if (!record) {
    return null;
  }

  // Note: a read must not have the side effect of overwriting saved data — the reverse-parsed
  // document is served for display/comparison only, never persisted implicitly on a GET.
  const hydrated = hydrateDraftRecordFromTsxSources(record);

  return {
    ...hydrated.record,
    companionTsx: hydrated.companionTsx,
    hydratedFromTsx: hydrated.hydratedFromTsx,
    companionTsxPath: hydrated.sourcePath,
  };
};

export const listDesignerDrafts = (): DesignerDraftSummary[] => {
  const index = readDraftIndex();
  return [...index.drafts].sort(compareDraftSummariesByRecency);
};

export const readDraftRecordByComponentName = (
  componentLookup: string,
): DesignerDraftLoadPayload | null => {
  const trimmed = componentLookup.trim();
  if (!trimmed) {
    return null;
  }

  const parsedPath = parseDesignerComponentPath(trimmed);
  if (parsedPath) {
    const folder = sanitizeDraftFolderName(parsedPath.folder);
    const lookupKey = componentNameLookupKey(parsedPath.componentName);
    const index = readDraftIndex();
    const match = index.drafts.find(
      (draft) => sanitizeDraftFolderName(draft.folder) === folder
        && componentNameLookupKey(draft.name) === lookupKey,
    );

    if (match) {
      return readDraftRecord(match.id);
    }

    const filePath = draftJsonPath(parsedPath.componentName, folder);
    if (fs.existsSync(filePath)) {
      const record = readDraftRecordByPath(filePath);
      if (record && componentNameLookupKey(record.name) === lookupKey) {
        const hydrated = hydrateDraftRecordFromTsxSources(record);

        return {
          ...hydrated.record,
          companionTsx: hydrated.companionTsx,
          hydratedFromTsx: hydrated.hydratedFromTsx,
          companionTsxPath: hydrated.sourcePath,
        };
      }
    }

    const folderDir = draftFolderDirectory(folder);
    if (fs.existsSync(folderDir)) {
      for (const entry of fs.readdirSync(folderDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'index.json') {
          continue;
        }

        const baseName = entry.name.slice(0, -'.json'.length);
        if (componentNameLookupKey(baseName) !== lookupKey) {
          continue;
        }

        const record = readDraftRecordByPath(path.join(folderDir, entry.name));
        if (!record) {
          continue;
        }

        const hydrated = hydrateDraftRecordFromTsxSources(record);

        return {
          ...hydrated.record,
          companionTsx: hydrated.companionTsx,
          hydratedFromTsx: hydrated.hydratedFromTsx,
          companionTsxPath: hydrated.sourcePath,
        };
      }
    }

    return null;
  }

  const lookupKey = componentNameLookupKey(trimmed);
  const index = readDraftIndex();
  const matches = index.drafts.filter(
    (draft) => componentNameLookupKey(draft.name) === lookupKey,
  );

  if (matches.length > 0) {
    const [target] = [...matches].sort(compareDraftSummariesByRecency);
    return readDraftRecord(target.id);
  }

  const normalizedBase = sanitizeComponentFileBaseName(trimmed);
  for (const filePath of listDraftJsonFilePaths()) {
    if (path.basename(filePath, '.json') !== normalizedBase) {
      continue;
    }

    const record = readDraftRecordByPath(filePath);
    if (!record || componentNameLookupKey(record.name) !== lookupKey) {
      continue;
    }

    const hydrated = hydrateDraftRecordFromTsxSources(record);

    return {
      ...hydrated.record,
      companionTsx: hydrated.companionTsx,
      hydratedFromTsx: hydrated.hydratedFromTsx,
      companionTsxPath: hydrated.sourcePath,
    };
  }

  return null;
};

export const getDesignerDraft = (lookup: string): DesignerDraftLoadPayload | null => {
  const trimmed = lookup.trim();
  if (!trimmed) {
    return null;
  }

  if (parseDesignerComponentPath(trimmed)) {
    return readDraftRecordByComponentName(trimmed);
  }

  return readDraftRecord(trimmed) ?? readDraftRecordByComponentName(trimmed);
};

export const getDesignerDraftVersion = (draftId: string, version: number): DesignerDraftLoadPayload | null =>
  readDraftRecord(draftId, version);

export const listDesignerDraftVersions = (draftId: string): DesignerDraftSummary[] => {
  const record = getDesignerDraft(draftId);
  return record ? [toSummary(record)] : [];
};

export const designerDraftStoragePaths = {
  ...designerStoragePaths,
};
