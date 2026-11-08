import type { FeedbackMetadata } from '../../shared/api/contracts/feedback/types';
import { parseWorkspaceOverlayFromSearchParams } from '../../shared/routing/workspaceOverlayDeepLink';

export type FeedbackSubmitContext = {
  pageKey: string | null;
  route: string | null;
  sourcePath: string;
  metadata: FeedbackMetadata;
};

const stripPathPrefix = (pathname: string, pathPrefix: string): string => {
  if (!pathPrefix) {
    return pathname || '/';
  }
  if (pathname.startsWith(pathPrefix)) {
    const rest = pathname.slice(pathPrefix.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname || '/';
};

/**
 * Captures where feedback was opened from (page, URL, overlay token) for operators.
 * `sourcePath` is a single human-readable line stored in metadata; `route` keeps path + query + hash.
 */
export function resolveFeedbackSubmitContext(options: {
  pageKey?: string | null;
  pathPrefix?: string;
}): FeedbackSubmitContext {
  const pageKey = options.pageKey?.trim() || null;
  const pathPrefix = options.pathPrefix ?? '';

  if (typeof window === 'undefined') {
    return {
      pageKey,
      route: null,
      sourcePath: pageKey ? `page=${pageKey}` : '',
      metadata: { sourcePath: pageKey ? `page=${pageKey}` : undefined },
    };
  }

  const pathname = stripPathPrefix(window.location.pathname, pathPrefix);
  const search = window.location.search;
  const hash = window.location.hash;
  const overlay = parseWorkspaceOverlayFromSearchParams(new URLSearchParams(search));
  const route = `${pathname}${search || ''}${hash || ''}`;

  const segments: string[] = [];
  if (pageKey) {
    segments.push(`page=${pageKey}`);
  }
  if (overlay) {
    segments.push(`overlay=${overlay}`);
  }
  segments.push(`route=${route}`);

  const sourcePath = segments.join(' · ');

  return {
    pageKey,
    route,
    sourcePath,
    metadata: {
      sourcePath,
      overlay: overlay ?? undefined,
      pathname,
      search: search || undefined,
      hash: hash || undefined,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    },
  };
}
