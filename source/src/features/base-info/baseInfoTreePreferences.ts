const BASE_INFO_EXPANDED_STORAGE_KEY = 'appendo.base-info.expanded-by-id';

const compactExpandedById = (expandedById: Record<string, boolean>): Record<string, boolean> => {
  const next: Record<string, boolean> = {};
  for (const [id, isExpanded] of Object.entries(expandedById)) {
    if (isExpanded) next[id] = true;
  }
  return next;
};

export const readStoredBaseInfoExpandedById = (): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(BASE_INFO_EXPANDED_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const next: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === true) next[id] = true;
    }
    return next;
  } catch {
    return {};
  }
};

export const persistBaseInfoExpandedById = (expandedById: Record<string, boolean>): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      BASE_INFO_EXPANDED_STORAGE_KEY,
      JSON.stringify(compactExpandedById(expandedById)),
    );
  } catch {
    // ignore quota / privacy errors
  }
};
