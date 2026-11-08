/**
 * Property accordion groups for a catalog option.
 * Owned by the Base Components catalog — Designer reads this, it does not invent groups.
 */
export const CRUD_SET_CONFIG_GROUP_TITLES = [
  'Body',
  'Paging',
  'Columns',
  'Dialogs',
  'Toolbar',
  'Records chrome',
  'APIs',
] as const;

export type CrudSetConfigGroupTitle = (typeof CRUD_SET_CONFIG_GROUP_TITLES)[number];

/**
 * Living-sample FormSection titles for catalog axes.
 * Shared properties (size, height, variant, disabled, …) always land here
 * unless a composite family (CRUD Set, Dialog, Side panel) overrides.
 */
export const CATALOG_AXIS_GROUP_TITLES = {
  preset: 'Preset',
  content: 'Content',
  behavior: 'Behavior',
  layout: 'Layout',
  appearance: 'Appearance',
  state: 'State',
  responsive: 'Responsive',
  accessibility: 'Accessibility',
  data: 'Data',
} as const;

export type CatalogAxisGroupKey = keyof typeof CATALOG_AXIS_GROUP_TITLES;

const humanizeCatalogToken = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (character) => character.toUpperCase());

/**
 * Composite-only families that keep a dedicated inspector section.
 * Do not list shared tokens (size, height, variant, …) here.
 */
export const COMPOSITE_INSPECTOR_FAMILIES: Record<string, string> = {
  listBody: 'Body',
  grid: 'Body',
  kanban: 'Body',
  actions: 'Body',
  pagination: 'Paging',
  paging: 'Paging',
  sorting: 'Paging',
  dialogs: 'Dialogs',
  filterBar: 'Toolbar',
  refresh: 'Toolbar',
  export: 'Toolbar',
  exportFormats: 'Toolbar',
  defaultFormat: 'Toolbar',
  listApi: 'APIs',
  readOneApi: 'APIs',
  createCount: 'APIs',
  contentPatch: 'APIs',
  openEditFromTitle: 'APIs',
  purposePatch: 'APIs',
  toggleConfirm: 'APIs',
  delete: 'APIs',
  mode: 'Form',
  formSize: 'Form',
  showHeader: 'Dialog',
  subHeaderCount: 'Dialog',
  showFooter: 'Dialog',
  subFooterCount: 'Dialog',
  sidePanelPlacement: 'Side panel',
  sidePanelPinnable: 'Side panel',
  sidePanelSplitter: 'Side panel',
  sidePanelBackground: 'Side panel',
  sidePanelBackgroundColor: 'Side panel',
  sidePanelShowTitle: 'Side panel',
  sidePanelTitle: 'Side panel',
  sidePanelTitleInHeader: 'Side panel',
};

/**
 * Leaf prop names that must share one group across every component.
 * Axis is preferred when provided; this map covers calls that only have the option id.
 */
export const SHARED_PROP_GROUP: Record<string, string> = {
  size: 'Layout',
  height: 'Layout',
  heightMode: 'Layout',
  minHeight: 'Layout',
  maxHeight: 'Layout',
  width: 'Layout',
  minWidth: 'Layout',
  maxWidth: 'Layout',
  fill: 'Layout',
  gap: 'Layout',
  density: 'Layout',
  orientation: 'Layout',
  placement: 'Layout',
  alignment: 'Layout',
  edge: 'Layout',
  columnCount: 'Layout',
  ratio: 'Layout',
  offset: 'Layout',
  columnWidth: 'Layout',
  variant: 'Appearance',
  tone: 'Appearance',
  color: 'Appearance',
  surface: 'Appearance',
  depth: 'Appearance',
  presentation: 'Appearance',
  backdrop: 'Appearance',
  backdropTint: 'Appearance',
  backdropBlur: 'Appearance',
  backdropTransparency: 'Appearance',
  disabled: 'State',
  isDisabled: 'State',
  invalid: 'State',
  state: 'State',
};

export const resolveCatalogInspectorGroup = (
  optionId: string,
  explicit?: string,
  axis?: string,
): string => {
  if (explicit && explicit.trim().length > 0) {
    return explicit;
  }
  const segments = optionId.split('.');
  const family = segments[1] ?? optionId;
  const leaf = segments.at(-1) ?? optionId;
  if (COMPOSITE_INSPECTOR_FAMILIES[family]) {
    return COMPOSITE_INSPECTOR_FAMILIES[family];
  }
  if (SHARED_PROP_GROUP[leaf]) {
    return SHARED_PROP_GROUP[leaf];
  }
  if (SHARED_PROP_GROUP[family]) {
    return SHARED_PROP_GROUP[family];
  }
  if (axis && axis in CATALOG_AXIS_GROUP_TITLES) {
    return CATALOG_AXIS_GROUP_TITLES[axis as CatalogAxisGroupKey];
  }
  return humanizeCatalogToken(family);
};
