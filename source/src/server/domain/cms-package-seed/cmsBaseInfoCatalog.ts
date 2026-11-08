/**
 * CMS package Base Info catalog (opt-in).
 * Not wired into controlPlaneSeed / app bootstrap.
 */

export type CmsBaseInfoItemSeed = {
  title: string;
  shortName: string;
  lucideIcon?: string;
  /** English note shown in Base Info and status pickers (stored as note + noteEn). */
  note?: string;
  viewOrder: number;
  value: number;
};

export type CmsBaseInfoCategorySeed = {
  title: string;
  viewOrder: number;
  value: number;
  items: CmsBaseInfoItemSeed[];
};

const lucide = (name: string) => `<i data-lucide="${name}"></i>`;

const item = (
  title: string,
  shortName: string,
  viewOrder: number,
  lucideIcon?: string,
  note?: string,
): CmsBaseInfoItemSeed => ({
  title,
  shortName,
  viewOrder,
  value: viewOrder,
  lucideIcon,
  ...(note ? { note } : {}),
});

export const CMS_BASE_INFO_ROOT_TITLE = 'CMS';

export const CMS_BASE_INFO_CATEGORIES: CmsBaseInfoCategorySeed[] = [
  {
    title: 'Content Types',
    viewOrder: 1,
    value: 1,
    items: [
      item('Article', 'article', 1, 'Newspaper'),
      item('News', 'news', 2, 'Rss'),
      item('Announcement', 'announcement', 3, 'Megaphone'),
      item('Gallery', 'gallery', 4, 'Images'),
      item('Comment', 'comment', 5, 'MessageSquare'),
      item('Page', 'page', 6, 'FileText'),
      item('Fragment', 'fragment', 7, 'Puzzle'),
      item('How to', 'howto', 8, 'ListChecks'),
    ],
  },
  {
    title: 'Statuses',
    viewOrder: 2,
    value: 2,
    items: [
      item(
        'Draft',
        'draft',
        1,
        'FilePenLine',
        'Work in progress. Not visible on the public site.',
      ),
      item(
        'In Review',
        'in_review',
        2,
        'Eye',
        'Awaiting editorial review before it can be published.',
      ),
      item(
        'Published',
        'published',
        3,
        'CheckCircle2',
        'Live and visible to public readers.',
      ),
      item(
        'Archived',
        'archived',
        4,
        'Archive',
        'Retired from the public site; kept for history.',
      ),
      item(
        'Rejected',
        'rejected',
        5,
        'XCircle',
        'Declined in review; not for publication.',
      ),
      // Pending / Approved / Spam removed — comments reuse In Review / Published / Rejected.
    ],
  },
  {
    title: 'Body Formats',
    viewOrder: 3,
    value: 3,
    items: [
      item('HTML', 'html', 1),
      item('Markdown', 'markdown', 2),
      item('Plain', 'plain', 3),
    ],
  },
  {
    title: 'Languages',
    viewOrder: 4,
    value: 4,
    items: [
      item('English', 'en', 1, 'Languages'),
      item('Persian', 'fa', 2, 'Languages'),
      item('Arabic', 'ar', 3, 'Languages'),
    ],
  },
  {
    title: 'Content Tags',
    viewOrder: 5,
    value: 5,
    items: [
      item('Featured', 'featured', 1, 'BadgeCheck'),
      item('Platform', 'platform', 2, 'AppWindow'),
      item('Studio', 'studio', 3, 'Building2'),
      item('Identity', 'identity', 4, 'Shield'),
      item('Data', 'data', 5, 'Database'),
      item('Workflows', 'workflows', 6, 'Workflow'),
      item('Functions', 'functions', 7, 'FunctionSquare'),
      item('Design', 'design', 8, 'PenTool'),
      item('Packages', 'packages', 9, 'Package'),
      item('Operations', 'operations', 10, 'Settings'),
      item('AI', 'ai', 11, 'Sparkles'),
      item('Security', 'security', 12, 'Lock'),
      item('Install', 'install', 13, 'Rocket'),
      item('Front office', 'front_office', 14, 'Globe'),
      item('How to', 'howto', 15, 'ListChecks'),
    ],
  },
  {
    title: 'Comment Policies',
    viewOrder: 6,
    value: 6,
    items: [
      item('Automatic', 'auto', 1, 'Zap'),
      item('Approve', 'approve', 2, 'ShieldCheck'),
    ],
  },
  // No separate "Comment Body Formats" category: comment body format is the same
  // vocabulary as content body format (`Body Formats`, plain/markdown/html) —
  // comments_body_format_code / cms_comments.body_format_code point at that category.
];

export const cmsBaseInfoUiHtml = (lucideIcon?: string): string | null => (
  lucideIcon ? lucide(lucideIcon) : null
);

/** Lucide icon names keyed by Base Info `short_name` (from the CMS catalog). */
export const CMS_BASE_INFO_ITEM_UI_ICONS: Record<string, string> = Object.fromEntries(
  CMS_BASE_INFO_CATEGORIES.flatMap((category) => (
    category.items
      .filter((item) => item.lucideIcon)
      .map((item) => [item.shortName, item.lucideIcon!])
  )),
);
