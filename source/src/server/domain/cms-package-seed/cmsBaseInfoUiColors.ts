/**
 * Semantic UI colors for CMS Base Info items (stored in `base_info.ui_color`).
 * Gentle concept-matched hues — statuses, types, languages, and tag domains.
 */

/** Hex colors aligned with Studio semantic maps (text/icon accents, not large fills). */
export const CMS_BASE_INFO_ITEM_UI_COLORS: Record<string, string> = {
  // Content Types
  article: '#0ea5e9',
  news: '#6366f1',
  announcement: '#f59e0b',
  gallery: '#8b5cf6',
  comment: '#14b8a6',
  page: '#0f766e',
  fragment: '#64748b',
  howto: '#0369a1',

  // Statuses — workflow meaning
  draft: '#94a3b8',
  in_review: '#6366f1',
  published: '#047857',
  archived: '#64748b',
  rejected: '#f43f5e',

  // Body Formats
  plain: '#64748b',
  markdown: '#6366f1',
  html: '#f97316',

  // Languages
  en: '#3b82f6',
  fa: '#0d9488',
  ar: '#d97706',

  // Content Tags — AppEndO product guide
  featured: '#047857',
  platform: '#0f766e',
  studio: '#0ea5e9',
  identity: '#6366f1',
  data: '#0284c7',
  workflows: '#065f46',
  functions: '#0d9488',
  design: '#8b5cf6',
  packages: '#7c3aed',
  operations: '#f59e0b',
  ai: '#a855f7',
  security: '#f43f5e',
  install: '#ea580c',
  front_office: '#2563eb',

  // Comment Policies
  auto: '#f59e0b',
  approve: '#047857',
};

export const cmsBaseInfoUiColor = (shortName: string | undefined): string | null => {
  if (!shortName?.trim()) {
    return null;
  }
  return CMS_BASE_INFO_ITEM_UI_COLORS[shortName.trim()] ?? null;
};
