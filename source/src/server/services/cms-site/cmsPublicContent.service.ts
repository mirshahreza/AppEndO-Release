import { createEdgeDbQueryExecutor } from '../../../core/database/EdgeDbRouter';
import { getDataSourcesFromSettings } from '../../db/dataSourcesStore';
import { cmsPublicAssetPath } from '../../../shared/lib/cmsPublicAssets';
import { quoteEdgeSqlColumn } from '../../../shared/lib/edgeSqlIdentifiers';
import { HttpError } from '../../errors/HttpError';
import type {
  CmsPublicChrome,
  CmsPublicComment,
  CmsPublicContent,
  CmsPublicHome,
  CmsPublicNavItem,
  CmsPublicRelated,
  CmsPublicSitePayload,
  CmsPublicTag,
} from '../../../shared/api/contracts/cms-site/types';

export type CmsPublicContentServiceDeps = {
  settingsPath: string;
  edgeDbQuery?: ReturnType<typeof createEdgeDbQueryExecutor>;
};

const PUBLISHED_STATUS = 'published';
const COMMENT_TYPE = 'comment';
const PAGE_TYPE = 'page';
const FRAGMENT_TYPE = 'fragment';
const DEFAULT_CACHE_TTL_SECONDS = 300;
const DEFAULT_BRAND = 'Site';

const CHROME_SLUGS = new Set([
  'home',
  'about',
  'contact',
  'site-brand',
  'site-footer',
  'site-cta',
  'site-talk',
  'site-legal',
]);

const SLIDE_SLUG_PREFIX = 'slide-';

type ContentRow = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  published_at?: unknown;
  publishedAt?: unknown;
  author_display_name?: unknown;
  authorDisplayName?: unknown;
  content_type?: unknown;
  contentType?: unknown;
  language_code?: unknown;
  languageCode?: unknown;
  body_format?: unknown;
  bodyFormat?: unknown;
  seo_title?: unknown;
  seoTitle?: unknown;
  seo_note?: unknown;
  seoNote?: unknown;
  comments_enabled?: unknown;
  commentsEnabled?: unknown;
  parent_content_id?: unknown;
  parentContentId?: unknown;
};

type TagRow = {
  content_id?: unknown;
  contentId?: unknown;
  short_name?: unknown;
  shortName?: unknown;
  title?: unknown;
};

type RelationRow = {
  content_id_a?: unknown;
  contentIdA?: unknown;
  content_id_b?: unknown;
  contentIdB?: unknown;
};

const asText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return '';
};

const asId = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return asText(value);
};

const readField = (row: ContentRow, ...keys: Array<keyof ContentRow>): string => {
  for (const key of keys) {
    const text = asText(row[key]);
    if (text) {
      return text;
    }
  }
  return '';
};

const asBool = (value: unknown, fallback: boolean): boolean => {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return fallback;
};

const mapRow = (row: ContentRow): CmsPublicContent | null => {
  const slug = readField(row, 'slug');
  const title = readField(row, 'title');
  if (!slug || !title) {
    return null;
  }
  return {
    id: asId(row.id),
    slug,
    title,
    summary: readField(row, 'summary'),
    body: readField(row, 'body'),
    bodyFormat: readField(row, 'body_format', 'bodyFormat') || 'plain',
    contentType: readField(row, 'content_type', 'contentType'),
    language: readField(row, 'language_code', 'languageCode'),
    publishedAt: readField(row, 'published_at', 'publishedAt') || null,
    authorDisplayName: readField(row, 'author_display_name', 'authorDisplayName'),
    seoTitle: readField(row, 'seo_title', 'seoTitle'),
    seoNote: readField(row, 'seo_note', 'seoNote'),
    commentsEnabled: asBool(row.comments_enabled ?? row.commentsEnabled, false),
    coverImageUrl: null,
    imageUrls: [],
    tags: [],
    related: [],
    comments: [],
  };
};

const isMissingCmsSchema = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid object name|no such table|relation ["']?\w+["']? does not exist/i.test(message);
};

const toQueryId = (value: string): string | number => (
  /^\d+$/.test(value) ? Number(value) : value
);

const normalizeLanguage = (value: string | undefined): string => {
  const trimmed = value?.trim().toLowerCase() ?? '';
  if (!trimmed) {
    return 'en';
  }
  return trimmed.slice(0, 2);
};

const pickLanguage = (rows: CmsPublicContent[], language: string): CmsPublicContent[] => {
  const exact = rows.filter((row) => row.language === language);
  if (exact.length > 0) {
    return exact;
  }
  const english = rows.filter((row) => row.language === 'en');
  if (english.length > 0) {
    return english;
  }
  return rows;
};

const bySlug = (rows: CmsPublicContent[], slug: string): CmsPublicContent | null => (
  rows.find((row) => row.slug === slug) ?? null
);

const isSlide = (row: CmsPublicContent): boolean => row.slug.startsWith(SLIDE_SLUG_PREFIX);

const isChromeSlug = (slug: string): boolean => CHROME_SLUGS.has(slug) || slug.startsWith(SLIDE_SLUG_PREFIX);

const isEditorial = (row: CmsPublicContent): boolean => (
  row.contentType !== COMMENT_TYPE
  && row.contentType !== PAGE_TYPE
  && row.contentType !== FRAGMENT_TYPE
  && !isChromeSlug(row.slug)
  && !/^wf[-_]/.test(row.slug)
);

const NAV_LABEL_BY_SLUG: Record<string, string> = {
  about: 'About',
  contact: 'Contact',
  guide: 'Guide',
};

const PUBLISHED_LIST_SQL = `
SELECT
  c.id,
  c.slug,
  c.title,
  c.summary,
  c.body,
  c.published_at,
  c.author_display_name,
  c.seo_title,
  c.seo_note,
  c.comments_enabled,
  type_item.short_name AS content_type,
  lang_item.short_name AS language_code,
  format_item.short_name AS body_format
FROM cms_contents c
INNER JOIN base_info status_item ON status_item.id = c.status_code
LEFT JOIN base_info type_item ON type_item.id = c.content_type_code
LEFT JOIN base_info lang_item ON lang_item.id = c.language_code
LEFT JOIN base_info format_item ON format_item.id = c.body_format_code
WHERE status_item.short_name = ?
  AND c.parent_content_id IS NULL
`;

const PUBLISHED_TAGS_SQL = `
SELECT
  t.content_id,
  tag_item.short_name,
  tag_item.title
FROM cms_content_tags t
INNER JOIN cms_contents c ON c.id = t.content_id
INNER JOIN base_info status_item ON status_item.id = c.status_code
INNER JOIN base_info tag_item ON tag_item.id = t.tag_code
WHERE status_item.short_name = ?
`;

const PUBLISHED_RELATIONS_SQL = `
SELECT r.content_id_a, r.content_id_b
FROM cms_content_relations r
INNER JOIN cms_contents a ON a.id = r.content_id_a
INNER JOIN cms_contents b ON b.id = r.content_id_b
INNER JOIN base_info a_status ON a_status.id = a.status_code
INNER JOIN base_info b_status ON b_status.id = b.status_code
WHERE a_status.short_name = ?
  AND b_status.short_name = ?
`;

const PUBLISHED_COMMENTS_SQL = `
SELECT
  c.id,
  c.slug,
  c.title,
  c.body,
  c.published_at,
  c.author_display_name,
  c.parent_content_id
FROM cms_contents c
INNER JOIN base_info status_item ON status_item.id = c.status_code
INNER JOIN base_info type_item ON type_item.id = c.content_type_code
WHERE status_item.short_name = ?
  AND type_item.short_name = ?
  AND c.parent_content_id IS NOT NULL
`;

const SETTINGS_TTL_SQL = 'SELECT public_cache_ttl_seconds FROM cms_settings WHERE id = 1';

const PUBLISHED_ASSETS_SQL = `
SELECT
  a.id,
  a.content_id,
  a.sort_order
FROM cms_content_assets a
INNER JOIN cms_contents c ON c.id = a.content_id
INNER JOIN base_info status_item ON status_item.id = c.status_code
WHERE status_item.short_name = ?
ORDER BY a.content_id, a.sort_order, a.id
`;

const buildPublishedAssetFileSql = (sourceType: string): string => {
  const file = quoteEdgeSqlColumn('file', sourceType);
  const fileXs = quoteEdgeSqlColumn('file_xs', sourceType);
  const fileAlias = quoteEdgeSqlColumn('file', sourceType);
  const fileXsAlias = quoteEdgeSqlColumn('file_xs', sourceType);
  return `
SELECT
  a.id,
  a.${file} AS ${fileAlias},
  a.${fileXs} AS ${fileXsAlias},
  a.file_mime,
  a.file_name
FROM cms_content_assets a
INNER JOIN cms_contents c ON c.id = a.content_id
INNER JOIN base_info status_item ON status_item.id = c.status_code
WHERE a.id = ?
  AND status_item.short_name = ?
`;
};

export type CmsPublicAssetFile = {
  id: string;
  mime: string;
  fileName: string;
  bytes: Buffer;
};

type AssetIndexRow = {
  id?: unknown;
  content_id?: unknown;
  contentId?: unknown;
  sort_order?: unknown;
};

const toBuffer = (value: unknown): Buffer | null => {
  if (Buffer.isBuffer(value)) {
    return value.length ? value : null;
  }
  if (value instanceof Uint8Array) {
    return value.length ? Buffer.from(value) : null;
  }
  if (typeof value === 'string' && value.startsWith('\\x') && value.length > 2) {
    const hex = value.slice(2);
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      return Buffer.from(hex, 'hex');
    }
  }
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    const data = (value as { data: number[] }).data;
    return data.length ? Buffer.from(data) : null;
  }
  return null;
};

const attachImages = (
  rows: CmsPublicContent[],
  assets: AssetIndexRow[],
): CmsPublicContent[] => {
  const byContent = new Map<string, string[]>();
  for (const asset of assets) {
    const contentId = asId(asset.content_id ?? asset.contentId);
    const assetId = asId(asset.id);
    if (!contentId || !assetId) {
      continue;
    }
    const list = byContent.get(contentId) ?? [];
    list.push(assetId);
    byContent.set(contentId, list);
  }
  return rows.map((row) => {
    const ids = byContent.get(row.id) ?? [];
    if (ids.length === 0) {
      return row;
    }
    return {
      ...row,
      coverImageUrl: cmsPublicAssetPath(ids[0]),
      imageUrls: ids.map(cmsPublicAssetPath),
    };
  });
};

const attachTags = (rows: CmsPublicContent[], tags: TagRow[]): CmsPublicContent[] => {
  const byContent = new Map<string, CmsPublicTag[]>();
  for (const tag of tags) {
    const contentId = asId(tag.content_id ?? tag.contentId);
    const slug = asText(tag.short_name ?? tag.shortName);
    const title = asText(tag.title) || slug;
    if (!contentId || !slug) {
      continue;
    }
    const list = byContent.get(contentId) ?? [];
    list.push({ slug, title, count: 1 });
    byContent.set(contentId, list);
  }
  return rows.map((row) => ({
    ...row,
    tags: byContent.get(row.id) ?? [],
  }));
};

const toRelated = (row: CmsPublicContent): CmsPublicRelated => ({
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  contentType: row.contentType,
  coverImageUrl: row.coverImageUrl,
});

const attachRelated = (rows: CmsPublicContent[], relations: RelationRow[]): CmsPublicContent[] => {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const relatedIds = new Map<string, string[]>();
  const push = (from: string, to: string) => {
    const list = relatedIds.get(from) ?? [];
    if (!list.includes(to)) {
      list.push(to);
    }
    relatedIds.set(from, list);
  };
  for (const relation of relations) {
    const left = asId(relation.content_id_a ?? relation.contentIdA);
    const right = asId(relation.content_id_b ?? relation.contentIdB);
    if (!left || !right) {
      continue;
    }
    push(left, right);
    push(right, left);
  }
  return rows.map((row) => ({
    ...row,
    related: (relatedIds.get(row.id) ?? [])
      .map((id) => byId.get(id))
      .filter((item): item is CmsPublicContent => Boolean(item) && item.contentType !== FRAGMENT_TYPE)
      .map(toRelated),
  }));
};

const attachComments = (rows: CmsPublicContent[], comments: ContentRow[]): CmsPublicContent[] => {
  const byParent = new Map<string, CmsPublicComment[]>();
  for (const row of comments) {
    const parentId = asId(row.parent_content_id ?? row.parentContentId);
    const mapped = mapRow(row);
    if (!parentId || !mapped) {
      continue;
    }
    const list = byParent.get(parentId) ?? [];
    list.push({
      id: mapped.id,
      title: mapped.title,
      body: mapped.body,
      authorDisplayName: mapped.authorDisplayName,
      publishedAt: mapped.publishedAt,
    });
    byParent.set(parentId, list);
  }
  return rows.map((row) => ({
    ...row,
    comments: (byParent.get(row.id) ?? []).sort((left, right) => (
      (left.publishedAt || '').localeCompare(right.publishedAt || '')
    )),
  }));
};

const buildTagCloud = (rows: CmsPublicContent[]): CmsPublicTag[] => {
  const counts = new Map<string, CmsPublicTag>();
  for (const row of rows) {
    if (!isEditorial(row) && row.contentType !== PAGE_TYPE) {
      continue;
    }
    for (const tag of row.tags) {
      const current = counts.get(tag.slug);
      if (current) {
        current.count += 1;
      } else {
        counts.set(tag.slug, { slug: tag.slug, title: tag.title, count: 1 });
      }
    }
  }
  return [...counts.values()].sort((left, right) => (
    right.count - left.count || left.title.localeCompare(right.title)
  ));
};

const emptyChrome = (): CmsPublicChrome => ({
  brandName: DEFAULT_BRAND,
  tagline: '',
  footerCopy: '',
  legal: `© ${DEFAULT_BRAND}`,
  ctaLabel: 'Contact',
  ctaSlug: 'contact',
  contactEmail: '',
  contactPhone: '',
  nav: [{ slug: '', title: 'Home' }],
});

const buildNav = (rows: CmsPublicContent[]): CmsPublicNavItem[] => {
  const pages = rows.filter((row) => row.contentType === PAGE_TYPE && row.slug !== 'home');
  const nav: CmsPublicNavItem[] = [{ slug: '', title: 'Home' }];
  if (pages.length > 0) {
    pages
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((page) => {
        nav.push({
          slug: page.slug,
          title: NAV_LABEL_BY_SLUG[page.slug] || page.title,
        });
      });
    return nav;
  }
  for (const slug of ['about', 'contact'] as const) {
    const page = bySlug(rows, slug);
    if (page) {
      nav.push({ slug: page.slug, title: NAV_LABEL_BY_SLUG[page.slug] || page.title });
    }
  }
  return nav;
};

const buildChrome = (rows: CmsPublicContent[]): CmsPublicChrome => {
  const brand = bySlug(rows, 'site-brand');
  const footer = bySlug(rows, 'site-footer');
  const legal = bySlug(rows, 'site-legal');
  const cta = bySlug(rows, 'site-cta');
  const talk = bySlug(rows, 'site-talk');
  const contact = bySlug(rows, 'contact');
  const brandName = brand?.title || DEFAULT_BRAND;
  return {
    brandName,
    tagline: brand?.summary || '',
    footerCopy: footer?.summary || footer?.body || '',
    legal: legal?.body || legal?.summary || `© ${brandName}`,
    ctaLabel: cta?.title || contact?.title || 'Contact',
    ctaSlug: cta?.summary || contact?.slug || 'contact',
    contactEmail: talk?.summary || '',
    contactPhone: talk?.body || '',
    nav: buildNav(rows),
  };
};

const buildHome = (rows: CmsPublicContent[]): CmsPublicHome => ({
  hero: bySlug(rows, 'home'),
  about: bySlug(rows, 'about'),
  contact: bySlug(rows, 'contact'),
  slides: rows.filter(isSlide).sort((a, b) => a.slug.localeCompare(b.slug)),
  stories: rows.filter(isEditorial).sort((a, b) => {
    const aTime = a.publishedAt || '';
    const bTime = b.publishedAt || '';
    return bTime.localeCompare(aTime);
  }),
  tagCloud: buildTagCloud(rows),
});

export class CmsPublicContentService {
  private readonly query: ReturnType<typeof createEdgeDbQueryExecutor>;
  private readonly publishedAssetFileSql: string;

  constructor(deps: CmsPublicContentServiceDeps) {
    this.query = deps.edgeDbQuery ?? createEdgeDbQueryExecutor({
      getDataSources: () => getDataSourcesFromSettings(deps.settingsPath),
    });
    const sources = getDataSourcesFromSettings(deps.settingsPath);
    const defaultSource = sources.find((item) => item.isDefault) ?? sources[0];
    this.publishedAssetFileSql = buildPublishedAssetFileSql(defaultSource?.type ?? 'PostgreSQL');
  }

  private async listPublished(): Promise<CmsPublicContent[]> {
    try {
      const [contents, assets, tags, relations, comments] = await Promise.all([
        this.query<ContentRow>(PUBLISHED_LIST_SQL, [PUBLISHED_STATUS]),
        this.query<AssetIndexRow>(PUBLISHED_ASSETS_SQL, [PUBLISHED_STATUS]),
        this.query<TagRow>(PUBLISHED_TAGS_SQL, [PUBLISHED_STATUS]),
        this.query<RelationRow>(PUBLISHED_RELATIONS_SQL, [PUBLISHED_STATUS, PUBLISHED_STATUS]),
        this.query<ContentRow>(PUBLISHED_COMMENTS_SQL, [PUBLISHED_STATUS, COMMENT_TYPE]),
      ]);
      const mapped = contents.data
        .map(mapRow)
        .filter((row): row is CmsPublicContent => row !== null)
        .filter((row) => row.contentType !== COMMENT_TYPE);
      return attachComments(
        attachRelated(
          attachTags(attachImages(mapped, assets.data), tags.data),
          relations.data,
        ),
        comments.data,
      );
    } catch (error) {
      if (isMissingCmsSchema(error)) {
        return [];
      }
      throw error;
    }
  }

  private async readCacheTtlSeconds(): Promise<number> {
    try {
      const result = await this.query<{ public_cache_ttl_seconds?: unknown; publicCacheTtlSeconds?: unknown }>(
        SETTINGS_TTL_SQL,
        [],
      );
      const row = result.data[0];
      const raw = row?.public_cache_ttl_seconds ?? row?.publicCacheTtlSeconds;
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.min(Math.floor(parsed), 86_400);
      }
    } catch (error) {
      if (!isMissingCmsSchema(error)) {
        throw error;
      }
    }
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  async getPublicSite(language?: string): Promise<CmsPublicSitePayload> {
    const [rows, cacheTtlSeconds] = await Promise.all([
      this.listPublished(),
      this.readCacheTtlSeconds(),
    ]);
    const localized = pickLanguage(rows, normalizeLanguage(language));
    return {
      chrome: localized.length > 0 ? buildChrome(localized) : emptyChrome(),
      home: buildHome(localized),
      cacheTtlSeconds,
    };
  }

  async getPublishedBySlug(slug: string, language?: string): Promise<CmsPublicContent> {
    const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, '');
    if (!normalizedSlug) {
      throw new HttpError(404, 'Content not found.');
    }
    const localized = pickLanguage(await this.listPublished(), normalizeLanguage(language));
    const item = localized.find((row) => row.slug === normalizedSlug && row.contentType !== FRAGMENT_TYPE);
    if (!item) {
      throw new HttpError(404, 'Content not found.');
    }
    return item;
  }

  async getPublishedAsset(assetId: string, variant: 'full' | 'xs' = 'full'): Promise<CmsPublicAssetFile> {
    const normalizedId = assetId.trim();
    if (!normalizedId) {
      throw new HttpError(404, 'Image not found.');
    }
    let result;
    try {
      result = await this.query<{
        id?: unknown;
        file?: unknown;
        file_xs?: unknown;
        fileXs?: unknown;
        file_mime?: unknown;
        fileMime?: unknown;
        file_name?: unknown;
        fileName?: unknown;
      }>(this.publishedAssetFileSql, [toQueryId(normalizedId), PUBLISHED_STATUS]);
    } catch (error) {
      if (isMissingCmsSchema(error)) {
        throw new HttpError(404, 'Image not found.');
      }
      throw error;
    }
    const row = result.data[0];
    if (!row) {
      throw new HttpError(404, 'Image not found.');
    }
    const thumb = toBuffer(row.file_xs ?? row.fileXs);
    const full = toBuffer(row.file);
    const bytes = variant === 'xs' ? (thumb ?? full) : (full ?? thumb);
    if (!bytes) {
      throw new HttpError(404, 'Image not found.');
    }
    return {
      id: asId(row.id) || normalizedId,
      mime: asText(row.file_mime) || asText(row.fileMime) || 'image/jpeg',
      fileName: asText(row.file_name) || asText(row.fileName) || 'image.jpg',
      bytes,
    };
  }
}
