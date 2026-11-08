import type { CmsFilterOptions } from '../../../../../scripts/cms-phase3/cmsIds';

/** Stable fake Base Info ids — tests never hit the database. */
export const CMS_TEST_IDS = {
  bodyFormat: {
    plain: 'bf-plain',
    markdown: 'bf-markdown',
    html: 'bf-html',
  },
  status: {
    published: 'st-published',
    archived: 'st-archived',
    draft: 'st-draft',
    inReview: 'st-in-review',
    /** Alias of published — Approved removed from CMS Statuses. */
    approved: 'st-published',
    rejected: 'st-rejected',
    /** Alias of rejected — Spam removed from CMS Statuses. */
    spam: 'st-rejected',
    /** Alias of in_review — Pending removed from CMS Statuses. */
    pending: 'st-in-review',
  },
  contentType: {
    article: 'ct-article',
    page: 'ct-page',
    comment: 'ct-comment',
  },
  language: {
    en: 'lang-en',
    fa: 'lang-fa',
  },
  commentPolicy: {
    open: 'cp-open',
    moderated: 'cp-moderated',
  },
  contentTag: {
    news: 'tag-news',
    featured: 'tag-featured',
  },
  vocabCategory: {
    contentTags: 'cat-content-tags',
    contentTypes: 'cat-content-types',
    statuses: 'cat-statuses',
    languages: 'cat-languages',
    bodyFormats: 'cat-body-formats',
    commentPolicies: 'cat-comment-policies',
  },
  content: {
    sample: '42',
    related: '99',
  },
  settings: {
    singleton: '1',
  },
} as const;

export const buildCmsTestBaseInfoCategoryIds = () => ({
  Statuses: CMS_TEST_IDS.vocabCategory.statuses,
  'Content Types': CMS_TEST_IDS.vocabCategory.contentTypes,
  Languages: CMS_TEST_IDS.vocabCategory.languages,
  'Body Formats': CMS_TEST_IDS.vocabCategory.bodyFormats,
  'Comment Policies': CMS_TEST_IDS.vocabCategory.commentPolicies,
});

export const buildCmsTestFilterOptions = (): CmsFilterOptions => ({
  contentTypes: [
    { value: CMS_TEST_IDS.contentType.article, label: 'Article' },
    { value: CMS_TEST_IDS.contentType.page, label: 'Page' },
    { value: CMS_TEST_IDS.contentType.comment, label: 'Comment' },
  ],
  languages: [
    { value: CMS_TEST_IDS.language.en, label: 'English' },
    { value: CMS_TEST_IDS.language.fa, label: 'Persian' },
  ],
  statuses: [
    { value: CMS_TEST_IDS.status.draft, label: 'Draft', uiColor: '#94a3b8', icon: 'FilePenLine' },
    { value: CMS_TEST_IDS.status.published, label: 'Published', uiColor: '#047857', icon: 'CheckCircle2' },
    { value: CMS_TEST_IDS.status.archived, label: 'Archived', uiColor: '#64748b', icon: 'Archive' },
  ],
  bodyFormats: [
    { value: CMS_TEST_IDS.bodyFormat.plain, label: 'Plain' },
    { value: CMS_TEST_IDS.bodyFormat.markdown, label: 'Markdown' },
    { value: CMS_TEST_IDS.bodyFormat.html, label: 'HTML' },
  ],
  commentPolicies: [
    { value: CMS_TEST_IDS.commentPolicy.open, label: 'Open' },
    { value: CMS_TEST_IDS.commentPolicy.moderated, label: 'Moderated' },
  ],
  contentTags: [
    { value: CMS_TEST_IDS.contentTag.news, label: 'News' },
    { value: CMS_TEST_IDS.contentTag.featured, label: 'Featured' },
  ],
  contents: [
    { value: CMS_TEST_IDS.content.sample, label: 'Sample article' },
    { value: CMS_TEST_IDS.content.related, label: 'Related page' },
  ],
});

export const buildCmsTestContentRecord = (overrides: Record<string, unknown> = {}) => ({
  id: CMS_TEST_IDS.content.sample,
  title: 'Original title',
  summary: 'Original summary',
  body: 'Original body text',
  slug: 'original-slug',
  contentTypeCode: CMS_TEST_IDS.contentType.article,
  contentTypeCodeTitle: 'Article',
  languageCode: CMS_TEST_IDS.language.en,
  languageCodeTitle: 'English',
  bodyFormatCode: CMS_TEST_IDS.bodyFormat.plain,
  bodyFormatCodeTitle: 'Plain',
  statusCode: CMS_TEST_IDS.status.draft,
  statusCodeTitle: 'Draft',
  seoTitle: 'Original SEO title',
  seoNote: 'Original SEO description',
  operatorNote: '',
  commentsEnabled: true,
  commentsPolicyCode: CMS_TEST_IDS.commentPolicy.open,
  commentsBodyFormatCode: CMS_TEST_IDS.bodyFormat.plain,
  publicCacheTtlSeconds: 300,
  commentCount: 0,
  revisionCount: 0,
  tagSummary: '',
  publishedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const buildCmsTestSettingsRecord = (overrides: Record<string, unknown> = {}) => ({
  id: CMS_TEST_IDS.settings.singleton,
  commentsEnabled: true,
  commentsPolicyCode: CMS_TEST_IDS.commentPolicy.open,
  commentsBodyFormatCode: CMS_TEST_IDS.bodyFormat.plain,
  publicCacheTtlSeconds: 300,
  ...overrides,
});

export const jsonResponse = (payload: unknown, status = 200) => new Response(
  JSON.stringify(payload),
  { status, headers: { 'Content-Type': 'application/json' } },
);

export type CmsFetchMockOptions = {
  content?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

export const createCmsFetchMock = (options: CmsFetchMockOptions = {}) => {
  const content = buildCmsTestContentRecord(options.content);
  const settings = buildCmsTestSettingsRecord(options.settings);
  const mutations: Array<{ method: string; url: string; body: unknown }> = [];

  const handler = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    if (method !== 'GET') {
      mutations.push({ method, url, body });
    }

    if (method === 'GET') {
      if (url.includes('/api/cms/settings/1')) {
        return jsonResponse({ success: true, data: [settings], count: 1 });
      }
      if (/\/api\/cms\/contents\/\d+/.test(url)) {
        return jsonResponse({ success: true, data: [content], count: 1 });
      }
      if (url.includes('/api/cms/contents')) {
        return jsonResponse({ success: true, data: [content], count: 1 });
      }
      if (url.includes('/api/cms/assets')
        || url.includes('/api/cms/relations')
        || url.includes('/api/cms/tags')
        || url.includes('/api/cms/comments')
        || url.includes('/api/cms/revisions')) {
        return jsonResponse({ success: true, data: [], count: 0 });
      }
      if (url.includes('/api/base-info/options')) {
        const rootMatch = url.match(/[?&]root=([^&]+)/);
        const root = rootMatch ? decodeURIComponent(rootMatch[1]!) : '';
        const filterOptions = buildCmsTestFilterOptions();
        const itemsByRoot: Record<string, Array<{ id: string; label: string; ui_color?: string | null; ui_html?: string | null }>> = {
          [CMS_TEST_IDS.vocabCategory.statuses]: filterOptions.statuses.map((option) => ({
            id: option.value,
            label: option.label,
            ui_color: option.uiColor ?? null,
            ui_html: option.icon ? `<i data-lucide="${option.icon}"></i>` : null,
          })),
          [CMS_TEST_IDS.vocabCategory.contentTypes]: filterOptions.contentTypes.map((option) => ({
            id: option.value,
            label: option.label,
          })),
          [CMS_TEST_IDS.vocabCategory.languages]: filterOptions.languages.map((option) => ({
            id: option.value,
            label: option.label,
          })),
          [CMS_TEST_IDS.vocabCategory.bodyFormats]: filterOptions.bodyFormats.map((option) => ({
            id: option.value,
            label: option.label,
          })),
          [CMS_TEST_IDS.vocabCategory.commentPolicies]: filterOptions.commentPolicies.map((option) => ({
            id: option.value,
            label: option.label,
          })),
        };
        return jsonResponse({
          success: true,
          items: itemsByRoot[root] ?? [],
        });
      }
      if (url.includes('/api/base-info/children')) {
        return jsonResponse({ success: true, items: [], count: 0 });
      }
      if (/\/api\/base-info\/[^/?]+/.test(url)) {
        return jsonResponse({
          success: true,
          data: {
            id: 'vocab-1',
            title: 'Existing tag',
            shortName: 'existing',
            viewOrder: 1,
            isActive: true,
            parentId: CMS_TEST_IDS.vocabCategory.contentTags,
            uiColor: '#6366f1',
          },
        });
      }
    }

    if (method === 'PUT' || method === 'POST' || method === 'DELETE' || method === 'PATCH') {
      return jsonResponse({ success: true, data: body ?? {} });
    }

    return jsonResponse({ success: true, data: [] });
  };

  return { handler, mutations, content, settings };
};
