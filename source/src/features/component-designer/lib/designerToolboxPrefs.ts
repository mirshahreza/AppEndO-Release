import {
  DESIGNER_TOOLBOX_GROUPS,
  type DesignerToolboxGroup,
} from '../utils/designerToolboxGroups';

/** Pseudo-section id for the Gutenberg-style Recently Used accordion (Phase 10). */
export const TOOLBOX_RECENTLY_USED_ID = 'recently-used' as const;

export type DesignerToolboxExpandableId =
  | DesignerToolboxGroup
  | typeof TOOLBOX_RECENTLY_USED_ID;

export const TOOLBOX_RECENTLY_USED_LABEL = 'Recently Used';

/** Max recently-used palette item ids retained in localStorage (Phase 10 — N not fixed in the plan). */
export const TOOLBOX_RECENTLY_USED_MAX = 12;

/**
 * New-user default: Recently Used + two high-traffic groups (layout + forms),
 * instead of a single hardcoded layout accordion (audit §2.2 / Phase 10).
 */
export const TOOLBOX_DEFAULT_EXPANDED_SECTIONS: readonly DesignerToolboxExpandableId[] = [
  TOOLBOX_RECENTLY_USED_ID,
  'layout',
  'form-fields',
] as const;

const STORAGE_KEY_PREFIX = 'appendo:designer:toolbox-prefs:';

export type DesignerToolboxPrefs = {
  expandedSections: DesignerToolboxExpandableId[];
  recentlyUsedItemIds: string[];
};

const VALID_EXPANDABLE = new Set<string>([
  TOOLBOX_RECENTLY_USED_ID,
  ...DESIGNER_TOOLBOX_GROUPS,
]);

export const getDesignerToolboxPrefsStorageKey = (userKey: string): string =>
  `${STORAGE_KEY_PREFIX}${userKey.trim() || 'anonymous'}`;

const normalizeExpandableId = (value: unknown): DesignerToolboxExpandableId | null => {
  if (typeof value !== 'string' || !VALID_EXPANDABLE.has(value)) {
    return null;
  }
  return value as DesignerToolboxExpandableId;
};

export const normalizeDesignerToolboxPrefs = (raw: unknown): DesignerToolboxPrefs | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const expandedRaw = Array.isArray(record.expandedSections) ? record.expandedSections : null;
  const recentRaw = Array.isArray(record.recentlyUsedItemIds) ? record.recentlyUsedItemIds : null;
  if (!expandedRaw || !recentRaw) {
    return null;
  }

  const expandedSections: DesignerToolboxExpandableId[] = [];
  const seenExpanded = new Set<string>();
  for (const entry of expandedRaw) {
    const id = normalizeExpandableId(entry);
    if (!id || seenExpanded.has(id)) {
      continue;
    }
    seenExpanded.add(id);
    expandedSections.push(id);
  }

  const recentlyUsedItemIds: string[] = [];
  const seenRecent = new Set<string>();
  for (const entry of recentRaw) {
    if (typeof entry !== 'string') {
      continue;
    }
    const id = entry.trim();
    if (!id || seenRecent.has(id)) {
      continue;
    }
    seenRecent.add(id);
    recentlyUsedItemIds.push(id);
    if (recentlyUsedItemIds.length >= TOOLBOX_RECENTLY_USED_MAX) {
      break;
    }
  }

  return { expandedSections, recentlyUsedItemIds };
};

export const readDesignerToolboxPrefs = (userKey: string): DesignerToolboxPrefs | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getDesignerToolboxPrefsStorageKey(userKey));
    if (!raw) {
      return null;
    }
    return normalizeDesignerToolboxPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeDesignerToolboxPrefs = (userKey: string, prefs: DesignerToolboxPrefs): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      getDesignerToolboxPrefsStorageKey(userKey),
      JSON.stringify(prefs),
    );
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};

export const resolveDesignerToolboxPrefs = (userKey: string): DesignerToolboxPrefs => {
  const stored = readDesignerToolboxPrefs(userKey);
  if (stored) {
    return stored;
  }
  return {
    expandedSections: [...TOOLBOX_DEFAULT_EXPANDED_SECTIONS],
    recentlyUsedItemIds: [],
  };
};

/** Most-recent-first; drops unknown ids; caps at TOOLBOX_RECENTLY_USED_MAX. */
export const pushRecentlyUsedItemId = (
  previousIds: readonly string[],
  itemId: string,
): string[] => {
  const trimmed = itemId.trim();
  if (!trimmed) {
    return [...previousIds];
  }
  return [trimmed, ...previousIds.filter((id) => id !== trimmed)].slice(0, TOOLBOX_RECENTLY_USED_MAX);
};

/**
 * Resolve recently-used ids against the live catalog — deleted/orphan ids are dropped
 * (Phase 10 Self-Audit: no broken Recently Used cards).
 */
export const resolveRecentlyUsedPaletteItems = <T extends { id: string }>(
  itemIds: readonly string[],
  catalogById: ReadonlyMap<string, T>,
): T[] => {
  const resolved: T[] = [];
  for (const id of itemIds) {
    const item = catalogById.get(id);
    if (item) {
      resolved.push(item);
    }
  }
  return resolved;
};
