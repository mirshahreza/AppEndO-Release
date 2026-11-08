import React from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { SiteLink } from '../../../layouts/siteShell/SiteLink';
import { buildSiteHref } from '../../../layouts/siteShell/siteNav';
import { useCmsPublicSite } from '../hooks/useCmsPublicSite';

export const CmsSiteBrandSlot: React.FC = () => {
  const culture = useOptionalCulture();
  const cultureId = culture?.cultureId || 'us';
  const { data } = useCmsPublicSite();
  const brandName = data?.chrome.brandName || 'Site';
  return (
    <SiteLink className="site-shell-brand" to={buildSiteHref(cultureId, { path: '' })}>
      <img className="site-shell-brand-mark" src="/assets/appendo-logo-only.png" alt="" />
      {brandName}
    </SiteLink>
  );
};
