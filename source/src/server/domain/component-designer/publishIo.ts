import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import { buildPinnedDesignerLoaderRef } from '../../../domain/component-designer/publishLoaderRef';
import { buildDesignerComponentPath, canonicalizeDesignerItemSlug } from '../../../shared/lib/designerComponentPath';
import {
  draftSnapshotDirectory,
  draftSnapshotLatestPath,
  ensureDirectory,
  sanitizeDraftFolderName,
  sanitizeDraftId,
  versionedDraftSnapshotPath,
} from './draftFolderPaths';
import { readDraftRecordByPath } from './draftIo';
import type { DesignerDraftRecord } from './draftTypes';
import { ensureDesignerStoragePaths } from './storage';

export type DesignerPublishEntry = {
  draftId: string;
  componentPath: string;
  publishedVersion: number;
  loaderRef: string;
  publishedAt: string;
  publishedBy?: string;
};

export type DesignerPublishIndex = {
  schema: 'component-designer-publish-index';
  updatedAt: string;
  components: Record<string, DesignerPublishEntry>;
};

export type DesignerPublishedVersionSummary = {
  version: number;
  publishedAt: string;
  publishedBy?: string;
  name: string;
};

export type DesignerStagingPreviewToken = {
  schema: 'component-designer-staging-preview';
  token: string;
  draftId: string;
  componentPath: string;
  document: DesignerDraftRecord['document'];
  bindingDefinitions: DesignerDraftRecord['bindingDefinitions'];
  createdAt: string;
  expiresAt: string;
};

const PUBLISH_INDEX_PATH = path.join(runtimeDirs.designer, 'publish', 'index.json');
const STAGING_TOKENS_DIR = path.join(runtimeDirs.designer, 'staging-tokens');
const STAGING_TTL_MS = 24 * 60 * 60 * 1000;

export const ensureDesignerPublishStorage = (): void => {
  ensureDesignerStoragePaths();
  fs.mkdirSync(path.dirname(PUBLISH_INDEX_PATH), { recursive: true });
  fs.mkdirSync(STAGING_TOKENS_DIR, { recursive: true });
};

const makeEmptyPublishIndex = (): DesignerPublishIndex => ({
  schema: 'component-designer-publish-index',
  updatedAt: new Date().toISOString(),
  components: {},
});

export const readDesignerPublishIndex = (): DesignerPublishIndex => {
  ensureDesignerPublishStorage();
  if (!fs.existsSync(PUBLISH_INDEX_PATH)) {
    return makeEmptyPublishIndex();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(PUBLISH_INDEX_PATH, 'utf8')) as DesignerPublishIndex;
    if (parsed?.schema !== 'component-designer-publish-index' || !parsed.components) {
      return makeEmptyPublishIndex();
    }
    return parsed;
  } catch {
    return makeEmptyPublishIndex();
  }
};

export const writeDesignerPublishIndex = (index: DesignerPublishIndex): void => {
  ensureDesignerPublishStorage();
  index.updatedAt = new Date().toISOString();
  atomicWriteText(PUBLISH_INDEX_PATH, JSON.stringify(index, null, 2), runtimeDirs.workspaceTemp);
};

export const getDesignerPublishEntry = (componentPath: string): DesignerPublishEntry | null => {
  const normalized = componentPath.trim();
  if (!normalized) {
    return null;
  }

  const index = readDesignerPublishIndex();
  const exact = index.components[normalized];
  if (exact) {
    return exact;
  }

  const name = canonicalizeDesignerItemSlug(normalized);
  if (!name) {
    return null;
  }

  return Object.values(index.components).find((entry) => (
    canonicalizeDesignerItemSlug(entry.componentPath) === name
  )) ?? null;
};

export const upsertDesignerPublishEntry = (entry: DesignerPublishEntry): DesignerPublishEntry => {
  const index = readDesignerPublishIndex();
  index.components[entry.componentPath] = entry;
  writeDesignerPublishIndex(index);
  return entry;
};

export const removeDesignerPublishEntry = (componentPath: string): void => {
  const index = readDesignerPublishIndex();
  delete index.components[componentPath.trim()];
  writeDesignerPublishIndex(index);
};

export const listDesignerPublishEntriesForDraft = (draftId: string): Array<{
  componentPath: string;
  entry: DesignerPublishEntry;
}> => {
  const normalized = draftId.trim();
  if (!normalized) {
    return [];
  }

  return Object.entries(readDesignerPublishIndex().components)
    .filter(([, entry]) => entry.draftId === normalized)
    .map(([componentPath, entry]) => ({ componentPath, entry }));
};

export const removeDesignerPublishEntriesForDraft = (draftId: string): void => {
  const normalized = draftId.trim();
  if (!normalized) {
    return;
  }

  const index = readDesignerPublishIndex();
  let changed = false;
  for (const [componentPath, entry] of Object.entries(index.components)) {
    if (entry.draftId !== normalized) {
      continue;
    }
    delete index.components[componentPath];
    changed = true;
  }
  if (changed) {
    writeDesignerPublishIndex(index);
  }
};

export const removeDesignerStagingTokensForDraft = (draftId: string): void => {
  ensureDesignerPublishStorage();
  const normalized = draftId.trim();
  if (!normalized || !fs.existsSync(STAGING_TOKENS_DIR)) {
    return;
  }

  for (const fileName of fs.readdirSync(STAGING_TOKENS_DIR)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const filePath = path.join(STAGING_TOKENS_DIR, fileName);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as DesignerStagingPreviewToken;
      if (parsed?.draftId === normalized) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore unreadable staging tokens.
    }
  }
};

export const writeDesignerVersionSnapshot = (
  record: DesignerDraftRecord,
  version: number,
): string => {
  ensureDesignerPublishStorage();
  const folder = sanitizeDraftFolderName(record.folder);
  const draftId = sanitizeDraftId(record.id);
  const versionedPath = versionedDraftSnapshotPath(draftId, folder, version);
  const latestPath = draftSnapshotLatestPath(draftId, folder);

  ensureDirectory(path.dirname(versionedPath));
  atomicWriteText(versionedPath, JSON.stringify(record, null, 2), runtimeDirs.workspaceTemp);
  atomicWriteText(latestPath, JSON.stringify(record, null, 2), runtimeDirs.workspaceTemp);

  return versionedPath;
};

export const listDesignerPublishedVersionSummaries = (
  draftId: string,
  folder: unknown,
): DesignerPublishedVersionSummary[] => {
  const normalizedId = sanitizeDraftId(draftId);
  const snapshotDir = draftSnapshotDirectory(normalizedId, folder);
  if (!fs.existsSync(snapshotDir)) {
    return [];
  }

  return fs.readdirSync(snapshotDir)
    .filter((fileName) => fileName.endsWith('.json') && fileName !== 'latest.json')
    .map<DesignerPublishedVersionSummary | null>((fileName) => {
      const version = Number(fileName.replace(/\.json$/, ''));
      const record = readDraftRecordByPath(path.join(snapshotDir, fileName));
      if (!record || !Number.isInteger(version) || version < 1) {
        return null;
      }

      return {
        version,
        publishedAt: record.metadata.updatedAt,
        publishedBy: record.metadata.updatedBy,
        name: record.name,
      } satisfies DesignerPublishedVersionSummary;
    })
    .filter((item): item is DesignerPublishedVersionSummary => item !== null)
    .sort((left, right) => right.version - left.version);
};

export const resolveNextDesignerPublishVersion = (
  draftId: string,
  folder: unknown,
): number => {
  const snapshotDir = draftSnapshotDirectory(sanitizeDraftId(draftId), folder);
  if (!fs.existsSync(snapshotDir)) {
    return 1;
  }
  const allocated = fs.readdirSync(snapshotDir)
    .map((fileName) => Number(fileName.replace(/\.json$/, '')))
    .filter((version) => Number.isInteger(version) && version >= 1);
  return allocated.length > 0 ? Math.max(...allocated) + 1 : 1;
};

export const buildDesignerPublishEntry = (
  record: DesignerDraftRecord,
  version: number,
  actor?: string,
): DesignerPublishEntry => {
  const componentPath = buildDesignerComponentPath(record.folder, record.name);
  return {
    draftId: record.id,
    componentPath,
    publishedVersion: version,
    loaderRef: buildPinnedDesignerLoaderRef(componentPath, version),
    publishedAt: new Date().toISOString(),
    publishedBy: actor,
  };
};

const stagingTokenPath = (token: string): string =>
  path.join(STAGING_TOKENS_DIR, `${token}.json`);

export const createDesignerStagingPreviewToken = (
  record: DesignerDraftRecord,
): DesignerStagingPreviewToken => {
  ensureDesignerPublishStorage();
  const token = globalThis.crypto?.randomUUID?.().replace(/-/g, '') ?? `staging-${Date.now()}`;
  const now = new Date();
  const payload: DesignerStagingPreviewToken = {
    schema: 'component-designer-staging-preview',
    token,
    draftId: record.id,
    componentPath: buildDesignerComponentPath(record.folder, record.name),
    document: structuredClone(record.document),
    bindingDefinitions: structuredClone(record.bindingDefinitions),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + STAGING_TTL_MS).toISOString(),
  };

  atomicWriteText(stagingTokenPath(token), JSON.stringify(payload, null, 2), runtimeDirs.workspaceTemp);
  return payload;
};

export const readDesignerStagingPreviewToken = (token: string): DesignerStagingPreviewToken | null => {
  ensureDesignerPublishStorage();
  const normalized = token.trim();
  if (!normalized) {
    return null;
  }

  const filePath = stagingTokenPath(normalized);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as DesignerStagingPreviewToken;
    if (parsed?.schema !== 'component-designer-staging-preview') {
      return null;
    }

    if (Date.parse(parsed.expiresAt) < Date.now()) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        return null;
      }
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const designerPublishStoragePaths = {
  publishIndex: PUBLISH_INDEX_PATH,
  stagingTokens: STAGING_TOKENS_DIR,
} as const;
