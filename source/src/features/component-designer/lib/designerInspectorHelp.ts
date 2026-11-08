/** CD-N02 — contextual inspector help (links to CD-A03 how-to paths). */

export type DesignerInspectorHelpEntry = {
  tooltip: string;
  href: string;
};

const HOW_TO_BASE = '/docs/how-to';

export const DESIGNER_INSPECTOR_FIELD_HELP: Record<string, DesignerInspectorHelpEntry> = {
  navigationRef: {
    tooltip: 'Menu manifest id — links this nav region to platform-registry navigation JSON.',
    href: `${HOW_TO_BASE}/how-to-configure-shell-navigation.md`,
  },
  layoutGridColumnWidths: {
    tooltip: 'Per-column width tokens (% / px / fr) for layout grid rows.',
    href: `${HOW_TO_BASE}/how-to-customize-layout-grid-columns.md`,
  },
  dataSourceRef: {
    tooltip: 'Shared data source key used by regions, grids, and load bindings.',
    href: `${HOW_TO_BASE}/how-to-bind-component-data.md`,
  },
  endpointRef: {
    tooltip: 'Registered API endpoint reference for fetch or mutation bindings.',
    href: `${HOW_TO_BASE}/how-to-connect-api-binding.md`,
  },
  fetchEndpoint: {
    tooltip: 'Direct API path for this binding when no endpointRef is set.',
    href: `${HOW_TO_BASE}/how-to-connect-api-binding.md`,
  },
  lovRef: {
    tooltip: 'List-of-values registry key for dropdown options.',
    href: `${HOW_TO_BASE}/how-to-bind-component-data.md`,
  },
  logoSrc: {
    tooltip: 'Logo image URL — prefer /assets/workspace/… paths from Asset Manager.',
    href: `${HOW_TO_BASE}/how-to-customize-shell-logo.md`,
  },
};

export const DESIGNER_INSPECTOR_SECTION_HELP: Record<string, DesignerInspectorHelpEntry> = {
  'shell-chrome': {
    tooltip: 'Shell chrome regions (header, sidebar, logo) for portal layouts.',
    href: `${HOW_TO_BASE}/how-to-design-app-shell.md`,
  },
  'node-binding': {
    tooltip: 'Per-node binding AST — prefer fx toggles on fields when possible.',
    href: `${HOW_TO_BASE}/how-to-bind-component-data.md`,
  },
  'binding-definitions': {
    tooltip: 'Document-level binding definitions shared across the component.',
    href: `${HOW_TO_BASE}/how-to-bind-component-data.md`,
  },
  'data-region': {
    tooltip: 'Data region loads records and wires child inputs automatically.',
    href: `${HOW_TO_BASE}/how-to-bind-component-data.md`,
  },
};

export const resolveInspectorFieldHelp = (fieldKey: string): DesignerInspectorHelpEntry | null =>
  DESIGNER_INSPECTOR_FIELD_HELP[fieldKey] ?? null;

export const resolveInspectorSectionHelp = (sectionId: string): DesignerInspectorHelpEntry | null =>
  DESIGNER_INSPECTOR_SECTION_HELP[sectionId] ?? null;
