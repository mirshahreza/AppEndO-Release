export function managedApiPathMatchesEdgeBasePath(apiPath: string, basePath: string): boolean {
  const path = apiPath.trim();
  const base = basePath.trim().replace(/\/$/, '');
  if (!path || !base) return false;
  return path === base || path.startsWith(`${base}/`);
}

export function isManagedApiCoveredByPackage(
  api: { id: string; path: string },
  input: {
    existingApis: ReadonlyArray<{ id: string; path: string }>;
    packedEdgeApiBasePaths: readonly string[];
  },
): boolean {
  if (input.existingApis.some((existing) => existing.id === api.id || existing.path === api.path)) {
    return true;
  }
  return input.packedEdgeApiBasePaths.some((basePath) => (
    managedApiPathMatchesEdgeBasePath(api.path, basePath)
  ));
}
