/** Precompiled Hawiety (and other) package page modules ship this banner — server serves them without re-bundling. */
export const PACKAGE_UI_PREBUILT_BANNER = '/* appendo-package-ui-prebuilt:v1 */';

export function wrapPackageUiPrebuiltModule(code: string): string {
  return `${PACKAGE_UI_PREBUILT_BANNER}\n${code.trimStart()}`;
}

export function unwrapPackageUiPrebuiltModule(source: string): string | null {
  if (!source.startsWith(PACKAGE_UI_PREBUILT_BANNER)) {
    return null;
  }
  return source.slice(PACKAGE_UI_PREBUILT_BANNER.length).trimStart();
}
