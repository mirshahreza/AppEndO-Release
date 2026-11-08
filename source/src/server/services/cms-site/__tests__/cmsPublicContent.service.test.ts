import { describe, expect, it, vi } from 'vitest';
import { CmsPublicContentService } from '../cmsPublicContent.service';
import { HttpError } from '../../../errors/HttpError';

vi.mock('../../../db/dataSourcesStore', () => ({
  getDataSourcesFromSettings: vi.fn(() => [{ id: 'ds1', type: 'PostgreSQL', isDefault: true }]),
}));

const publishedRows = [
  {
    id: 1,
    slug: 'site-brand',
    title: 'Harbor',
    summary: 'Public CMS website',
    body: '',
    published_at: '2026-08-01',
    author_display_name: '',
    content_type: 'fragment',
    language_code: 'en',
    body_format: 'plain',
  },
  {
    id: 2,
    slug: 'home',
    title: 'Welcome home',
    summary: 'Landing from the database',
    body: 'Hero body',
    published_at: '2026-08-02',
    author_display_name: 'Editor',
    content_type: 'page',
    language_code: 'en',
    body_format: 'plain',
  },
  {
    id: 3,
    slug: 'about',
    title: 'About',
    summary: 'Who we are',
    body: 'About body',
    published_at: '2026-08-03',
    author_display_name: '',
    content_type: 'page',
    language_code: 'en',
    body_format: 'plain',
  },
  {
    id: 4,
    slug: 'slide-01',
    title: 'Quiet tools',
    summary: '01 — Studio',
    body: 'Slide copy',
    published_at: '2026-08-04',
    author_display_name: '',
    content_type: 'fragment',
    language_code: 'en',
    body_format: 'plain',
  },
  {
    id: 5,
    slug: 'welcome-to-cms',
    title: 'Welcome to CMS',
    summary: 'Published article',
    body: 'Article body',
    published_at: '2026-08-05',
    author_display_name: 'Ada',
    content_type: 'article',
    language_code: 'en',
    body_format: 'plain',
  },
  {
    id: 6,
    slug: 'draft-only',
    title: 'Should never appear',
    summary: '',
    body: '',
    published_at: null,
    author_display_name: '',
    content_type: 'article',
    language_code: 'en',
    body_format: 'plain',
  },
];

describe('CmsPublicContentService', () => {
  it('assembles chrome, pages, slides, and stories from published rows only', async () => {
    const edgeDbQuery = vi.fn(async (sql: string) => {
      if (String(sql).includes('cms_settings')) {
        return { data: [{ public_cache_ttl_seconds: 120 }], count: 1, source: { id: '1', name: 'db', type: 'PostgreSQL' } };
      }
      if (String(sql).includes('cms_content_assets')) {
        return {
          data: [{ id: 40, content_id: 4, sort_order: 0 }],
          count: 1,
          source: { id: '1', name: 'db', type: 'PostgreSQL' },
        };
      }
      if (String(sql).includes('cms_content_tags')) {
        return {
          data: [{ content_id: 5, short_name: 'field', title: 'Field' }],
          count: 1,
          source: { id: '1', name: 'db', type: 'PostgreSQL' },
        };
      }
      if (String(sql).includes('cms_content_relations')) {
        return { data: [], count: 0, source: { id: '1', name: 'db', type: 'PostgreSQL' } };
      }
      if (String(sql).includes('parent_content_id IS NOT NULL')) {
        return { data: [], count: 0, source: { id: '1', name: 'db', type: 'PostgreSQL' } };
      }
      return { data: publishedRows.filter((row) => row.slug !== 'draft-only'), count: 5, source: { id: '1', name: 'db', type: 'PostgreSQL' } };
    });
    const service = new CmsPublicContentService({
      settingsPath: 'settings.json',
      edgeDbQuery: edgeDbQuery as never,
    });

    const site = await service.getPublicSite('en');
    expect(site.cacheTtlSeconds).toBe(120);
    expect(site.chrome.brandName).toBe('Harbor');
    expect(site.chrome.nav.map((item) => item.slug)).toEqual(['', 'about']);
    expect(site.home.hero?.title).toBe('Welcome home');
    expect(site.home.slides).toHaveLength(1);
    expect(site.home.slides[0].coverImageUrl).toBe('/api/cms-site/public/assets/40');
    expect(site.home.stories.map((item) => item.slug)).toEqual(['welcome-to-cms']);
    expect(site.home.stories[0].tags).toEqual([{ slug: 'field', title: 'Field', count: 1 }]);
    expect(site.home.tagCloud).toEqual([{ slug: 'field', title: 'Field', count: 1 }]);
  });

  it('returns empty chrome when the CMS schema is missing', async () => {
    const edgeDbQuery = vi.fn(async () => {
      throw new Error('relation "cms_contents" does not exist');
    });
    const service = new CmsPublicContentService({
      settingsPath: 'settings.json',
      edgeDbQuery: edgeDbQuery as never,
    });

    const site = await service.getPublicSite('en');
    expect(site.chrome.brandName).toBe('Site');
    expect(site.home.stories).toEqual([]);
  });

  it('loads a published page by slug and hides fragments', async () => {
    const edgeDbQuery = vi.fn(async () => ({
      data: publishedRows.filter((row) => row.slug !== 'draft-only'),
      count: 5,
      source: { id: '1', name: 'db', type: 'PostgreSQL' },
    }));
    const service = new CmsPublicContentService({
      settingsPath: 'settings.json',
      edgeDbQuery: edgeDbQuery as never,
    });

    await expect(service.getPublishedBySlug('welcome-to-cms', 'en')).resolves.toMatchObject({
      title: 'Welcome to CMS',
    });
    await expect(service.getPublishedBySlug('site-brand', 'en')).rejects.toBeInstanceOf(HttpError);
  });

  it('streams a published asset and hides unpublished files', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e]);
    const edgeDbQuery = vi.fn(async (sql: string) => {
      if (String(sql).includes('cms_content_assets a')) {
        return {
          data: [{ id: 40, file: bytes, file_xs: null, file_mime: 'image/jpeg', file_name: 'slide-01.jpg' }],
          count: 1,
          source: { id: '1', name: 'db', type: 'PostgreSQL' },
        };
      }
      return { data: [], count: 0, source: { id: '1', name: 'db', type: 'PostgreSQL' } };
    });
    const service = new CmsPublicContentService({
      settingsPath: 'settings.json',
      edgeDbQuery: edgeDbQuery as never,
    });

    await expect(service.getPublishedAsset('40')).resolves.toMatchObject({
      mime: 'image/jpeg',
      fileName: 'slide-01.jpg',
    });
    expect(edgeDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('cms_content_assets'),
      [40, 'published'],
    );
  });

  it('quotes reserved asset columns for SQL Server data sources', async () => {
    const { getDataSourcesFromSettings } = await import('../../../db/dataSourcesStore');
    vi.mocked(getDataSourcesFromSettings).mockReturnValueOnce([
      { id: 'ds1', type: 'SQL Server', isDefault: true } as never,
    ]);
    const bytes = Buffer.from([0xff, 0xd8, 0xff]);
    const edgeDbQuery = vi.fn(async () => ({
      data: [{ id: 40, file: bytes, file_xs: null, file_mime: 'image/jpeg', file_name: 'slide-01.jpg' }],
      count: 1,
      source: { id: 'ds1', name: 'db', type: 'SQL Server' },
    }));
    const service = new CmsPublicContentService({
      settingsPath: 'settings.json',
      edgeDbQuery: edgeDbQuery as never,
    });

    await expect(service.getPublishedAsset('40')).resolves.toMatchObject({
      mime: 'image/jpeg',
      fileName: 'slide-01.jpg',
    });
    expect(edgeDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('a.[file] AS [file]'),
      [40, 'published'],
    );
  });
});
