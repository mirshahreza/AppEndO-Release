/**
 * Resolve Base Info ids seeded by Phase 1 (CMS root → categories → items), read-only.
 * Used by Phase 3 to bake literal ids into designer documents (body-format visibility
 * conditions, status preset fields).
 */

import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { resolveLucideIconNameFromUiHtml } from '../../src/shared/lib/baseInfoUiIcon';
import { CMS_BASE_INFO_ITEM_UI_ICONS } from '../cms-phase1/seed/cmsBaseInfoCatalog';

/**
 * `cms_contents` is a Sequelize Edge model, not a Prisma model — read it through the
 * same portable Edge executor Phase 1's runtime-data seed uses, so this works on
 * whichever dialect the default data source actually is (SQL Server in this
 * environment, per round 15/16 notes — not PostgreSQL).
 */
const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
const edgeExec = createEdgeDbQueryExecutor({ getDataSources });
const defaultDataSourceId = (): string => {
  const sources = getDataSources();
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('CMS Phase 3 requires a default data source.');
  }
  return source.id;
};

const findRootByTitle = async (title: string) => (
  prisma().baseInfo.findFirst({
    where: { parentId: null, title },
    select: { id: true },
  })
);

const findChildByTitle = async (parentId: string, title: string) => (
  prisma().baseInfo.findFirst({
    where: { parentId, title },
    select: { id: true },
  })
);

const findItemByShortName = async (categoryId: string, shortName: string): Promise<string> => {
  const item = await prisma().baseInfo.findFirst({ where: { parentId: categoryId, shortName }, select: { id: true } });
  if (!item) throw new Error(`CMS Phase 3: Base Info item "${shortName}" missing under category ${categoryId}.`);
  return item.id;
};

const findOptionalItemByShortName = async (
  categoryId: string,
  shortName: string,
): Promise<string | null> => {
  const item = await prisma().baseInfo.findFirst({
    where: { parentId: categoryId, shortName, isActive: true },
    select: { id: true },
  });
  return item?.id ?? null;
};

const requireCategory = async (rootId: string, title: string): Promise<string> => {
  const category = await findChildByTitle(rootId, title);
  if (!category) throw new Error(`CMS Phase 3: Base Info category "${title}" missing under CMS root. Run npm run cms:phase1 first.`);
  return category.id;
};

export type CmsResolvedIds = {
  rootId: string;
  categoryIds: Record<
    'Content Types' | 'Statuses' | 'Body Formats' | 'Languages' | 'Content Tags'
    | 'Comment Policies',
    string
  >;
  bodyFormatIds: { plain: string; markdown: string; html: string };
  statusIds: {
    published: string | null;
    archived: string | null;
    draft: string | null;
    inReview: string | null;
  };
  commentStatusIds: { approved: string | null; rejected: string | null; spam: string | null; pending: string | null };
  contentTypeIds: { comment: string };
};

export type CmsFilterOptions = {
  contentTypes: Array<{ value: string; label: string }>;
  languages: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string; uiColor?: string | null; icon?: string | null }>;
  bodyFormats: Array<{ value: string; label: string }>;
  commentPolicies: Array<{ value: string; label: string }>;
  contentTags: Array<{ value: string; label: string }>;
  contents: Array<{ value: string; label: string }>;
};

const listCategoryOptions = async (categoryId: string): Promise<Array<{ value: string; label: string }>> => {
  const rows = await prisma().baseInfo.findMany({
    where: { parentId: categoryId },
    orderBy: { viewOrder: 'asc' },
    select: { id: true, title: true },
  });
  return rows.map((row) => ({ value: row.id, label: row.title ?? row.id }));
};

const resolveStatusIcon = (
  uiHtml: string | null,
  shortName: string | null,
): string | null => (
  resolveLucideIconNameFromUiHtml(uiHtml)
  ?? (shortName ? CMS_BASE_INFO_ITEM_UI_ICONS[shortName] ?? null : null)
);

const listStatusOptions = async (
  categoryId: string,
): Promise<Array<{ value: string; label: string; uiColor: string | null; icon: string | null }>> => {
  const rows = await prisma().baseInfo.findMany({
    where: { parentId: categoryId, isActive: true },
    orderBy: { viewOrder: 'asc' },
    select: { id: true, title: true, uiColor: true, uiHtml: true, shortName: true },
  });
  return rows.map((row) => ({
    value: row.id,
    label: row.title ?? row.id,
    uiColor: row.uiColor,
    icon: resolveStatusIcon(row.uiHtml, row.shortName),
  }));
};

const listContentOptions = async (
  excludeContentTypeCode?: string | null,
): Promise<Array<{ value: string; label: string }>> => {
  const params: unknown[] = [];
  let whereSql = '';
  if (excludeContentTypeCode) {
    params.push(excludeContentTypeCode);
    whereSql = 'WHERE content_type_code IS DISTINCT FROM ?';
  }
  const result = await edgeExec<{ id: string; title: string | null; slug: string | null }>(
    `SELECT id, title, slug FROM cms_contents
     ${whereSql}
     ORDER BY CASE WHEN published_at IS NULL THEN 1 ELSE 0 END, published_at DESC, updated_at DESC`,
    params,
    { dataSourceId: defaultDataSourceId() },
  );
  return result.data.map((row) => ({
    value: String(row.id),
    label: row.title?.trim() || row.slug || String(row.id),
  }));
};

export const resolveCmsFilterOptions = async (): Promise<CmsFilterOptions> => {
  const ids = await resolveCmsIds();
  const [contentTypes, languages, statuses, bodyFormats, commentPolicies, contentTags, contents] = await Promise.all([
    listCategoryOptions(ids.categoryIds['Content Types']),
    listCategoryOptions(ids.categoryIds.Languages),
    listStatusOptions(ids.categoryIds.Statuses),
    listCategoryOptions(ids.categoryIds['Body Formats']),
    listCategoryOptions(ids.categoryIds['Comment Policies']),
    listCategoryOptions(ids.categoryIds['Content Tags']),
    listContentOptions(ids.contentTypeIds.comment),
  ]);
  return { contentTypes, languages, statuses, bodyFormats, commentPolicies, contentTags, contents };
};

export const resolveCmsIds = async (): Promise<CmsResolvedIds> => {
  const root = await findRootByTitle('CMS');
  if (!root) throw new Error('CMS Phase 3: Base Info root "CMS" missing. Run npm run cms:phase1 first.');

  const categoryTitles = [
    'Content Types', 'Statuses', 'Body Formats', 'Languages', 'Content Tags',
    'Comment Policies',
  ] as const;
  const categoryEntries = await Promise.all(
    categoryTitles.map(async (title) => [title, await requireCategory(root.id, title)] as const),
  );
  const categoryIds = Object.fromEntries(categoryEntries) as CmsResolvedIds['categoryIds'];

  const statusesCategoryId = categoryIds.Statuses;

  const bodyFormatIds = {
    plain: await findItemByShortName(categoryIds['Body Formats'], 'plain'),
    markdown: await findItemByShortName(categoryIds['Body Formats'], 'markdown'),
    html: await findItemByShortName(categoryIds['Body Formats'], 'html'),
  };
  const statusIds = {
    published: await findOptionalItemByShortName(statusesCategoryId, 'published'),
    archived: await findOptionalItemByShortName(statusesCategoryId, 'archived'),
    draft: await findOptionalItemByShortName(statusesCategoryId, 'draft'),
    inReview: await findOptionalItemByShortName(statusesCategoryId, 'in_review'),
  };
  // Comment moderation aliases onto the shared editorial Statuses set:
  // approve → Published, awaiting moderation → In Review, reject/spam → Rejected.
  const commentStatusIds = {
    approved: statusIds.published,
    pending: statusIds.inReview,
    rejected: await findOptionalItemByShortName(statusesCategoryId, 'rejected'),
    spam: await findOptionalItemByShortName(statusesCategoryId, 'rejected'),
  };
  const contentTypeIds = {
    comment: await findItemByShortName(categoryIds['Content Types'], 'comment'),
  };

  return { rootId: root.id, categoryIds, bodyFormatIds, statusIds, commentStatusIds, contentTypeIds };
};
