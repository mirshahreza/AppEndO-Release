import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { createEdgeDbQueryExecutor } from '../../../core/database/EdgeDbRouter';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getDataSourcesFromSettings } from '../../db/dataSourcesStore';
import {
  CMS_OBSOLETE_SAMPLE_SLUGS,
  CMS_RETIRED_CONTENT_TAG_SHORT_NAMES,
  CMS_SAMPLE_SITE_CONTENTS,
  type CmsSampleSiteContent,
} from './cmsSampleSiteCatalog';
import { ensureAppEndoGuideAssets } from './generateAppEndoGuideAssets';
import { quoteEdgeSqlColumn } from '../../../shared/lib/edgeSqlIdentifiers';
import { cmsPackageSeedAssetsDir } from './cmsPackageSeedPaths';

const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
const exec = createEdgeDbQueryExecutor({ getDataSources });

const defaultDataSource = () => {
  const sources = getDataSources();
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('CMS sample site seed: no default data source configured.');
  }
  return source;
};

const defaultDataSourceId = (): string => defaultDataSource().id;

const sqlCol = (name: string): string => quoteEdgeSqlColumn(name, defaultDataSource().type);

const ctx = () => ({ dataSourceId: defaultDataSourceId() });

export type SeedCmsSampleSiteResult = {
  contentsUpserted: number;
  assetsUpserted: number;
  tagsLinked: number;
  relationsUpserted: number;
  revisionsUpserted: number;
  obsoleteRemoved: number;
  generatedAssets: number;
};

const asId = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === 'string' ? value.trim() : '';
};

/** PG bigint columns reject text binds; numeric ids must go through as numbers. */
const toEdgeId = (value: string): string | number => (
  /^\d+$/.test(value) ? Number(value) : value
);

export const findCategoryItemId = async (
  seedResult: CmsBaseInfoSeedResult,
  categoryTitle: string,
  shortName: string,
): Promise<string> => {
  const category = seedResult.categories.find((item) => item.title === categoryTitle);
  if (!category) {
    throw new Error(`CMS sample site seed: category "${categoryTitle}" missing from seed result.`);
  }
  const rows = await exec<{ id: string }>(
    'SELECT id FROM base_info WHERE parent_id = ? AND short_name = ?',
    [category.id, shortName],
    ctx(),
  );
  const id = asId(rows.data[0]?.id);
  if (!id) {
    throw new Error(`CMS sample site seed: item "${shortName}" missing under "${categoryTitle}".`);
  }
  return id;
};

const findContentId = async (languageCode: string, slug: string): Promise<string | null> => {
  const rows = await exec<{ id: unknown }>(
    'SELECT id FROM cms_contents WHERE language_code = ? AND slug = ?',
    [languageCode, slug],
    ctx(),
  );
  const id = asId(rows.data[0]?.id);
  return id || null;
};

const sha256Hex = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

const buildThumbnail = async (file: Buffer): Promise<Buffer | null> => {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(file, { failOn: 'error' })
      .resize({ height: 100, withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
  } catch {
    return null;
  }
};

const findContentIdBySlug = async (slug: string): Promise<string | null> => {
  const rows = await exec<{ id: unknown }>(
    'SELECT id FROM cms_contents WHERE slug = ?',
    [slug],
    ctx(),
  );
  const id = asId(rows.data[0]?.id);
  return id || null;
};

const upsertContent = async (
  seedResult: CmsBaseInfoSeedResult,
  sample: CmsSampleSiteContent,
  parentId: string | null,
): Promise<{ id: string; created: boolean }> => {
  const languageCode = await findCategoryItemId(seedResult, 'Languages', sample.languageShortName);
  const contentTypeCode = await findCategoryItemId(seedResult, 'Content Types', sample.typeShortName);
  const statusCode = await findCategoryItemId(seedResult, 'Statuses', sample.statusShortName);
  const bodyFormatCode = await findCategoryItemId(seedResult, 'Body Formats', sample.bodyFormatShortName);
  const commentsPolicyCode = sample.commentsPolicyShortName
    ? await findCategoryItemId(seedResult, 'Comment Policies', sample.commentsPolicyShortName)
    : null;
  const publishedAt = sample.published
    ? new Date(sample.publishedAt || Date.now())
    : null;
  const now = new Date();
  const commentsEnabled = sample.commentsEnabled === undefined ? null : sample.commentsEnabled;
  const existingId = await findContentId(languageCode, sample.slug);
  const fields = [
    contentTypeCode,
    statusCode,
    sample.title,
    sample.summary,
    sample.body,
    bodyFormatCode,
    publishedAt,
    sample.authorDisplayName || null,
    sample.authorEmail || null,
    sample.seoTitle || null,
    sample.seoNote || null,
    sample.operatorNote || null,
    commentsEnabled,
    commentsPolicyCode,
    parentId ? toEdgeId(parentId) : null,
    now,
  ];

  if (existingId) {
    await exec(
      `UPDATE cms_contents SET
        content_type_code = ?, status_code = ?, title = ?, summary = ?, body = ?,
        body_format_code = ?, published_at = ?, author_display_name = ?, author_email = ?,
        seo_title = ?, seo_note = ?, operator_note = ?, comments_enabled = ?,
        comments_policy_code = ?, parent_content_id = ?, updated_at = ?
       WHERE id = ?`,
      [...fields, toEdgeId(existingId)],
      ctx(),
    );
    return { id: existingId, created: false };
  }

  await exec(
    `INSERT INTO cms_contents (
      content_type_code, language_code, slug, status_code, title, summary, body,
      body_format_code, published_at, author_display_name, author_email,
      seo_title, seo_note, operator_note, comments_enabled, comments_policy_code,
      parent_content_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contentTypeCode,
      languageCode,
      sample.slug,
      statusCode,
      sample.title,
      sample.summary,
      sample.body,
      bodyFormatCode,
      publishedAt,
      sample.authorDisplayName || null,
      sample.authorEmail || null,
      sample.seoTitle || null,
      sample.seoNote || null,
      sample.operatorNote || null,
      commentsEnabled,
      commentsPolicyCode,
      parentId ? toEdgeId(parentId) : null,
      now,
      now,
    ],
    ctx(),
  );

  const createdId = await findContentId(languageCode, sample.slug);
  if (!createdId) {
    throw new Error(`CMS sample site seed: failed to read id for slug "${sample.slug}".`);
  }
  return { id: createdId, created: true };
};

const upsertRevision = async (
  contentId: string,
  revision: NonNullable<CmsSampleSiteContent['revision']>,
): Promise<boolean> => {
  const existing = await exec<{ revision_no?: unknown }>(
    'SELECT revision_no FROM cms_content_revisions WHERE content_id = ? AND revision_no = 1',
    [toEdgeId(contentId)],
    ctx(),
  );
  if (existing.data[0]) {
    await exec(
      `UPDATE cms_content_revisions SET title = ?, summary = ?, body = ? WHERE content_id = ? AND revision_no = 1`,
      [revision.title, revision.summary, revision.body, toEdgeId(contentId)],
      ctx(),
    );
    return false;
  }
  await exec(
    `INSERT INTO cms_content_revisions (content_id, revision_no, title, summary, body, created_at)
     VALUES (?, 1, ?, ?, ?, ?)`,
    [toEdgeId(contentId), revision.title, revision.summary, revision.body, new Date()],
    ctx(),
  );
  return true;
};

const orderRelationIds = (left: string, right: string): [string, string] | null => {
  if (left === right) {
    return null;
  }
  const leftNum = Number(left);
  const rightNum = Number(right);
  if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum) {
    return leftNum < rightNum ? [left, right] : [right, left];
  }
  return left < right ? [left, right] : [right, left];
};

const replaceRelations = async (idBySlug: Map<string, string>): Promise<number> => {
  const ids = [...idBySlug.values()];
  for (const id of ids) {
    await exec(
      'DELETE FROM cms_content_relations WHERE content_id_a = ? OR content_id_b = ?',
      [toEdgeId(id), toEdgeId(id)],
      ctx(),
    );
  }

  const seen = new Set<string>();
  let linked = 0;
  for (const sample of CMS_SAMPLE_SITE_CONTENTS) {
    const fromId = idBySlug.get(sample.slug);
    if (!fromId) {
      continue;
    }
    for (const relatedSlug of sample.relatedSlugs ?? []) {
      const toId = idBySlug.get(relatedSlug);
      if (!toId) {
        continue;
      }
      const ordered = orderRelationIds(fromId, toId);
      if (!ordered) {
        continue;
      }
      const key = `${ordered[0]}:${ordered[1]}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      await exec(
        'INSERT INTO cms_content_relations (content_id_a, content_id_b, note) VALUES (?, ?, ?)',
        [toEdgeId(ordered[0]), toEdgeId(ordered[1]), 'Related on the public site.'],
        ctx(),
      );
      linked += 1;
    }
  }
  return linked;
};

const replaceTags = async (
  seedResult: CmsBaseInfoSeedResult,
  contentId: string,
  tagShortNames: string[] | undefined,
): Promise<number> => {
  await exec('DELETE FROM cms_content_tags WHERE content_id = ?', [toEdgeId(contentId)], ctx());
  let linked = 0;
  for (const shortName of tagShortNames ?? []) {
    const tagCode = await findCategoryItemId(seedResult, 'Content Tags', shortName);
    await exec(
      'INSERT INTO cms_content_tags (content_id, tag_code) VALUES (?, ?)',
      [toEdgeId(contentId), tagCode],
      ctx(),
    );
    linked += 1;
  }
  return linked;
};

const upsertAsset = async (
  contentId: string,
  fileName: string,
  sortOrder: number,
): Promise<boolean> => {
  const filePath = path.join(cmsPackageSeedAssetsDir(), fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`CMS sample site seed: asset file missing (${fileName}).`);
  }
  const file = fs.readFileSync(filePath);
  const digest = sha256Hex(file);
  const existing = await exec<{ id: unknown; sha256?: unknown }>(
    'SELECT id, sha256 FROM cms_content_assets WHERE content_id = ? AND file_name = ?',
    [toEdgeId(contentId), fileName],
    ctx(),
  );
  const existingRow = existing.data[0];
  const thumb = await buildThumbnail(file);
  const now = new Date();

  if (existingRow && asId(existingRow.sha256) === digest) {
    await exec(
      'UPDATE cms_content_assets SET sort_order = ?, updated_at = ? WHERE id = ?',
      [sortOrder, now, toEdgeId(asId(existingRow.id))],
      ctx(),
    );
    return false;
  }

  if (existingRow) {
    await exec(
      `UPDATE cms_content_assets SET
        ${sqlCol('file')} = ?, ${sqlCol('file_xs')} = ?, file_size = ?, file_mime = ?, sort_order = ?, sha256 = ?, updated_at = ?
       WHERE id = ?`,
      [
        file,
        thumb,
        file.length,
        'image/jpeg',
        sortOrder,
        digest,
        now,
        toEdgeId(asId(existingRow.id)),
      ],
      ctx(),
    );
    return true;
  }

  await exec(
    `INSERT INTO cms_content_assets (
      content_id, ${sqlCol('file')}, ${sqlCol('file_xs')}, file_size, file_name, file_mime, sort_order, sha256, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      toEdgeId(contentId),
      file,
      thumb,
      file.length,
      fileName,
      'image/jpeg',
      sortOrder,
      digest,
      now,
      now,
    ],
    ctx(),
  );
  return true;
};

const removeExtraAssets = async (contentId: string, keepNames: string[]): Promise<void> => {
  const keep = new Set(keepNames);
  const rows = await exec<{ id: unknown; file_name?: unknown }>(
    'SELECT id, file_name FROM cms_content_assets WHERE content_id = ?',
    [toEdgeId(contentId)],
    ctx(),
  );
  for (const row of rows.data) {
    const name = typeof row.file_name === 'string' ? row.file_name : '';
    if (keep.has(name)) {
      continue;
    }
    await exec('DELETE FROM cms_content_assets WHERE id = ?', [toEdgeId(asId(row.id))], ctx());
  }
};

const removeObsoleteSamples = async (): Promise<number> => {
  let removed = 0;
  for (const slug of CMS_OBSOLETE_SAMPLE_SLUGS) {
    const result = await exec(
      'DELETE FROM cms_contents WHERE slug = ?',
      [slug],
      ctx(),
    );
    removed += result.count;
  }
  return removed;
};

const unlinkRetiredTagJunctions = async (
  seedResult: CmsBaseInfoSeedResult,
): Promise<void> => {
  const category = seedResult.categories.find((item) => item.title === 'Content Tags');
  if (!category) {
    return;
  }
  for (const shortName of CMS_RETIRED_CONTENT_TAG_SHORT_NAMES) {
    const rows = await exec<{ id: unknown }>(
      'SELECT id FROM base_info WHERE parent_id = ? AND short_name = ?',
      [category.id, shortName],
      ctx(),
    );
    const tagId = asId(rows.data[0]?.id);
    if (!tagId) {
      continue;
    }
    await exec('DELETE FROM cms_content_tags WHERE tag_code = ?', [tagId], ctx());
    await exec('DELETE FROM base_info WHERE id = ?', [tagId], ctx());
  }
};

/** Upsert AppEndO public-site guide rows, annotated screenshots, tags, relations, and comments. Re-runnable. */
export const seedCmsSampleSite = async (
  seedResult: CmsBaseInfoSeedResult,
): Promise<SeedCmsSampleSiteResult> => {
  const generatedAssets = await ensureAppEndoGuideAssets();
  await unlinkRetiredTagJunctions(seedResult);
  const obsoleteRemoved = await removeObsoleteSamples();

  let contentsUpserted = 0;
  let assetsUpserted = 0;
  let tagsLinked = 0;
  let revisionsUpserted = 0;
  const idBySlug = new Map<string, string>();

  for (const sample of CMS_SAMPLE_SITE_CONTENTS) {
    const parentId = sample.parentSlug
      ? (idBySlug.get(sample.parentSlug) ?? await findContentIdBySlug(sample.parentSlug))
      : null;
    if (sample.parentSlug && !parentId) {
      throw new Error(`CMS sample site seed: parent slug "${sample.parentSlug}" missing for "${sample.slug}".`);
    }
    const { id } = await upsertContent(seedResult, sample, parentId);
    idBySlug.set(sample.slug, id);
    contentsUpserted += 1;
    tagsLinked += await replaceTags(seedResult, id, sample.tagShortNames);
    if (sample.revision) {
      const created = await upsertRevision(id, sample.revision);
      if (created) {
        revisionsUpserted += 1;
      }
    }
    for (const [index, fileName] of (sample.assetFiles ?? []).entries()) {
      const changed = await upsertAsset(id, fileName, index);
      if (changed) {
        assetsUpserted += 1;
      }
    }
    await removeExtraAssets(id, sample.assetFiles ?? []);
  }

  const relationsUpserted = await replaceRelations(idBySlug);

  return {
    contentsUpserted,
    assetsUpserted,
    tagsLinked,
    relationsUpserted,
    revisionsUpserted,
    obsoleteRemoved,
    generatedAssets,
  };
};
