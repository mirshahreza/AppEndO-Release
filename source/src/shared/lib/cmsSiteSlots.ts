/** Designer system-slot ids for CMS-backed public site chrome. */
export const CMS_SITE_BRAND_SLOT = 'cms.site.brand' as const;
export const CMS_SITE_NAV_SLOT = 'cms.site.nav' as const;
export const CMS_SITE_CTA_SLOT = 'cms.site.cta' as const;
export const CMS_SITE_FOOTER_SLOT = 'cms.site.footer' as const;

export const CMS_SITE_CHROME_SLOT_IDS = [
  CMS_SITE_BRAND_SLOT,
  CMS_SITE_NAV_SLOT,
  CMS_SITE_CTA_SLOT,
  CMS_SITE_FOOTER_SLOT,
] as const;

export type CmsSiteChromeSlotId = (typeof CMS_SITE_CHROME_SLOT_IDS)[number];

export function isCmsSiteChromeSlotId(slotId: string): slotId is CmsSiteChromeSlotId {
  return (CMS_SITE_CHROME_SLOT_IDS as readonly string[]).includes(slotId);
}
