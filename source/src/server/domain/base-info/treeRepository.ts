import { resolveBaseInfoCultureId } from '../../../shared/lib/baseInfoCultureTranslations';
import {
  persistBaseInfoLocaleTextsWithSqlMirror,
  readBaseInfoLocaleTexts,
} from './baseInfoCultureTranslationStore';
import {
  mapBaseInfoRowsForCulture,
  toViewOrderNumber,
} from './baseInfoListMapping';
import {
  assignBaseInfoTitlePathForNewNode,
  recomputeBaseInfoTitlePathsForSubtree,
  shouldRecomputeBaseInfoTitlePathsAfterSave,
} from './baseInfoTitlePath';
import {
  calculateBaseInfoHierarchicalId as allocateBaseInfoHierarchicalId,
  insertBaseInfoNodeWithHid,
} from './baseInfoHid';
import { orderByViewOrderThenId, prisma, toUserId } from '../users/prismaHelpers';

const parseListFilters = (
  cultureId: string,
  activeClause: string,
  rootClause: string,
  params: unknown[],
) => ({
  cultureId: resolveBaseInfoCultureId(cultureId),
  includeInactive: activeClause.trim() === '',
  root: rootClause.trim() ? String(params[0] ?? '').trim() || undefined : undefined,
});

const buildRootWhere = (root?: string) => {
  if (!root) return {};
  return {
    OR: [{ id: root }, { parentId: root }],
  };
};

const optionsSelect = {
  id: true,
  parentId: true,
  title: true,
  value: true,
  isActive: true,
  viewOrder: true,
  note: true,
  uiColor: true,
  uiHtml: true,
} as const;

const treeSelect = {
  ...optionsSelect,
  shortName: true,
  metadata: true,
} as const;

const listOrderBy = orderByViewOrderThenId();

const treeListOrderBy = [
  { parentId: 'asc' as const },
  ...orderByViewOrderThenId(),
];

export async function listBaseInfoOptionsRows(
  cultureId: string,
  activeClause: string,
  rootClause: string,
  params: unknown[],
) {
  const { cultureId: resolvedCultureId, includeInactive, root } = parseListFilters(
    cultureId,
    activeClause,
    rootClause,
    params,
  );
  const rows = await prisma().baseInfo.findMany({
    where: {
      ...buildRootWhere(root),
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: optionsSelect,
    orderBy: listOrderBy,
  });
  return mapBaseInfoRowsForCulture(rows, resolvedCultureId, (row, context) => ({
    id: row.id,
    parent_id: row.parentId,
    label: context.label,
    title: row.title,
    title_path: context.titlePath,
    short_name: row.shortName,
    value: row.value,
    is_active: row.isActive,
    view_order: toViewOrderNumber(row.viewOrder),
    note: context.resolvedNote,
    ui_color: row.uiColor,
    ui_html: row.uiHtml,
  }));
}

export async function listBaseInfoTreeRows(
  cultureId: string,
  activeClause: string,
  rootClause: string,
  params: unknown[],
) {
  const { cultureId: resolvedCultureId, includeInactive, root } = parseListFilters(
    cultureId,
    activeClause,
    rootClause,
    params,
  );
  const rows = await prisma().baseInfo.findMany({
    where: {
      ...buildRootWhere(root),
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: treeSelect,
    orderBy: treeListOrderBy,
  });
  return mapBaseInfoRowsForCulture(rows, resolvedCultureId, (row, context) => ({
    id: row.id,
    parent_id: row.parentId,
    label: context.label,
    title: row.title,
    title_path: context.titlePath,
    short_name: row.shortName,
    note: row.note,
    note_display: context.resolvedNote,
    metadata: row.metadata,
    value: row.value,
    is_active: row.isActive,
    view_order: toViewOrderNumber(row.viewOrder),
    ui_color: row.uiColor,
    ui_html: row.uiHtml,
  }));
}

const parseChildrenFilters = (
  titleColumn: string,
  whereClause: string,
  activeClause: string,
  params: unknown[],
) => {
  const trimmedWhere = whereClause.trim();
  let parentFilter: { parentId: string | null } | { id: string } | { parentId: null } = { parentId: null };

  if (trimmedWhere.includes('parent_id =')) {
    parentFilter = { parentId: String(params[0] ?? '') };
  } else if (trimmedWhere.includes('n.id =') || trimmedWhere.endsWith('id = ?')) {
    parentFilter = { id: String(params[0] ?? '') };
  }

  return {
    cultureId: resolveBaseInfoCultureId(titleColumn),
    includeInactive: activeClause.trim() === '',
    parentFilter,
  };
};

const loadChildPresence = async (nodeIds: string[], includeInactive: boolean) => {
  if (nodeIds.length === 0) return new Set<string>();

  const parents = await prisma().baseInfo.findMany({
    where: {
      parentId: { in: nodeIds },
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: { parentId: true },
    distinct: ['parentId'],
  });

  return new Set(parents.map((row) => row.parentId).filter((id): id is string => Boolean(id)));
};

export async function listBaseInfoChildrenRows(
  cultureId: string,
  whereClause: string,
  activeClause: string,
  includeInactive: boolean,
  params: unknown[],
) {
  const { cultureId: resolvedCultureId, includeInactive: includeInactiveFromClause, parentFilter } =
    parseChildrenFilters(cultureId, whereClause, activeClause, params);
  const effectiveIncludeInactive = includeInactive || includeInactiveFromClause;

  const rows = await prisma().baseInfo.findMany({
    where: {
      ...parentFilter,
      ...(effectiveIncludeInactive ? {} : { isActive: true }),
    },
    select: treeSelect,
    orderBy: listOrderBy,
  });

  const parentsWithChildren = await loadChildPresence(
    rows.map((row) => row.id),
    includeInactive,
  );

  const mapped = await mapBaseInfoRowsForCulture(rows, resolvedCultureId, (row, context) => ({
    id: row.id,
    parent_id: row.parentId,
    label: context.label,
    title: row.title,
    title_path: context.titlePath,
    short_name: row.shortName,
    note: row.note,
    note_display: context.resolvedNote,
    metadata: row.metadata,
    value: row.value,
    is_active: row.isActive,
    view_order: toViewOrderNumber(row.viewOrder),
    ui_color: row.uiColor,
    ui_html: row.uiHtml,
  }));

  return mapped.map((row) => ({
    ...row,
    has_children: parentsWithChildren.has(String(row.id)),
  }));
}

/**
 * Single-node payload for Designer / form edit loads.
 * CamelCase matches POST/PUT body fields (list/children stay snake_case).
 */
export async function getBaseInfoNodeForForm(nodeId: string) {
  const trimmed = nodeId.trim();
  if (!trimmed) {
    return undefined;
  }

  const row = await prisma().baseInfo.findUnique({
    where: { id: trimmed },
    select: treeSelect,
  });
  if (!row) {
    return undefined;
  }

  const locales = readBaseInfoLocaleTexts(row.id, {
    title: row.title,
    note: row.note,
  });

  return {
    id: row.id,
    parentId: row.parentId,
    title: row.title,
    shortName: row.shortName,
    viewOrder: toViewOrderNumber(row.viewOrder),
    note: row.note,
    metadata: row.metadata,
    value: row.value,
    isActive: row.isActive,
    uiColor: row.uiColor,
    uiHtml: row.uiHtml,
    locales,
  };
}

export async function insertBaseInfoNode(params: unknown[]) {
  const [
    parentId,
    childDigits,
    title,
    shortName,
    viewOrder,
    note,
    metadata,
    value,
    isActive,
    uiColor,
    uiHtml,
    locales,
    actorId,
  ] = params as [
    string | null,
    number,
    string | null,
    string | null,
    number | string | null,
    string | null,
    string | null,
    number | null,
    boolean | null,
    string | null,
    string | null,
    Record<string, { title?: string; note?: string }> | null | undefined,
    number | null,
  ];

  const id = await insertBaseInfoNodeWithHid({
    parentId,
    childDigits,
    title,
    shortName,
    viewOrder,
    note,
    metadata,
    value,
    isActive,
    uiColor,
    uiHtml,
    actorId,
    idExists: async (candidate) => Boolean(await findBaseInfoIdExists(candidate)),
    insert: async (row) => {
      await prisma().baseInfo.create({
        data: {
          id: row.id,
          parentId: row.parentId,
          title: row.title,
          shortName: row.shortName,
          viewOrder: row.viewOrder ?? undefined,
          note: row.note,
          metadata: row.metadata,
          value: row.value ?? undefined,
          isActive: row.isActive,
          uiColor: row.uiColor,
          uiHtml: row.uiHtml,
          createdBy: row.actorId !== null ? toUserId(row.actorId) : null,
          updatedBy: row.actorId !== null ? toUserId(row.actorId) : null,
        },
      });
    },
  });

  persistBaseInfoLocaleTextsWithSqlMirror(id, title, locales ?? undefined);
  await assignBaseInfoTitlePathForNewNode(id);

  return { id };
}

export async function updateBaseInfoNode(params: unknown[]) {
  const [
    title,
    shortName,
    viewOrder,
    note,
    metadata,
    value,
    isActive,
    uiColor,
    uiHtml,
    locales,
    actorId,
    nodeId,
  ] = params as [
    string | null,
    string | null,
    number | string | null,
    string | null,
    string | null,
    number | null,
    boolean | null,
    string | null,
    string | null,
    Record<string, { title?: string; note?: string }> | null | undefined,
    number | null,
    string,
  ];

  const existing = await prisma().baseInfo.findUnique({
    where: { id: nodeId },
    select: { title: true },
  });
  if (!existing) {
    throw new Error(`Base Info node "${nodeId}" was not found.`);
  }

  await prisma().baseInfo.update({
    where: { id: nodeId },
    data: {
      title,
      shortName,
      viewOrder: viewOrder ?? undefined,
      note,
      metadata,
      value: value ?? undefined,
      isActive: isActive ?? true,
      uiColor,
      uiHtml,
      updatedBy: actorId !== null ? toUserId(actorId) : null,
      updatedAt: new Date(),
    },
  });

  persistBaseInfoLocaleTextsWithSqlMirror(nodeId, title, locales ?? undefined);

  if (shouldRecomputeBaseInfoTitlePathsAfterSave({
    previousCanonicalTitle: existing.title,
    nextCanonicalTitle: title,
    locales,
  })) {
    await recomputeBaseInfoTitlePathsForSubtree(nodeId);
  }
}

const remapStoredBaseInfoValue = (value: unknown, previousId: string, updatedId: string): unknown => {
  if (typeof value === 'string') {
    return value === previousId ? updatedId : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => remapStoredBaseInfoValue(entry, previousId, updatedId));
  }
  return value;
};

const remapAttributeValueText = (
  valueText: string | null,
  previousId: string,
  updatedId: string,
): string | null => {
  if (valueText === null) return null;
  const trimmed = valueText.trim();
  if (!trimmed) return valueText;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const remapped = remapStoredBaseInfoValue(parsed, previousId, updatedId);
    return JSON.stringify(remapped);
  } catch {
    return trimmed === previousId ? updatedId : valueText;
  }
};

export type RemapBaseInfoSubtreeByMapInput = {
  oldRootId: string;
  nextParentId?: string | null;
  actorId: number | null;
  mapId: (id: string) => string;
};

export async function remapBaseInfoSubtreeByMap(input: RemapBaseInfoSubtreeByMapInput): Promise<void> {
  const { oldRootId, actorId, mapId } = input;
  const actor = actorId !== null ? toUserId(actorId) : null;
  const normalizedNextParentId = input.nextParentId === undefined
    ? undefined
    : (String(input.nextParentId ?? '').trim() || null);

  const descendants = await prisma().baseInfo.findMany({
    where: {
      OR: [{ id: oldRootId }, { id: { startsWith: `${oldRootId}.` } }],
    },
    select: { id: true },
  });

  const idMap = new Map<string, string>();
  for (const node of descendants) {
    const updatedId = mapId(node.id);
    if (updatedId !== node.id) {
      idMap.set(node.id, updatedId);
    }
  }
  if (idMap.size === 0) return;

  const shallowFirst = [...descendants].sort((a, b) => a.id.length - b.id.length);
  const deepestFirst = [...descendants].sort((a, b) => b.id.length - a.id.length);

  await prisma().$transaction(async (tx) => {
    for (const node of shallowFirst) {
      const updatedId = idMap.get(node.id);
      if (!updatedId) continue;

      const row = await tx.baseInfo.findUniqueOrThrow({ where: { id: node.id } });
      const remappedParentId = node.id === oldRootId && normalizedNextParentId !== undefined
        ? normalizedNextParentId
        : row.parentId && idMap.has(row.parentId)
          ? idMap.get(row.parentId)!
          : row.parentId;

      await tx.baseInfo.create({
        data: {
          id: updatedId,
          parentId: remappedParentId,
          title: row.title,
          shortName: row.shortName,
          viewOrder: row.viewOrder ?? undefined,
          note: row.note,
          metadata: row.metadata,
          value: row.value,
          isActive: row.isActive,
          uiColor: row.uiColor,
          uiHtml: row.uiHtml,
          createdAt: row.createdAt,
          createdBy: row.createdBy,
          updatedBy: actor,
          updatedAt: new Date(),
        },
      });
    }

    for (const [previousId, updatedId] of idMap) {
      await tx.baseInfo.updateMany({
        where: { parentId: previousId },
        data: { parentId: updatedId },
      });
      await tx.baseContactMessage.updateMany({
        where: { topicCode: previousId },
        data: { topicCode: updatedId },
      });
      await tx.baseUserProfile.updateMany({
        where: { genderCode: previousId },
        data: { genderCode: updatedId },
      });
      await tx.baseUserProfile.updateMany({
        where: { personTypeCode: previousId },
        data: { personTypeCode: updatedId },
      });
      await tx.baseSettingsAttribute.updateMany({
        where: { baseInfoRootId: previousId },
        data: { baseInfoRootId: updatedId },
      });
      await tx.baseScopeMembership.updateMany({
        where: { nodeId: previousId },
        data: { nodeId: updatedId, updatedBy: actor, updatedAt: new Date() },
      });
      await tx.baseScopeMembershipEvent.updateMany({
        where: { nodeId: previousId },
        data: { nodeId: updatedId },
      });
      await tx.baseScopeRoleMembership.updateMany({
        where: { nodeId: previousId },
        data: { nodeId: updatedId, updatedBy: actor, updatedAt: new Date() },
      });
      await tx.baseScopeRoleMembershipEvent.updateMany({
        where: { nodeId: previousId },
        data: { nodeId: updatedId },
      });

      const userAttributeRows = await tx.baseUserAttribute.findMany({
        where: { valueText: { contains: previousId } },
        select: { id: true, valueText: true },
      });
      for (const row of userAttributeRows) {
        const nextValueText = remapAttributeValueText(row.valueText, previousId, updatedId);
        if (nextValueText !== row.valueText) {
          await tx.baseUserAttribute.update({
            where: { id: row.id },
            data: { valueText: nextValueText, updatedBy: actor, updatedAt: new Date() },
          });
        }
      }

      const roleAttributeRows = await tx.baseRoleAttribute.findMany({
        where: { valueText: { contains: previousId } },
        select: { id: true, valueText: true },
      });
      for (const row of roleAttributeRows) {
        const nextValueText = remapAttributeValueText(row.valueText, previousId, updatedId);
        if (nextValueText !== row.valueText) {
          await tx.baseRoleAttribute.update({
            where: { id: row.id },
            data: { valueText: nextValueText, updatedBy: actor, updatedAt: new Date() },
          });
        }
      }
    }

    for (const node of deepestFirst) {
      if (!idMap.has(node.id)) continue;
      await tx.baseInfo.delete({ where: { id: node.id } });
    }
  });

  const newRootId = mapId(oldRootId);
  await recomputeBaseInfoTitlePathsForSubtree(newRootId);
}

export async function renameBaseInfoSubtree(params: unknown[]) {
  const [oldId, newId, nextParentId, , actorId] = params as [
    string,
    string,
    string | null | undefined,
    string,
    number | null,
  ];
  await remapBaseInfoSubtreeByMap({
    oldRootId: oldId,
    nextParentId,
    actorId,
    mapId: (id) => (id === oldId ? newId : `${newId}${id.slice(oldId.length)}`),
  });
}

export async function findBaseInfoNodeById(nodeId: string) {
  const row = await prisma().baseInfo.findUnique({
    where: { id: nodeId },
    select: { id: true, parentId: true },
  });
  return row ? { id: row.id, parent_id: row.parentId } : undefined;
}

export async function findBaseInfoDescendantCycle(movedNodeId: string, nextParentId: string) {
  if (nextParentId === movedNodeId || nextParentId.startsWith(`${movedNodeId}.`)) {
    return { id: nextParentId };
  }
  return undefined;
}

export async function calculateBaseInfoHierarchicalId(nextParentId: string | null, sourceDigits: number) {
  const id = await allocateBaseInfoHierarchicalId({
    parentId: nextParentId,
    childDigits: sourceDigits,
    idExists: async (candidate) => Boolean(await findBaseInfoIdExists(candidate)),
  });
  return { id };
}

const siblingOrderBy = orderByViewOrderThenId();

export async function listBaseInfoRootSiblingIds() {
  const rows = await prisma().baseInfo.findMany({
    where: { parentId: null },
    select: { id: true },
    orderBy: siblingOrderBy,
  });
  return rows.map((row) => ({ id: row.id }));
}

export async function listBaseInfoChildSiblingIds(parentId: string) {
  const rows = await prisma().baseInfo.findMany({
    where: { parentId },
    select: { id: true },
    orderBy: siblingOrderBy,
  });
  return rows.map((row) => ({ id: row.id }));
}

export async function updateBaseInfoSiblingOrder(params: unknown[]) {
  const [parentId, viewOrder, actorId, nodeId] = params as [
    string | null,
    number,
    number | null,
    string,
  ];

  await prisma().baseInfo.update({
    where: { id: nodeId },
    data: {
      parentId,
      viewOrder,
      updatedBy: actorId !== null ? toUserId(actorId) : null,
      updatedAt: new Date(),
    },
  });

  await recomputeBaseInfoTitlePathsForSubtree(nodeId);
}

export async function findBaseInfoIdExists(nodeId: string) {
  const row = await prisma().baseInfo.findUnique({
    where: { id: nodeId },
    select: { id: true },
  });
  return row ? { id: row.id } : undefined;
}

export async function findBaseInfoChildId(nodeId: string) {
  const row = await prisma().baseInfo.findFirst({
    where: { parentId: nodeId },
    select: { id: true },
  });
  return row ? { id: row.id } : undefined;
}

export async function deleteBaseInfoNode(nodeId: string) {
  await prisma().baseInfo.delete({
    where: { id: nodeId },
  });
}

export async function setBaseInfoActive(isActive: boolean, actorId: number | null, nodeId: string) {
  await prisma().baseInfo.update({
    where: { id: nodeId },
    data: {
      isActive,
      updatedBy: actorId !== null ? toUserId(actorId) : null,
      updatedAt: new Date(),
    },
  });
}

const enrichmentSelect = {
  id: true,
  parentId: true,
  title: true,
  shortName: true,
  viewOrder: true,
  note: true,
  metadata: true,
  value: true,
  isActive: true,
  uiColor: true,
  uiHtml: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
} as const;

export async function listBaseInfoEnrichmentRowsByIds(ids: string[], cultureId = 'us') {
  const uniqueIds = [...new Set(ids.map((item) => item.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await prisma().baseInfo.findMany({
    where: { id: { in: uniqueIds } },
    select: enrichmentSelect,
  });

  return mapBaseInfoRowsForCulture(rows, cultureId, (row, context) => ({
    id: row.id,
    parent_id: row.parentId,
    title: context.label,
    title_canonical: row.title,
    title_path: context.titlePath,
    short_name: row.shortName,
    view_order: toViewOrderNumber(row.viewOrder),
    note: context.resolvedNote,
    note_canonical: row.note,
    metadata: row.metadata,
    value: row.value,
    is_active: row.isActive,
    ui_color: row.uiColor,
    ui_html: row.uiHtml,
    created_at: row.createdAt?.toISOString() ?? null,
    created_by: row.createdBy !== null ? String(row.createdBy) : null,
    updated_at: row.updatedAt?.toISOString() ?? null,
    updated_by: row.updatedBy !== null ? String(row.updatedBy) : null,
  }));
}
