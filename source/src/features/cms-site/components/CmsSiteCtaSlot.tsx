import React from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { SiteLink } from '../../../layouts/siteShell/SiteLink';
import { buildSiteHref } from '../../../layouts/siteShell/siteNav';
import { useCmsPublicSite } from '../hooks/useCmsPublicSite';

export const CmsSiteCtaSlot: React.FC = () => {
  const culture = useOptionalCulture();
  const cultureId = culture?.cultureId || 'us';
  const { data } = useCmsPublicSite();
  const label = data?.chrome.ctaLabel || 'Contact';
  const slug = data?.chrome.ctaSlug || 'contact';
  return (
    <SiteLink className="site-shell-cta" to={buildSiteHref(cultureId, { path: slug })}>
      {label}
    </SiteLink>
  );
};
