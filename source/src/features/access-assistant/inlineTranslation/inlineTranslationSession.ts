const LEGACY_ACTIVE_STORAGE_KEY = 'appendo:inline-translation-active';

/** Drop stale persisted “mode on” flags from earlier builds (mode is in-memory only now). */
export function clearLegacyInlineTranslationSessionFlags(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(LEGACY_ACTIVE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
