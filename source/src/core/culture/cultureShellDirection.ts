/** `<html dir>` when CultureProvider has not mounted yet (boot splash, lazy route). */
export function readDocumentReadingDirection(): 'ltr' | 'rtl' {
  if (typeof document === 'undefined') {
    return 'ltr';
  }
  return document.documentElement.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * Admin / studio shell RTL flag — prefers culture metadata, then `<html dir>` from
 * CultureProvider or index.html first-paint bootstrap (iq/ir URLs).
 */
export function resolveCultureShellIsRtl(
  culture: { direction?: 'ltr' | 'rtl' } | null | undefined,
): boolean {
  if (culture?.direction === 'rtl') {
    return true;
  }
  if (culture?.direction === 'ltr') {
    return false;
  }
  return readDocumentReadingDirection() === 'rtl';
}
