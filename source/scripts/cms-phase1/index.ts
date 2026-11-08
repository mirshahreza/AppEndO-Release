/**
 * CMS Phase 1 seed helpers (opt-in scripts only — not platform core).
 */

export const CMS_TABLE_NAMES = [
  'cms_contents',
  'cms_content_revisions',
  'cms_content_assets',
  'cms_content_tags',
  'cms_content_relations',
  'cms_settings',
] as const;

export {
  CMS_BASE_INFO_CATEGORIES,
  CMS_BASE_INFO_ROOT_TITLE,
  cmsBaseInfoUiHtml,
  type CmsBaseInfoCategorySeed,
  type CmsBaseInfoItemSeed,
} from './seed/cmsBaseInfoCatalog';

export {
  seedCmsBaseInfo,
  unseedCmsBaseInfo,
  type CmsBaseInfoSeedResult,
} from './seed/seedCmsBaseInfo';

export {
  seedCmsStudioMeta,
} from './seed/seedCmsStudioMeta';
