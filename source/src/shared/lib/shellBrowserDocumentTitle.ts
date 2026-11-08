export const SHELL_BOOT_DOCUMENT_TITLE_SUFFIX = ' ...';

/** Browser tab while the active page label is not resolved yet. */
export function formatShellBootDocumentTitle(portalWindowTitle?: string | null): string {
  const windowTitle = portalWindowTitle?.trim();
  if (!windowTitle) {
    return SHELL_BOOT_DOCUMENT_TITLE_SUFFIX.trim();
  }
  return `${windowTitle}${SHELL_BOOT_DOCUMENT_TITLE_SUFFIX}`;
}
