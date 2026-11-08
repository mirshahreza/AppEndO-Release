export type CmsPublicTag = {
  slug: string;
  title: string;
  count: number;
};

export type CmsPublicRelated = {
  slug: string;
  title: string;
  summary: string;
  contentType: string;
  coverImageUrl: string | null;
};

export type CmsPublicComment = {
  id: string;
  title: string;
  body: string;
  authorDisplayName: string;
  publishedAt: string | null;
};

export type CmsPublicContent = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  bodyFormat: string;
  contentType: string;
  language: string;
  publishedAt: string | null;
  authorDisplayName: string;
  seoTitle: string;
  seoNote: string;
  commentsEnabled: boolean;
  coverImageUrl: string | null;
  imageUrls: string[];
  tags: CmsPublicTag[];
  related: CmsPublicRelated[];
  comments: CmsPublicComment[];
};

export type CmsPublicNavItem = {
  slug: string;
  title: string;
};

export type CmsPublicChrome = {
  brandName: string;
  tagline: string;
  footerCopy: string;
  legal: string;
  ctaLabel: string;
  ctaSlug: string;
  contactEmail: string;
  contactPhone: string;
  nav: CmsPublicNavItem[];
};

export type CmsPublicHome = {
  hero: CmsPublicContent | null;
  about: CmsPublicContent | null;
  contact: CmsPublicContent | null;
  slides: CmsPublicContent[];
  stories: CmsPublicContent[];
  tagCloud: CmsPublicTag[];
};

export type CmsPublicSitePayload = {
  chrome: CmsPublicChrome;
  home: CmsPublicHome;
  cacheTtlSeconds: number;
};

export type CmsPublicSiteResponse = CmsPublicSitePayload & {
  success: true;
};

export type CmsPublicContentResponse = {
  success: true;
  item: CmsPublicContent;
};

export const EMPTY_CMS_PUBLIC_FIELDS = {
  seoTitle: '',
  seoNote: '',
  commentsEnabled: false,
  tags: [] as CmsPublicTag[],
  related: [] as CmsPublicRelated[],
  comments: [] as CmsPublicComment[],
};
