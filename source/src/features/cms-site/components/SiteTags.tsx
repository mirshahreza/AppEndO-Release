import React from 'react';
import { SiteLink } from '../../../layouts/siteShell/SiteLink';
import { buildSiteHref } from '../../../layouts/siteShell/siteNav';
import type { CmsPublicTag } from '../../../shared/api/contracts/cms-site/types';

type SiteTagsProps = {
  tags: readonly CmsPublicTag[];
  cultureId: string;
  activeSlug?: string;
  cloud?: boolean;
};

export const SiteTags: React.FC<SiteTagsProps> = ({
  tags,
  cultureId,
  activeSlug,
  cloud = false,
}) => {
  if (tags.length === 0) {
    return null;
  }
  const home = buildSiteHref(cultureId, { path: '' });
  const max = Math.max(...tags.map((tag) => tag.count || 1), 1);
  return (
    <ul className={cloud ? 'site-tag-cloud' : 'site-tag-list'} aria-label={cloud ? 'Tag cloud' : 'Tags'}>
      {tags.map((tag) => {
        const href = `${home}?tag=${encodeURIComponent(tag.slug)}`;
        const weight = cloud ? Math.max(0.85, (tag.count || 1) / max) : 1;
        return (
          <li key={tag.slug}>
            <SiteLink
              className="site-tag"
              to={href}
              data-active={activeSlug === tag.slug ? 'true' : 'false'}
              style={cloud ? { fontSize: `${0.85 + weight * 0.55}rem` } : undefined}
            >
              {tag.title}
              {cloud && tag.count > 1 ? <span> {tag.count}</span> : null}
            </SiteLink>
          </li>
        );
      })}
    </ul>
  );
};
