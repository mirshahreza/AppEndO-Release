import React from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../../shared/ui/site-shell.css';
import { AppRouteLoading } from '../../../components/AppRouteLoading';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { SiteLink } from '../../../layouts/siteShell/SiteLink';
import { buildSiteHref, siteNavLabel } from '../../../layouts/siteShell/siteNav';
import type { CmsPublicContent } from '../../../shared/api/contracts/cms-site/types';
import {
  CmsSiteBody,
  formatSiteDate,
  storyKicker,
} from './CmsSiteBody';
import { SiteSlides } from './SiteSlides';
import { SiteSystemDiagram } from './SiteSystemDiagram';
import { SiteTags } from './SiteTags';
import { SiteScreenshotGallery } from './SiteScreenshotGallery';
import { SiteWindowPlaceholder } from './SiteWindowFrame';
import { useCmsPublicSite } from '../hooks/useCmsPublicSite';

const SiteStoryCard: React.FC<{
  item: CmsPublicContent;
  href: string;
  cultureId: string;
  featured?: boolean;
}> = ({ item, href, cultureId, featured = false }) => {
  const date = formatSiteDate(item.publishedAt);
  const ratio = featured ? '16 / 8' : '16 / 10';
  return (
    <article className={featured ? 'site-story-card is-featured' : 'site-story-card'}>
      {item.coverImageUrl ? (
        <SiteScreenshotGallery
          urls={[item.coverImageUrl]}
          alt={item.title}
          variant="sm"
          ratio={ratio}
          className="site-story-card-media"
        />
      ) : (
        <SiteLink to={href} className="site-story-card-media" tabIndex={-1}>
          <SiteWindowPlaceholder variant="sm" ratio={ratio} />
        </SiteLink>
      )}
      <p className="site-kicker">
        {storyKicker(item.contentType)}
        {date ? ` · ${date}` : ''}
        {item.authorDisplayName ? ` · ${item.authorDisplayName}` : ''}
      </p>
      <h3>
        <SiteLink to={href}>{item.title}</SiteLink>
      </h3>
      {item.summary ? <p>{item.summary}</p> : null}
      <SiteTags tags={item.tags ?? []} cultureId={cultureId} />
      <SiteLink className="site-text-link" to={href}>
        Read guide
      </SiteLink>
    </article>
  );
};

export const SiteHome: React.FC = () => {
  const culture = useOptionalCulture();
  const cultureId = culture?.cultureId || 'us';
  const [searchParams] = useSearchParams();
  const activeTag = searchParams.get('tag')?.trim() || '';
  const { data, isLoading, isError } = useCmsPublicSite();

  if (isLoading) {
    return <AppRouteLoading variant="embedded" label="Loading site" />;
  }

  const home = data?.home;
  const chrome = data?.chrome;
  const hero = home?.hero;
  const about = home?.about;
  const contact = home?.contact;
  const slides = (home?.slides ?? []).map((slide, index) => ({
    index: slide.summary || `${String(index + 1).padStart(2, '0')}`,
    title: slide.title,
    copy: slide.body || slide.summary,
    imageUrl: slide.coverImageUrl,
  }));
  const stories = (home?.stories ?? []).filter((item) => (
    !activeTag || (item.tags ?? []).some((tag) => tag.slug === activeTag)
  ));
  const featured = activeTag ? null : (stories[0] ?? null);
  const moreCards = activeTag ? stories.slice(0, 4) : stories.slice(1, 3);
  const linkStories = activeTag
    ? stories.slice(4)
    : stories.slice(featured && moreCards.length > 0 ? 3 : 1);
  const tagCloud = data?.home.tagCloud ?? [];
  const contactHref = buildSiteHref(cultureId, { path: contact?.slug || 'contact' });
  const aboutHref = about ? buildSiteHref(cultureId, { path: about.slug }) : '';
  const guideHref = buildSiteHref(cultureId, { path: 'guide' });
  const hasGuide = (chrome?.nav ?? []).some((item) => item.slug === 'guide');

  if (isError || (!hero && stories.length === 0 && slides.length === 0)) {
    return (
      <div className="site-home-wrap site-band">
        <p className="site-kicker">Public site</p>
        <h1>Content is not published yet.</h1>
        <p className="site-lead">
          Publish pages and fragments in CMS Contents. Home, About, Contact, and
          the site mark load from the database.
        </p>
      </div>
    );
  }

  return (
    <div className="site-home">
      <section className="site-home-wrap site-hero">
        <div>
          <p className="site-kicker">{hero?.authorDisplayName || 'Public site'}</p>
          <h1>{hero?.title || chrome?.brandName || 'Home'}</h1>
          {hero?.summary ? <p className="site-lead">{hero.summary}</p> : null}
          {hero ? <CmsSiteBody content={hero} /> : null}
          <div className="site-hero-actions">
            <SiteLink className="site-store" to={contactHref}>
              {chrome?.ctaLabel || 'Contact'}
            </SiteLink>
            {hasGuide ? (
              <SiteLink className="site-store site-store-ghost" to={guideHref}>
                Guide
              </SiteLink>
            ) : null}
            {about ? (
              <SiteLink className="site-store site-store-ghost" to={aboutHref}>
                {siteNavLabel(about.slug, about.title)}
              </SiteLink>
            ) : null}
          </div>
        </div>
        {slides.length > 0 ? <SiteSlides slides={slides} /> : null}
      </section>

      <section className="site-home-wrap site-band">
        <p className="site-kicker">How it fits together</p>
        <h2>One control plane, five connected surfaces.</h2>
        <p className="site-lead">
          Studio configures the system. Data models and publishes APIs. Workflows orchestrate
          the work. Functions run sandboxed code. Portals surface all of it to people who never
          open Studio.
        </p>
        <SiteSystemDiagram className="site-home-diagram" />
      </section>

      {about ? (
        <section id="about" className="site-home-wrap site-band site-split">
          <div>
            <p className="site-kicker">About</p>
            <h2>{about.title}</h2>
          </div>
          <div>
            {about.summary ? <p className="site-lead">{about.summary}</p> : null}
            <div className="site-clamp">
              <CmsSiteBody content={about} />
            </div>
            <SiteLink className="site-text-link" to={aboutHref}>
              Continue to About
            </SiteLink>
          </div>
        </section>
      ) : null}

      {stories.length > 0 ? (
        <section id="work" className="site-home-wrap site-band">
          <p className="site-kicker">Latest</p>
          <h2>
            {activeTag
              ? `Notes tagged ${tagCloud.find((tag) => tag.slug === activeTag)?.title || activeTag}`
              : 'Platform guides'}
          </h2>
          <p className="site-lead">
            Every Studio surface, explained with annotated screenshots. Click a picture to view it full size. The Guide in the top nav is the table of contents.
          </p>
          {tagCloud.length > 0 ? (
            <SiteTags tags={tagCloud} cultureId={cultureId} activeSlug={activeTag} cloud />
          ) : null}
          {activeTag ? (
            <SiteLink className="site-text-link" to={buildSiteHref(cultureId, { path: '' })}>
              Clear tag
            </SiteLink>
          ) : null}
          <div className="site-story-board">
            {featured ? (
              <SiteStoryCard
                item={featured}
                href={buildSiteHref(cultureId, { path: featured.slug })}
                cultureId={cultureId}
                featured
              />
            ) : null}
            {moreCards.length > 0 ? (
              <div className="site-story-grid">
                {moreCards.map((item) => (
                  <SiteStoryCard
                    key={item.id || item.slug}
                    item={item}
                    href={buildSiteHref(cultureId, { path: item.slug })}
                    cultureId={cultureId}
                  />
                ))}
              </div>
            ) : null}
            {linkStories.length > 0 ? (
              <div className="site-link-block">
                <p className="site-kicker">More to read</p>
                <ul className="site-link-list">
                  {linkStories.map((item) => {
                    const href = buildSiteHref(cultureId, { path: item.slug });
                    const date = formatSiteDate(item.publishedAt);
                    return (
                      <li key={item.id || item.slug}>
                        <SiteLink className="site-link-row" to={href}>
                          <span>
                            <span className="site-link-row-kicker">
                              {storyKicker(item.contentType)}
                              {date ? ` · ${date}` : ''}
                            </span>
                            <strong>{item.title}</strong>
                            {item.summary ? <em>{item.summary}</em> : null}
                          </span>
                          <span className="site-link-row-arrow" aria-hidden="true">→</span>
                        </SiteLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {contact ? (
        <section className="site-home-wrap site-band">
          <div className="site-contact-teaser">
            <div>
              <p className="site-kicker">Contact</p>
              <h2>{contact.title}</h2>
              {contact.summary ? <p className="site-lead">{contact.summary}</p> : null}
            </div>
            <SiteLink className="site-store" to={contactHref}>
              Open the contact page
            </SiteLink>
          </div>
        </section>
      ) : null}
    </div>
  );
};
