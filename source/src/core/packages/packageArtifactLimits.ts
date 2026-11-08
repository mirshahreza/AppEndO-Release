/** Maximum package ZIP size (schema + seed + binary record files). */
export const PACKAGE_ARTIFACT_MAX_BYTES = 512 * 1024 * 1024;
export const PACKAGE_ARTIFACT_MAX_LABEL = '512 MB';

export function packageArtifactSizeLimitError(byteLength: number): string | null {
  if (byteLength > PACKAGE_ARTIFACT_MAX_BYTES) {
    return `File exceeds ${PACKAGE_ARTIFACT_MAX_LABEL} limit.`;
  }
  return null;
}
