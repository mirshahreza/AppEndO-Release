import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { SiteLink } from '../../../layouts/siteShell/SiteLink';
import { buildSiteHref, siteNavLabel } from '../../../layouts/siteShell/siteNav';
import { useCmsPublicSite } from '../hooks/useCmsPublicSite';

type NavItem = { slug: string; title: string };

export const CmsSiteNavSlot: React.FC = () => {
  const culture = useOptionalCulture();
  const cultureId = culture?.cultureId || 'us';
  const { pathname } = useLocation();
  const { data } = useCmsPublicSite();
  const panelId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = useMemo<NavItem[]>(
    () => data?.chrome.nav ?? [{ slug: '', title: 'Home' }],
    [data?.chrome.nav],
  );

  const studioHref = `/${cultureId}/studio`;
  const ctaLabel = data?.chrome.ctaLabel || 'Get started';
  const ctaHref = buildSiteHref(cultureId, { path: data?.chrome.ctaSlug || 'contact' });

  const isCurrent = useCallback(
    (slug: string) => {
      const href = buildSiteHref(cultureId, { path: slug });
      return pathname === href || pathname === `${href}/`;
    },
    [cultureId, pathname],
  );

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen, closeMobile]);

  const renderNavLink = (item: NavItem, className: string, onNavigate?: () => void) => {
    const href = buildSiteHref(cultureId, { path: item.slug });
    const current = isCurrent(item.slug);
    return (
      <SiteLink
        key={item.slug || 'home'}
        className={className}
        to={href}
        aria-current={current ? 'page' : undefined}
        onClick={onNavigate}
      >
        {siteNavLabel(item.slug, item.title)}
      </SiteLink>
    );
  };

  return (
    <div className="site-shell-nav-host">
      <button
        type="button"
        className="site-shell-menu-button"
        aria-expanded={mobileOpen}
        aria-controls={panelId}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="site-shell-menu-button-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="site-shell-menu-button-label">{mobileOpen ? 'Close' : 'Menu'}</span>
      </button>

      <nav className="site-shell-nav" aria-label="Site">
        {items.map((item) => renderNavLink(item, 'site-shell-nav-link'))}
        <a className="site-shell-nav-link site-shell-nav-external" href={studioHref} aria-label="Studio (opens AppEndO Studio)">
          Studio
          <span className="site-shell-nav-external-mark" aria-hidden="true">↗</span>
        </a>
      </nav>

      <div
        className="site-shell-mobile-scrim"
        data-open={mobileOpen ? 'true' : 'false'}
        aria-hidden="true"
        onClick={closeMobile}
      />
      <div
        id={panelId}
        className="site-shell-mobile-panel"
        data-open={mobileOpen ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <nav className="site-shell-mobile-nav" aria-label="Site">
          {items.map((item) => renderNavLink(item, 'site-shell-mobile-nav-link', closeMobile))}
          <a
            className="site-shell-mobile-nav-link site-shell-nav-external"
            href={studioHref}
            aria-label="Studio (opens AppEndO Studio)"
            onClick={closeMobile}
          >
            Studio
            <span className="site-shell-nav-external-mark" aria-hidden="true">↗</span>
          </a>
        </nav>
        <SiteLink className="site-shell-mobile-cta" to={ctaHref} onClick={closeMobile}>
          {ctaLabel}
        </SiteLink>
      </div>
    </div>
  );
};
