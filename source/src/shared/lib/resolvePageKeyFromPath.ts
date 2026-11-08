import { STUDIO_PORTAL_SEGMENT } from '../api/contracts/platform/mountConstants';
import type { FeatureGraph } from './aiIndexCodegen';
import { loadFeatureGraph } from './featureGraphStore';

function normalizeRelativeRoutePath(relativePath: string): string {
  return relativePath.replace(/^\/+/, '').replace(/\/+$/, '');
}

function routePatternSpecificity(routePattern: string): number {
  const normalized = normalizeRelativeRoutePath(routePattern);
  return normalized.endsWith('/*') ? normalized.length - 2 : normalized.length;
}

/** Match exact route patterns and trailing splat patterns (`settings/*`). */
export function matchesRoutePattern(routePattern: string, relativePath: string): boolean {
  const normalizedPath = normalizeRelativeRoutePath(relativePath);
  const normalizedPattern = normalizeRelativeRoutePath(routePattern);

  if (normalizedPattern.endsWith('/*')) {
    const prefix = normalizedPattern.slice(0, -2);
    if (!prefix) {
      return normalizedPath.length > 0;
    }

    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }

  return normalizedPattern === normalizedPath;
}

/** Strip mount/culture prefix and return the studio-relative route remainder. */
export function extractStudioRelativePathFromPathname(pathname: string): string | null {
  const normalized = pathname.trim().replace(/\/+$/, '') || '/';
  const segments = normalized.split('/').filter(Boolean);
  const studioIndex = segments.lastIndexOf(STUDIO_PORTAL_SEGMENT);
  if (studioIndex === -1) {
    return null;
  }

  return segments.slice(studioIndex + 1).join('/');
}

export function resolvePageKeyFromRelativePath(
  relativePath: string,
  graph: FeatureGraph,
): string | undefined {
  const normalized = normalizeRelativeRoutePath(relativePath);

  const matching = graph.nodes.filter((node) =>
    matchesRoutePattern(node.routePattern, normalized),
  );

  if (matching.length === 0) {
    return undefined;
  }

  return [...matching].sort(
    (left, right) => routePatternSpecificity(right.routePattern) - routePatternSpecificity(left.routePattern),
  )[0]?.pageKey;
}

export function resolvePageKeyFromPathname(pathname: string, rootDir = process.cwd()): string | undefined {
  const relative = extractStudioRelativePathFromPathname(pathname);
  if (relative === null) {
    return undefined;
  }

  let graph: FeatureGraph;
  try {
    graph = loadFeatureGraph(rootDir);
  } catch {
    return undefined;
  }

  return resolvePageKeyFromRelativePath(relative, graph);
}
