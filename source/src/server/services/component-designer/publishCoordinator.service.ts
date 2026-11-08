import { computeDesignerPublishDiff } from '../../../domain/component-designer/publishDiff';
import { parsePinnedDesignerLoaderRef } from '../../../domain/component-designer/publishLoaderRef';
import { buildDesignerComponentPath } from '../../../shared/lib/designerComponentPath';
import { acquirePackageLock, releasePackageLock } from '../../../core/packages/PackageFileStore';
import {
  readDraftRecord,
  sanitizeDraftId,
} from '../../domain/component-designer/draftIo';
import type { DesignerDraftRecord } from '../../domain/component-designer/draftTypes';
import {
  buildDesignerPublishEntry,
  createDesignerStagingPreviewToken,
  getDesignerPublishEntry,
  listDesignerPublishedVersionSummaries,
  readDesignerStagingPreviewToken,
  resolveNextDesignerPublishVersion,
  upsertDesignerPublishEntry,
  writeDesignerVersionSnapshot,
} from '../../domain/component-designer/publishIo';
import { pinDesignerPublishedLoaderRef, propagateDesignerLayoutRoutes } from '../platform/designerRoutePropagation.service';
import { resolveDesignerDocumentPageAccess } from '../../../domain/component-designer/designerPageAccess';

const DESIGNER_PUBLISH_LOCK = 'component-designer-publish';

export type DesignerLifecycleState = 'draft' | 'saved' | 'published';

export type DesignerPublishState = {
  lifecycle: DesignerLifecycleState;
  componentPath: string;
  publishedVersion: number | null;
  loaderRef: string | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  versionHistory: ReturnType<typeof listDesignerPublishedVersionSummaries>;
};

export type DesignerPublishDiffResult = ReturnType<typeof computeDesignerPublishDiff> & {
  componentPath: string;
  publishedVersion: number | null;
};

const withPublishLock = <T>(operation: () => T): T => {
  if (!acquirePackageLock(DESIGNER_PUBLISH_LOCK)) {
    throw new Error('Component designer publish storage is busy.');
  }

  try {
    return operation();
  } finally {
    releasePackageLock(DESIGNER_PUBLISH_LOCK);
  }
};

const requireDraftRecord = (draftId: string): DesignerDraftRecord => {
  const record = readDraftRecord(draftId);
  if (!record) {
    throw new Error('Component draft not found.');
  }
  return record;
};

const loadPublishedSnapshot = (
  record: DesignerDraftRecord,
  version: number,
): DesignerDraftRecord | null => {
  const snapshot = readDraftRecord(record.id, version);
  return snapshot ?? null;
};

export const getDesignerPublishState = (
  draftId: string,
  options?: { hasUnsavedChanges?: boolean },
): DesignerPublishState => {
  const record = readDraftRecord(draftId);
  if (!record) {
    throw new Error('Component draft not found.');
  }

  const componentPath = buildDesignerComponentPath(record.folder, record.name);
  const publishEntry = getDesignerPublishEntry(componentPath);
  const versionHistory = listDesignerPublishedVersionSummaries(record.id, record.folder);
  const hasUnsavedChanges = options?.hasUnsavedChanges === true;

  if (!publishEntry) {
    return {
      lifecycle: hasUnsavedChanges ? 'draft' : 'saved',
      componentPath,
      publishedVersion: null,
      loaderRef: null,
      publishedAt: null,
      hasUnpublishedChanges: true,
      versionHistory,
    };
  }

  const publishedSnapshot = loadPublishedSnapshot(record, publishEntry.publishedVersion);
  const diff = computeDesignerPublishDiff(record.document, publishedSnapshot?.document ?? null);
  const hasUnpublishedChanges = hasUnsavedChanges
    || diff.nodesAdded > 0
    || diff.nodesRemoved > 0
    || diff.nodesChanged > 0
    || diff.propsChanged > 0;

  return {
    lifecycle: hasUnpublishedChanges ? 'saved' : 'published',
    componentPath,
    publishedVersion: publishEntry.publishedVersion,
    loaderRef: publishEntry.loaderRef,
    publishedAt: publishEntry.publishedAt,
    hasUnpublishedChanges,
    versionHistory,
  };
};

export const getDesignerPublishDiff = (draftId: string): DesignerPublishDiffResult => {
  const record = requireDraftRecord(draftId);
  const componentPath = buildDesignerComponentPath(record.folder, record.name);
  const publishEntry = getDesignerPublishEntry(componentPath);
  const publishedSnapshot = publishEntry
    ? loadPublishedSnapshot(record, publishEntry.publishedVersion)
    : null;

  return {
    componentPath,
    publishedVersion: publishEntry?.publishedVersion ?? null,
    ...computeDesignerPublishDiff(record.document, publishedSnapshot?.document ?? null),
  };
};

export const publishDesignerComponent = (
  draftId: string,
  actor?: string,
): DesignerPublishState => withPublishLock(() => {
  const record = requireDraftRecord(draftId);
  const nextVersion = resolveNextDesignerPublishVersion(record.id, record.folder);
  writeDesignerVersionSnapshot(record, nextVersion);

  const publishEntry = buildDesignerPublishEntry(record, nextVersion, actor);
  upsertDesignerPublishEntry(publishEntry);

  void pinDesignerPublishedLoaderRef({
    componentPath: publishEntry.componentPath,
    loaderRef: publishEntry.loaderRef,
    title: record.name,
    pageAccess: resolveDesignerDocumentPageAccess(record.document),
    actor: actor ? { userId: null, username: actor } : undefined,
  }).catch((error) => {
    console.error('Designer publish loader pin failed:', error);
  });

  void propagateDesignerLayoutRoutes({
    slug: record.name,
    folder: record.folder,
    title: record.name,
    pageAccess: resolveDesignerDocumentPageAccess(record.document),
    actor: actor ? { userId: null, username: actor } : undefined,
  }).catch((error) => {
    console.error('Designer publish route propagation failed:', error);
  });

  return getDesignerPublishState(record.id, { hasUnsavedChanges: false });
});

export const rollbackDesignerPublishedVersion = (
  draftId: string,
  version: number,
  actor?: string,
): DesignerPublishState => withPublishLock(() => {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Invalid publish version.');
  }

  const record = requireDraftRecord(draftId);
  const snapshot = loadPublishedSnapshot(record, version);
  if (!snapshot) {
    throw new Error(`Published version v${version} was not found.`);
  }

  const publishEntry = buildDesignerPublishEntry(snapshot, version, actor);
  upsertDesignerPublishEntry(publishEntry);

  void pinDesignerPublishedLoaderRef({
    componentPath: publishEntry.componentPath,
    loaderRef: publishEntry.loaderRef,
    title: snapshot.name,
    pageAccess: resolveDesignerDocumentPageAccess(snapshot.document),
    actor: actor ? { userId: null, username: actor } : undefined,
  }).catch((error) => {
    console.error('Designer rollback loader pin failed:', error);
  });

  void propagateDesignerLayoutRoutes({
    slug: snapshot.name,
    folder: snapshot.folder,
    title: snapshot.name,
    pageAccess: resolveDesignerDocumentPageAccess(snapshot.document),
    actor: actor ? { userId: null, username: actor } : undefined,
  }).catch((error) => {
    console.error('Designer rollback route propagation failed:', error);
  });

  return getDesignerPublishState(record.id, { hasUnsavedChanges: false });
});

export const createDesignerComponentStagingPreview = (draftId: string) => {
  const record = requireDraftRecord(draftId);
  const token = createDesignerStagingPreviewToken(record);
  return {
    token: token.token,
    expiresAt: token.expiresAt,
    previewPath: `/studio/component-preview?staging=${encodeURIComponent(token.token)}`,
  };
};

export const loadDesignerStagingPreviewPayload = (token: string) => {
  const payload = readDesignerStagingPreviewToken(token);
  if (!payload) {
    throw new Error('Staging preview link expired or is invalid.');
  }

  return payload;
};

export const resolvePublishedDesignerDraftLookup = (
  lookup: string,
): { draftId: string; version?: number; componentPath: string } | null => {
  const trimmed = lookup.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = parsePinnedDesignerLoaderRef(trimmed);
  const publishEntry = getDesignerPublishEntry(parsed.componentPath);
  const version = parsed.publishedVersion ?? publishEntry?.publishedVersion;

  if (publishEntry) {
    return {
      draftId: publishEntry.draftId,
      version,
      componentPath: publishEntry.componentPath,
    };
  }

  const record = readDraftRecord(parsed.componentPath) ?? readDraftRecord(trimmed);
  if (!record) {
    return null;
  }

  return {
    draftId: sanitizeDraftId(record.id),
    version: parsed.publishedVersion,
    componentPath: buildDesignerComponentPath(record.folder, record.name),
  };
};
