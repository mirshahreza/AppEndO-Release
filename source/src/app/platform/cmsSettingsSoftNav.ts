/**
 * Soft in-shell navigation for CMS Settings sections.
 *
 * Each left-rail section is a separate Designer pageKey today, so a normal
 * shell route change remounts the full document (nav + main) and runs the
 * formatted-reveal cover. Within this family we skip the cover and prefetch
 * sibling drafts so the swap feels like section switching, not a deep reload.
 */

/** Published Client Component paths for the CMS Settings family (General + vocab). */
export const CMS_SETTINGS_PUBLISHED_COMPONENT_PATHS = [
  'cms/cms-settings',
  'cms/cms-vocab-content-tags',
  'cms/cms-vocab-content-types',
  'cms/cms-vocab-statuses',
  'cms/cms-vocab-languages',
] as const;

/** True for `/…/studio/cms/settings` and `/…/studio/cms/settings/<section>`. */
export const isCmsSettingsSectionPath = (pathname: string): boolean => (
  /(?:^|\/)studio\/cms\/settings(?:\/|$)/.test(pathname.trim())
);

export const isCmsSettingsPublishedComponentPath = (componentPath: string): boolean => {
  const path = componentPath.trim();
  return (CMS_SETTINGS_PUBLISHED_COMPONENT_PATHS as readonly string[]).includes(path);
};

/** Soft-nav when both from/to are CMS Settings section URLs. */
export const isCmsSettingsSoftNavigation = (fromPathname: string, toPathname: string): boolean => (
  isCmsSettingsSectionPath(fromPathname) && isCmsSettingsSectionPath(toPathname)
);
