/** Public OSS release repository (separate from private AppEndO monorepo). */
export const APPENDO_RELEASE_REPO_NAME = 'AppEndO-Release';

/** Local staging only — never commit in private monorepo. */
export function appendoReleaseStagingDir(repoRoot: string, platformVersion: string): string {
  return `${repoRoot}/.appendo-release-staging/v${platformVersion}`;
}

/**
 * Default clone path: sibling directory e.g. C:\Workspace\Projects\AppEndO-Release
 * Override with APPENDO_RELEASE_REPO_PATH.
 */
export function resolveAppEndOReleaseClonePath(repoRoot: string): string {
  const override = process.env.APPENDO_RELEASE_REPO_PATH?.trim();
  if (override) return override;
  return `${repoRoot}/../${APPENDO_RELEASE_REPO_NAME}`;
}
