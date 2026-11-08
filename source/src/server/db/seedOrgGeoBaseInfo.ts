/**
 * Idempotent seed for platform Organization (`100.4`) and Geographic Divisions (`100.5`)
 * under Base (`100`). Removes the retired Tenant root.
 */
import {
  BASE_INFO_PLATFORM_ROOT_ID,
  GEO_BASE_INFO_ROOT_ID,
  GEO_BASE_INFO_ROOT_SHORT_NAME,
  GEO_BASE_INFO_ROOT_TITLE_EN,
  ORG_BASE_INFO_ROOT_ID,
  ORG_BASE_INFO_ROOT_SHORT_NAME,
  ORG_BASE_INFO_ROOT_TITLE_EN,
} from '../../shared/api/contracts/org-geo/constants';
import { remapBaseInfoHidWithUnpaddedChildSegments } from '../domain/base-info/baseInfoHid';
import { remapBaseInfoSubtreeByMap } from '../domain/base-info/treeRepository';
import { prisma, toUserId } from '../domain/users/prismaHelpers';

const toActor = (actorId: number | null) => (
  actorId !== null ? toUserId(actorId) : null
);

/** Former top-level org/geo/tenant roots (before they lived under Base). */
const LEGACY_ORG_ROOT_ID = '120';
const LEGACY_GEO_ROOT_ID = '121';
const LEGACY_TENANT_ROOT_ID = '122';
const TENANT_SHORT_NAME = 'platform.tenant';
const TENANT_TITLE = 'Tenant';

type OrgGeoSeedRow = {
  id: string;
  parentId: string | null;
  titleEn: string;
  shortName: string;
  viewOrder: number;
  value: number;
  uiHtml?: string | null;
};

const childId = (root: string, ...segments: number[]): string => (
  [root, ...segments].join('.')
);

const ORG_SEED_ROWS: OrgGeoSeedRow[] = [
  {
    id: ORG_BASE_INFO_ROOT_ID,
    parentId: BASE_INFO_PLATFORM_ROOT_ID,
    titleEn: ORG_BASE_INFO_ROOT_TITLE_EN,
    shortName: ORG_BASE_INFO_ROOT_SHORT_NAME,
    viewOrder: 4,
    value: 4,
    uiHtml: '<i data-lucide="Network"></i>',
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 1),
    parentId: ORG_BASE_INFO_ROOT_ID,
    titleEn: 'Board',
    shortName: 'board',
    viewOrder: 1,
    value: 1,
    uiHtml: '<i data-lucide="Landmark"></i>',
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 2),
    parentId: ORG_BASE_INFO_ROOT_ID,
    titleEn: 'CEO Office',
    shortName: 'ceo-office',
    viewOrder: 2,
    value: 2,
    uiHtml: '<i data-lucide="Briefcase"></i>',
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 3),
    parentId: ORG_BASE_INFO_ROOT_ID,
    titleEn: 'Sales',
    shortName: 'sales',
    viewOrder: 3,
    value: 3,
    uiHtml: '<i data-lucide="Handshake"></i>',
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 3, 1),
    parentId: childId(ORG_BASE_INFO_ROOT_ID, 3),
    titleEn: 'Tehran Sales',
    shortName: 'sales-tehran',
    viewOrder: 1,
    value: 1,
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 3, 2),
    parentId: childId(ORG_BASE_INFO_ROOT_ID, 3),
    titleEn: 'Isfahan Sales',
    shortName: 'sales-isfahan',
    viewOrder: 2,
    value: 2,
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 4),
    parentId: ORG_BASE_INFO_ROOT_ID,
    titleEn: 'Engineering',
    shortName: 'engineering',
    viewOrder: 4,
    value: 4,
    uiHtml: '<i data-lucide="Code2"></i>',
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 4, 1),
    parentId: childId(ORG_BASE_INFO_ROOT_ID, 4),
    titleEn: 'Frontend',
    shortName: 'eng-frontend',
    viewOrder: 1,
    value: 1,
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 4, 2),
    parentId: childId(ORG_BASE_INFO_ROOT_ID, 4),
    titleEn: 'Backend',
    shortName: 'eng-backend',
    viewOrder: 2,
    value: 2,
  },
  {
    id: childId(ORG_BASE_INFO_ROOT_ID, 5),
    parentId: ORG_BASE_INFO_ROOT_ID,
    titleEn: 'Human Resources',
    shortName: 'hr',
    viewOrder: 5,
    value: 5,
    uiHtml: '<i data-lucide="Users"></i>',
  },
];

/** Retired demo subtree (`100.5.1` …) — Hawiety uses `hwy-iraq` from ETL instead. */
const RETIRED_SAMPLE_IRAN_GEO_ROOT_ID = childId(GEO_BASE_INFO_ROOT_ID, 1);

const GEO_SEED_ROWS: OrgGeoSeedRow[] = [
  {
    id: GEO_BASE_INFO_ROOT_ID,
    parentId: BASE_INFO_PLATFORM_ROOT_ID,
    titleEn: GEO_BASE_INFO_ROOT_TITLE_EN,
    shortName: GEO_BASE_INFO_ROOT_SHORT_NAME,
    viewOrder: 5,
    value: 5,
    uiHtml: '<i data-lucide="Map"></i>',
  },
];

const listSubtreeIds = async (rootId: string): Promise<string[]> => {
  const nodes = await prisma().baseInfo.findMany({
    where: {
      OR: [{ id: rootId }, { id: { startsWith: `${rootId}.` } }],
    },
    select: { id: true },
  });
  return nodes.map((row) => row.id);
};

const deleteScopeRefsForNodeIds = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  await prisma().baseScopeMembership.deleteMany({ where: { nodeId: { in: ids } } });
  await prisma().baseScopeMembershipEvent.deleteMany({ where: { nodeId: { in: ids } } });
  await prisma().baseScopeRoleMembership.deleteMany({ where: { nodeId: { in: ids } } });
  await prisma().baseScopeRoleMembershipEvent.deleteMany({ where: { nodeId: { in: ids } } });
};

const deleteBaseInfoSubtree = async (rootId: string): Promise<void> => {
  const ids = await listSubtreeIds(rootId);
  if (ids.length === 0) return;
  await deleteScopeRefsForNodeIds(ids);
  const deepestFirst = [...ids].sort((a, b) => b.length - a.length);
  for (const id of deepestFirst) {
    await prisma().baseInfo.delete({ where: { id } });
  }
};

const isOrganizationNode = (row: {
  title: string | null;
  shortName: string | null;
}): boolean => {
  const title = String(row.title || '').trim().toLowerCase();
  const shortName = String(row.shortName || '').trim();
  return title === 'organization' || shortName === ORG_BASE_INFO_ROOT_SHORT_NAME;
};

/** `100.4` used to be a retired Cities placeholder — wipe it unless it is already Organization. */
const removeSampleIranGeoSubtree = async (): Promise<void> => {
  const legacySeedRoot = await prisma().baseInfo.findUnique({
    where: { id: RETIRED_SAMPLE_IRAN_GEO_ROOT_ID },
    select: { id: true },
  });
  if (legacySeedRoot) {
    await deleteBaseInfoSubtree(RETIRED_SAMPLE_IRAN_GEO_ROOT_ID);
    return;
  }

  const byShortName = await prisma().baseInfo.findFirst({
    where: { parentId: GEO_BASE_INFO_ROOT_ID, shortName: 'iran' },
    select: { id: true },
  });
  if (byShortName) {
    await deleteBaseInfoSubtree(byShortName.id);
  }
};

const removeRetiredCitiesPlaceholder = async (): Promise<void> => {
  const node = await prisma().baseInfo.findUnique({
    where: { id: ORG_BASE_INFO_ROOT_ID },
    select: { title: true, shortName: true },
  });
  if (!node) return;
  if (isOrganizationNode(node)) return;
  await deleteBaseInfoSubtree(ORG_BASE_INFO_ROOT_ID);
};

const collectTenantRootIds = async (): Promise<string[]> => {
  const rows = await prisma().baseInfo.findMany({
    where: {
      OR: [
        { id: LEGACY_TENANT_ROOT_ID },
        { shortName: TENANT_SHORT_NAME },
        { title: TENANT_TITLE, parentId: null },
      ],
    },
    select: { id: true, parentId: true, title: true, shortName: true },
  });

  const roots = new Set<string>();
  for (const row of rows) {
    if (row.id === LEGACY_TENANT_ROOT_ID || row.id.startsWith(`${LEGACY_TENANT_ROOT_ID}.`)) {
      roots.add(LEGACY_TENANT_ROOT_ID);
      continue;
    }
    const title = String(row.title || '').trim();
    const shortName = String(row.shortName || '').trim();
    const isTenantLabel = shortName === TENANT_SHORT_NAME || title === TENANT_TITLE;
    if (!isTenantLabel) continue;
    const isPlatformRoot = row.parentId === null || row.parentId === BASE_INFO_PLATFORM_ROOT_ID;
    if (!isPlatformRoot && shortName !== TENANT_SHORT_NAME) continue;
    roots.add(row.id);
  }
  return [...roots];
};

const removeTenantBaseInfo = async (): Promise<void> => {
  const rootIds = await collectTenantRootIds();
  for (const rootId of rootIds) {
    await deleteBaseInfoSubtree(rootId);
  }
  await prisma().baseScopeMembership.deleteMany({ where: { dimensionKey: 'tenant' } });
  await prisma().baseScopeMembershipEvent.deleteMany({ where: { dimensionKey: 'tenant' } });
  await prisma().baseScopeRoleMembership.deleteMany({ where: { dimensionKey: 'tenant' } });
  await prisma().baseScopeRoleMembershipEvent.deleteMany({ where: { dimensionKey: 'tenant' } });
};

const migrateLegacyRootUnderBase = async (
  oldRootId: string,
  newRootId: string,
  actorId: number | null,
): Promise<void> => {
  const oldNode = await prisma().baseInfo.findUnique({
    where: { id: oldRootId },
    select: { id: true },
  });
  if (!oldNode) return;

  const newNode = await prisma().baseInfo.findUnique({
    where: { id: newRootId },
    select: { id: true },
  });
  if (newNode) {
    await deleteBaseInfoSubtree(oldRootId);
    return;
  }

  await remapBaseInfoSubtreeByMap({
    oldRootId,
    nextParentId: BASE_INFO_PLATFORM_ROOT_ID,
    actorId,
    mapId: (id) => remapBaseInfoHidWithUnpaddedChildSegments(id, oldRootId, newRootId),
  });
};

const upsertSeedRow = async (row: OrgGeoSeedRow, actorId: number | null) => {
  const actor = toActor(actorId);
  await prisma().baseInfo.upsert({
    where: { id: row.id },
    update: {
      parentId: row.parentId,
      title: row.titleEn,
      shortName: row.shortName,
      viewOrder: row.viewOrder,
      value: row.value,
      isActive: true,
      uiHtml: row.uiHtml ?? null,
      updatedBy: actor,
    },
    create: {
      id: row.id,
      parentId: row.parentId,
      title: row.titleEn,
      shortName: row.shortName,
      viewOrder: row.viewOrder,
      value: row.value,
      isActive: true,
      uiHtml: row.uiHtml ?? null,
      createdBy: actor,
      updatedBy: actor,
    },
  });
};

export async function seedOrgGeoBaseInfo(actorId: number | null): Promise<void> {
  await removeRetiredCitiesPlaceholder();
  await removeSampleIranGeoSubtree();
  await removeTenantBaseInfo();
  await migrateLegacyRootUnderBase(LEGACY_ORG_ROOT_ID, ORG_BASE_INFO_ROOT_ID, actorId);
  await migrateLegacyRootUnderBase(LEGACY_GEO_ROOT_ID, GEO_BASE_INFO_ROOT_ID, actorId);
  await deleteBaseInfoSubtree(LEGACY_ORG_ROOT_ID);
  await deleteBaseInfoSubtree(LEGACY_GEO_ROOT_ID);
  await deleteBaseInfoSubtree(LEGACY_TENANT_ROOT_ID);

  for (const row of [...ORG_SEED_ROWS, ...GEO_SEED_ROWS]) {
    await upsertSeedRow(row, actorId);
  }
}
