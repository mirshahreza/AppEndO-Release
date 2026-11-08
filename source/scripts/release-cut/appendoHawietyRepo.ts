/** Private Hawiety deploy snapshot repository (separate from public AppEndO-Release). */
export const APPENDO_HAWIETY_REPO_NAME = 'AppEndO-Hawiety';

/** Local staging only — never commit in private monorepo. */
export function appendoHawietyStagingDir(repoRoot: string, platformVersion: string): string {
  return `${repoRoot}/.appendo-hawiety-staging/v${platformVersion}`;
}

/**
 * Default clone path: sibling e.g. C:\Workspace\Projects\AppEndO-Hawiety
 * Override with APPENDO_HAWIETY_REPO_PATH.
 */
export function resolveAppEndOHawietyClonePath(repoRoot: string): string {
  const override = process.env.APPENDO_HAWIETY_REPO_PATH?.trim();
  if (override) return override;
  return `${repoRoot}/../${APPENDO_HAWIETY_REPO_NAME}`;
}
