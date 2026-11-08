import React from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { SiteLink } from '../../../layouts/siteShell/SiteLink';
import { buildSiteHref, siteNavLabel } from '../../../layouts/siteShell/siteNav';
import { useCmsPublicSite } from '../hooks/useCmsPublicSite';

export const CmsSiteFooterSlot: React.FC = () => {
  const culture = useOptionalCulture();
  const cultureId = culture?.cultureId || 'us';
  const { data } = useCmsPublicSite();
  const chrome = data?.chrome;
  const brandName = chrome?.brandName || 'Site';
  const nav = chrome?.nav ?? [{ slug: '', title: 'Home' }];
  const talkLinks = [
    chrome?.contactEmail
      ? { label: chrome.contactEmail, href: `mailto:${chrome.contactEmail}` }
      : null,
    chrome?.contactPhone
      ? { label: chrome.contactPhone, href: `tel:${chrome.contactPhone.replace(/\s+/g, '')}` }
      : null,
  ].filter((item): item is { label: string; href: string } => item !== null);

  return (
    <>
      <div className="site-shell-footer-inner">
        <div className="site-shell-footer-brand">
          <SiteLink className="site-shell-brand" to={buildSiteHref(cultureId, { path: '' })}>
            {brandName}
          </SiteLink>
          {chrome?.footerCopy ? (
            <p className="site-shell-footer-copy">{chrome.footerCopy}</p>
          ) : chrome?.tagline ? (
            <p className="site-shell-footer-copy">{chrome.tagline}</p>
          ) : null}
        </div>
        <div className="site-shell-footer-col">
          <h2 className="site-shell-footer-title">Explore</h2>
          {nav.map((item) => (
            <SiteLink
              key={item.slug || 'home'}
              className="site-shell-footer-link"
              to={buildSiteHref(cultureId, { path: item.slug })}
            >
              {siteNavLabel(item.slug, item.title)}
            </SiteLink>
          ))}
          <a className="site-shell-footer-link" href={`/${cultureId}/studio`}>
            Studio ↗
          </a>
        </div>
        {talkLinks.length > 0 ? (
          <div className="site-shell-footer-col">
            <h2 className="site-shell-footer-title">Talk</h2>
            {talkLinks.map((item) => (
              <a key={item.href} className="site-shell-footer-link" href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <p className="site-shell-footer-legal">
        {chrome?.legal || `© ${new Date().getFullYear()} ${brandName}`}
      </p>
    </>
  );
};
