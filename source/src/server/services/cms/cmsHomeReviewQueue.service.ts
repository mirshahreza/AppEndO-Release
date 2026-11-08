import { SETTINGS_PATH } from '../../config/settingsFile';
import { getDataSourcesFromSettings } from '../../db/dataSourcesStore';
import {
  buildCmsAwaitingReviewStatusFilter,
  resolveCmsEditorialStatusIds,
} from '../../domain/cms/cmsEditorialStatusIds';
import { DataApiExecutor } from '../data-api/dataApiExecutor';
import { getEdgeApiDefinitionByKey } from '../data-api/edgeApiStore';
import type { EdgeApiDefinition, EdgeApiOperation } from '../../../shared/api/contracts/data-api';
import type { CmsHomeReviewQueueItem } from '../../../shared/api/contracts/cms-home/types';
import { prisma } from '../../domain/users/prismaHelpers';

const CMS_CONTENTS_API_KEY = 'cms-contents';
const REVIEW_QUEUE_LIMIT = 8;

export type CmsHomeReviewQueueActor = {
  userId: number;
  email: string;
  roles: string[];
  isAdmin: boolean;
};

let executorSingleton: DataApiExecutor | null = null;

const getExecutor = (): DataApiExecutor => {
  if (!executorSingleton) {
    executorSingleton = new DataApiExecutor({
      getDataSources: () => getDataSourcesFromSettings(SETTINGS_PATH),
    });
  }
  return executorSingleton;
};

export const __resetCmsHomeReviewQueueExecutorForTests = (): void => {
  executorSingleton = null;
};

const findListOperation = (definition: EdgeApiDefinition): EdgeApiOperation | null => (
  definition.operations.find((op) => op.enabled && op.kind === 'list') ?? null
);

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const toQueueItem = (
  row: Record<string, unknown>,
  statusLabels: Map<string, string>,
): CmsHomeReviewQueueItem | null => {
  const idRaw = row.id ?? row.Id;
  const id = typeof idRaw === 'number' || typeof idRaw === 'string' ? String(idRaw) : null;
  if (!id) {
    return null;
  }
  const statusCode = typeof row.statusCode === 'string' ? row.statusCode : '';
  const titleRaw = typeof row.title === 'string' ? row.title.trim() : '';
  const slug = typeof row.slug === 'string' ? row.slug : null;
  const statusLabelFromRow = typeof row.statusCodeTitle === 'string' ? row.statusCodeTitle : null;
  const updatedAt = typeof row.updatedAt === 'string' ? row.updatedAt : null;
  const contentTypeCode = typeof row.contentTypeCode === 'string' ? row.contentTypeCode : null;
  return {
    id,
    title: titleRaw || slug || id,
    slug,
    statusCode,
    statusLabel: statusLabelFromRow ?? statusLabels.get(statusCode) ?? null,
    contentTypeCode,
    updatedAt,
  };
};

async function loadStatusLabels(statusCodes: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(statusCodes.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }
  const rows = await prisma().baseInfo.findMany({
    where: { id: { in: unique } },
    select: { id: true, title: true },
  });
  return new Map(rows.map((row) => [row.id, row.title?.trim() || row.id]));
}

export async function listCmsHomeReviewQueue(
  actor: CmsHomeReviewQueueActor,
): Promise<{ totalCount: number; items: CmsHomeReviewQueueItem[] }> {
  const statusIds = await resolveCmsEditorialStatusIds();
  if (!statusIds) {
    return { totalCount: 0, items: [] };
  }

  const filterCodes = buildCmsAwaitingReviewStatusFilter(statusIds);
  if (filterCodes.length === 0) {
    return { totalCount: 0, items: [] };
  }

  const definition = getEdgeApiDefinitionByKey(CMS_CONTENTS_API_KEY);
  if (!definition?.publishedAt) {
    return { totalCount: 0, items: [] };
  }

  const listOp = findListOperation(definition);
  if (!listOp) {
    return { totalCount: 0, items: [] };
  }

  const listed = await getExecutor().execute({
    edgeApiDefinitionId: definition.id,
    operationId: listOp.id,
    query: {
      'filter[statusCode][in]': filterCodes.join(','),
      sort: '-updatedAt',
      pageSize: String(REVIEW_QUEUE_LIMIT),
      page: '1',
    },
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorRoles: actor.roles,
    actorIsAdmin: actor.isAdmin,
  });

  const rows = Array.isArray(listed.data) ? listed.data : [];
  const parsed = rows
    .map((row) => toQueueItem(asRecord(row) ?? {}, new Map()))
    .filter((item): item is CmsHomeReviewQueueItem => item !== null);

  const statusLabels = await loadStatusLabels(parsed.map((item) => item.statusCode));
  const items = parsed.map((item) => ({
    ...item,
    statusLabel: item.statusLabel ?? statusLabels.get(item.statusCode) ?? null,
  }));

  const totalRaw = listed.count;
  const totalCount = typeof totalRaw === 'number' ? totalRaw : items.length;

  return { totalCount, items };
}
