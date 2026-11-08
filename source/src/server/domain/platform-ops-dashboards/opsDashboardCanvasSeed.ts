import { acquirePackageLock, releasePackageLock } from '../../../core/packages/PackageFileStore';
import {
  assertPersistableDesignerDocument,
  prepareDesignerDocumentForPersist,
} from '../../../domain/component-designer/documentPersist';
import { resolveCanonicalDesignerDraftFolder } from '../../../shared/lib/designerShellEntry';
import {
  OPS_DASHBOARD_DRAFT_IDS,
  OPS_DASHBOARD_PAGE_KEYS,
  OPS_DASHBOARD_ROUTES,
  type OpsDashboardPageKey,
} from '../../../shared/lib/opsDashboardCatalog';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { StoredDataSource } from '../../db/dataSourcesStore';
import {
  ensureDesignerStorageDirs,
  readDraftIndex,
  readDraftRecord,
  toSummary,
  writeDraftFile,
  writeDraftIndex,
} from '../component-designer/draftIo';
import { writeDesignerDraftTsxExport } from '../component-designer/draftTsxExport';
import type { DesignerDraftRecord } from '../component-designer/draftTypes';
import {
  listDesignerPublishEntriesForDraft,
  buildDesignerPublishEntry,
  resolveNextDesignerPublishVersion,
  upsertDesignerPublishEntry,
  writeDesignerVersionSnapshot,
} from '../component-designer/publishIo';
import {
  findLatestPlatformRouteBindingId,
  insertPlatformRouteBinding,
  listPlatformRouteBindingRows,
  updatePlatformRouteBinding,
} from '../platform';
import { pinDesignerPublishedLoaderRef } from '../../services/platform/designerRoutePropagation.service';
import { invalidatePlatformRuntimeConfig } from '../../services/platform/platformRuntimeConfig.service';
import { buildOpsDashboardDocuments } from './opsDashboardCanvasDocuments';

const ACTOR_LABEL = 'platform-ops-dashboards';
const ACTOR = { userId: null, username: ACTOR_LABEL };
const DESIGNER_LOCK = 'component-designer-drafts';

const ADMIN_AUTH = {
  accessMode: 'specific' as const,
  allowRoles: ['ADMIN'],
  allowUsers: [] as string[],
  denyRoles: [] as string[],
  denyUsers: [] as string[],
};

const persistDraftWithoutRoutePropagation = (record: DesignerDraftRecord): DesignerDraftRecord => {
  ensureDesignerStorageDirs();
  if (!acquirePackageLock(DESIGNER_LOCK)) {
    throw new Error('Component designer draft storage is busy.');
  }

  try {
    writeDraftFile(record);
    writeDesignerDraftTsxExport(record);
    const index = readDraftIndex();
    const summary = toSummary(record);
    const existingIndex = index.drafts.findIndex((item) => item.id === record.id);
    if (existingIndex >= 0) {
      index.drafts[existingIndex] = summary;
    } else {
      index.drafts.push(summary);
    }
    writeDraftIndex(index);
    return record;
  } finally {
    releasePackageLock(DESIGNER_LOCK);
  }
};

const persistOpsDashboardDraft = (
  pageKey: OpsDashboardPageKey,
  document: ReturnType<typeof buildOpsDashboardDocuments>[OpsDashboardPageKey],
): DesignerDraftRecord => {
  const now = new Date().toISOString();
  const draftId = OPS_DASHBOARD_DRAFT_IDS[pageKey];
  const existing = readDraftRecord(draftId);
  const folder = resolveCanonicalDesignerDraftFolder('general');
  const prepared = prepareDesignerDocumentForPersist(document, {
    draftId,
    draftName: pageKey,
  });
  assertPersistableDesignerDocument(prepared);
  const record: DesignerDraftRecord = {
    schema: 'component-designer-draft',
    id: draftId,
    name: pageKey,
    folder,
    document: {
      ...prepared,
      metadata: {
        ...prepared.metadata,
        createdAt: existing?.metadata.createdAt ?? prepared.metadata.createdAt ?? now,
        updatedAt: now,
      },
    },
    bindingDefinitions: existing?.bindingDefinitions ?? {},
    metadata: {
      createdAt: existing?.metadata.createdAt ?? now,
      updatedAt: now,
      createdBy: existing?.metadata.createdBy ?? ACTOR_LABEL,
      updatedBy: ACTOR_LABEL,
    },
  };
  return persistDraftWithoutRoutePropagation(record);
};

const publishOpsDashboardDraft = async (
  record: DesignerDraftRecord,
  pageKey: OpsDashboardPageKey,
): Promise<void> => {
  const nextVersion = resolveNextDesignerPublishVersion(record.id, record.folder);
  writeDesignerVersionSnapshot(record, nextVersion);
  const publishEntry = buildDesignerPublishEntry(record, nextVersion, ACTOR_LABEL);
  upsertDesignerPublishEntry(publishEntry);
  await pinDesignerPublishedLoaderRef({
    componentPath: publishEntry.componentPath,
    loaderRef: publishEntry.loaderRef,
    title: OPS_DASHBOARD_ROUTES[pageKey].title,
    pageAccess: record.document.pageAccess,
    actor: ACTOR,
  });
};

const upsertInsightsRouteBinding = async (pageKey: OpsDashboardPageKey): Promise<void> => {
  const route = OPS_DASHBOARD_ROUTES[pageKey];
  const authJson = JSON.stringify(ADMIN_AUTH);
  const latest = await findLatestPlatformRouteBindingId('studio', route.pattern);
  if (latest?.id) {
    await updatePlatformRouteBinding(
      latest.id,
      {
        routePattern: route.pattern,
        pageKey,
        enabled: true,
        authJson,
        navJson: null,
        source: 'manual',
      },
      ACTOR,
    );
    return;
  }

  await insertPlatformRouteBinding(
    {
      mountId: 'studio',
      routePattern: route.pattern,
      pageKey,
      enabled: true,
      authJson,
      navJson: null,
      source: 'manual',
    },
    ACTOR,
  );
};

const disableAutoDesignerRoutes = async (): Promise<void> => {
  const expected = new Map(
    OPS_DASHBOARD_PAGE_KEYS.map((pageKey) => [pageKey, OPS_DASHBOARD_ROUTES[pageKey].pattern]),
  );
  const bindings = await listPlatformRouteBindingRows();
  for (const binding of bindings) {
    if (!(OPS_DASHBOARD_PAGE_KEYS as readonly string[]).includes(binding.pageKey)) {
      continue;
    }
    const pattern = expected.get(binding.pageKey as OpsDashboardPageKey);
    if (binding.routePattern === pattern && binding.nav == null) {
      continue;
    }
    if (binding.source !== 'auto') {
      continue;
    }
    await updatePlatformRouteBinding(
      binding.id,
      {
        routePattern: binding.routePattern,
        pageKey: binding.pageKey,
        enabled: false,
        authJson: binding.auth ? JSON.stringify(binding.auth) : null,
        navJson: null,
        source: binding.source,
      },
      ACTOR,
    );
  }
};

export const seedOpsDashboardCanvases = async (
  dataSource: StoredDataSource,
  models: Map<string, EdgeModelDefinition>,
): Promise<void> => {
  const documents = buildOpsDashboardDocuments(dataSource, models);
  for (const pageKey of OPS_DASHBOARD_PAGE_KEYS) {
    const draftId = OPS_DASHBOARD_DRAFT_IDS[pageKey];
    const alreadyPublished = listDesignerPublishEntriesForDraft(draftId).length > 0;
    if (!alreadyPublished) {
      const record = persistOpsDashboardDraft(pageKey, documents[pageKey]);
      await publishOpsDashboardDraft(record, pageKey);
    }
    await upsertInsightsRouteBinding(pageKey);
  }
  await disableAutoDesignerRoutes();
  invalidatePlatformRuntimeConfig();
};
