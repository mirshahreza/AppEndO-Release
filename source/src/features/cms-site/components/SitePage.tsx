import React from 'react';
import '../../../shared/ui/site-shell.css';
import { useLocation } from 'react-router-dom';
import { AppRouteLoading } from '../../../components/AppRouteLoading';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { SiteLink } from '../../../layouts/siteShell/SiteLink';
import { buildSiteHref, readSiteSlugFromPathname } from '../../../layouts/siteShell/siteNav';
import { useCmsPublicContentQuery } from '../../../shared/api/queries/cms-site';
import {
  CmsSiteBody,
  formatSiteDate,
  languageLabel,
  storyKicker,
} from './CmsSiteBody';
import { SiteContactForm } from './SiteContactForm';
import { SiteTags } from './SiteTags';
import { SiteScreenshotGallery } from './SiteScreenshotGallery';
import { useCmsPublicLanguage, useCmsPublicSite } from '../hooks/useCmsPublicSite';

export const SitePage: React.FC<{ slug?: string }> = ({ slug: slugProp }) => {
  const culture = useOptionalCulture();
  const cultureId = culture?.cultureId || 'us';
  const { pathname } = useLocation();
  const language = useCmsPublicLanguage();
  const slug = (slugProp ?? readSiteSlugFromPathname(pathname, cultureId)).trim();
  const homeHref = buildSiteHref(cultureId, { path: '' });
  const siteQuery = useCmsPublicSite();
  const itemQuery = useCmsPublicContentQuery(slug || undefined, language);

  if (!slug) {
    return (
      <div className="site-home-wrap site-band" style={{ textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="site-lead">That page is not published on this site.</p>
        <SiteLink className="site-store" to={homeHref}>Back to home</SiteLink>
      </div>
    );
  }

  if (itemQuery.isLoading) {
    return <AppRouteLoading variant="embedded" label="Loading page" />;
  }

  const story = itemQuery.data;
  if (!story) {
    return (
      <div className="site-home-wrap site-band" style={{ textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="site-lead">That page is not published on this site.</p>
        <SiteLink className="site-store" to={homeHref}>Back to home</SiteLink>
      </div>
    );
  }

  const date = formatSiteDate(story.publishedAt);
  const isContactPage = story.slug === 'contact';
  const related = (story.related?.length
    ? story.related
    : (siteQuery.data?.home.stories ?? []).filter((item) => item.slug !== story.slug).slice(0, 5)
  );
  const comments = story.comments ?? [];

  return (
    <article className="site-page">
      <div className="site-home-wrap site-band">
        <nav className="site-crumbs" aria-label="Breadcrumb">
          <SiteLink to={homeHref}>Home</SiteLink>
          <span aria-hidden="true">/</span>
          <span>{story.title}</span>
        </nav>
        <p className="site-kicker">
          {storyKicker(story.contentType)}
          {` · ${languageLabel(story.language)}`}
          {date ? ` · ${date}` : ''}
          {story.authorDisplayName ? ` · ${story.authorDisplayName}` : ''}
        </p>
        <h1>{story.title}</h1>
        {story.seoTitle && story.seoTitle !== story.title ? (
          <p className="site-seo-line">Listed as {story.seoTitle}</p>
        ) : null}
        {story.summary ? <p className="site-lead">{story.summary}</p> : null}
        {story.seoNote ? <p className="site-seo-note">{story.seoNote}</p> : null}
        <SiteTags tags={story.tags ?? []} cultureId={cultureId} />
        {story.imageUrls && story.imageUrls.length > 0 ? (
          <SiteScreenshotGallery
            urls={story.imageUrls}
            alt={story.title}
          />
        ) : null}
        {isContactPage ? (
          <div className="site-contact">
            <div className="site-page-body">
              <CmsSiteBody content={story} />
            </div>
            <SiteContactForm fallbackEmail={siteQuery.data?.chrome.contactEmail || undefined} />
          </div>
        ) : (
          <div className="site-page-body">
            <CmsSiteBody content={story} />
          </div>
        )}
        {!isContactPage && related.length > 0 ? (
          <aside className="site-link-block" style={{ marginTop: '3rem' }}>
            <p className="site-kicker">Related</p>
            <ul className="site-link-list">
              {related.map((item) => (
                <li key={item.slug}>
                  <SiteLink
                    className="site-link-row"
                    to={buildSiteHref(cultureId, { path: item.slug })}
                  >
                    <span>
                      <span className="site-link-row-kicker">{storyKicker(item.contentType)}</span>
                      <strong>{item.title}</strong>
                      {item.summary ? <em>{item.summary}</em> : null}
                    </span>
                    <span className="site-link-row-arrow" aria-hidden="true">→</span>
                  </SiteLink>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
        {story.commentsEnabled || comments.length > 0 ? (
          <section className="site-comments" aria-label="Comments">
            <p className="site-kicker">Comments</p>
            <h2>From readers</h2>
            {comments.length === 0 ? (
              <p className="site-lead">Comments are open. None are published yet.</p>
            ) : (
              <ul className="site-comment-list">
                {comments.map((comment) => (
                  <li key={comment.id} className="site-comment">
                    <p className="site-kicker">
                      {comment.authorDisplayName || 'Reader'}
                      {formatSiteDate(comment.publishedAt) ? ` · ${formatSiteDate(comment.publishedAt)}` : ''}
                    </p>
                    {comment.title ? <h3>{comment.title}</h3> : null}
                    <p>{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        <p className="site-page-back">
          <SiteLink className="site-text-link" to={homeHref}>Back to home</SiteLink>
        </p>
      </div>
    </article>
  );
};
