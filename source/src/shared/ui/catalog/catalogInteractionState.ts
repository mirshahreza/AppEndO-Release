export type CatalogInteractionState = 'default' | 'hover' | 'active';

export const CATALOG_INTERACTION_STATES: readonly CatalogInteractionState[] = [
  'default',
  'hover',
  'active',
] as const;

/** Clickable member-face chrome (directory grid, dossier link, admin face). */
export const CATALOG_INTERACTION_MARKER_FACE = 'vx-catalog-interactive-face';

/** Sky inline text links (electoral path, targhin view-full). */
export const CATALOG_INTERACTION_MARKER_TEXT_LINK = 'vx-catalog-interactive-text-link';

/** Primary-toned inline links (targhin nego thread). */
export const CATALOG_INTERACTION_MARKER_TEXT_LINK_PRIMARY = 'vx-catalog-interactive-text-link-primary';

/** Legacy filter row clear (×) controls. */
export const CATALOG_INTERACTION_MARKER_FILTER_CLEAR = 'vx-catalog-interactive-filter-clear';

/** Soft AppButton chips (toolbar toggles). */
export const CATALOG_INTERACTION_MARKER_APP_BUTTON = 'vx-catalog-interactive-app-button';

export type CatalogInteractionProfile =
  | 'none'
  | 'face-subtle'
  | 'text-link-sky'
  | 'text-link-primary'
  | 'vx-mixed-links'
  | 'app-button-soft-cyan'
  | 'app-button-soft-indigo'
  | 'filter-clear-icon'
  /** Living catalog — lane chrome only; specimen has no forced hover/active paint. */
  | 'specimen-static';

export type CatalogInteractionPreviewProps = {
  catalogPreviewState?: CatalogInteractionState;
};
