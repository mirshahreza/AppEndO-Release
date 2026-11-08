/** Persisted last-open Properties accordion section (survives panel close/remount). */

export const LIVE_DESIGNER_PROPERTIES_SECTION_IDS = [
  'content',
  'living-body',
  'living-paging',
  'living-columns',
  'living-dialogs',
  'living-toolbar',
  'living-records',
  'living-apis',
  'style',
  'behavior',
  'visibility',
  'data-region',
  'data-grid',
  'data-repeater',
  'data-chart',
  'data-viz',
  'data-dual-mode',
  'advanced',
  'node-binding',
  'access-control',
  'data-resources',
  'global-store',
  'binding-definitions',
  'dashboard-domain',
  'dashboard-widget',
  'shell-layout',
] as const;

export type LiveDesignerPropertiesSectionId =
  (typeof LIVE_DESIGNER_PROPERTIES_SECTION_IDS)[number];

export type LiveDesignerPropertiesAccordionPrefs = {
  /** Last open section while a node is selected. */
  nodeSection: LiveDesignerPropertiesSectionId | null;
  /** Last open section while no node is selected (document panels). */
  documentSection: LiveDesignerPropertiesSectionId | null;
};

const STORAGE_KEY = 'appendo:live-designer:properties-accordion:v1';

const SECTION_ID_SET = new Set<string>(LIVE_DESIGNER_PROPERTIES_SECTION_IDS);

const isSectionId = (value: unknown): value is LiveDesignerPropertiesSectionId =>
  typeof value === 'string' && SECTION_ID_SET.has(value);

export const DEFAULT_LIVE_DESIGNER_PROPERTIES_ACCORDION_PREFS:
  LiveDesignerPropertiesAccordionPrefs = {
    nodeSection: null,
    documentSection: null,
  };

export const sanitizeLiveDesignerPropertiesAccordionPrefs = (
  value: unknown,
): LiveDesignerPropertiesAccordionPrefs => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_LIVE_DESIGNER_PROPERTIES_ACCORDION_PREFS };
  }
  const record = value as Record<string, unknown>;
  return {
    nodeSection: isSectionId(record.nodeSection) ? record.nodeSection : null,
    documentSection: isSectionId(record.documentSection) ? record.documentSection : null,
  };
};

export const readLiveDesignerPropertiesAccordionPrefs = ():
  LiveDesignerPropertiesAccordionPrefs => {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_LIVE_DESIGNER_PROPERTIES_ACCORDION_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_LIVE_DESIGNER_PROPERTIES_ACCORDION_PREFS };
    }
    return sanitizeLiveDesignerPropertiesAccordionPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LIVE_DESIGNER_PROPERTIES_ACCORDION_PREFS };
  }
};

export const writeLiveDesignerPropertiesAccordionPrefs = (
  prefs: LiveDesignerPropertiesAccordionPrefs,
): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sanitizeLiveDesignerPropertiesAccordionPrefs(prefs)),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
};

export const rememberLiveDesignerPropertiesSection = (
  scope: 'node' | 'document',
  sectionId: LiveDesignerPropertiesSectionId,
): void => {
  const current = readLiveDesignerPropertiesAccordionPrefs();
  writeLiveDesignerPropertiesAccordionPrefs({
    ...current,
    ...(scope === 'node'
      ? { nodeSection: sectionId }
      : { documentSection: sectionId }),
  });
};
