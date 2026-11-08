/**
 * Bookmarkable query-string overlays (floating panels + modal shells) on top of a workspace route.
 * Primary list→edit item identity stays in the path — see `docs/standards/deep-linking.md`.
 */

export const WORKSPACE_OVERLAY_QUERY_PARAM = 'overlay';

const WORKSPACE_OVERLAY_TOKEN_PATTERN = /^[\w.-]+(?:\/[\w.-]+)*$/;

export function normalizeWorkspaceOverlayToken(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  if (!WORKSPACE_OVERLAY_TOKEN_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function parseWorkspaceOverlayFromSearchParams(
  params: URLSearchParams,
): string | null {
  return normalizeWorkspaceOverlayToken(params.get(WORKSPACE_OVERLAY_QUERY_PARAM));
}

export function setWorkspaceOverlayOnSearchParams(
  params: URLSearchParams,
  token: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const normalized = normalizeWorkspaceOverlayToken(token);
  if (normalized) {
    next.set(WORKSPACE_OVERLAY_QUERY_PARAM, normalized);
  } else {
    next.delete(WORKSPACE_OVERLAY_QUERY_PARAM);
  }
  return next;
}

export function buildHrefWithWorkspaceOverlay(
  pathnameAndSearch: string,
  token: string | null,
): string {
  const url = new URL(pathnameAndSearch, 'http://local');
  const next = setWorkspaceOverlayOnSearchParams(url.searchParams, token);
  const search = next.toString();
  return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
}

export function workspaceOverlayTokenStartsWith(
  token: string,
  prefix: string,
): boolean {
  return token === prefix || token.startsWith(`${prefix}/`);
}
