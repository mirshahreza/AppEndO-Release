import type { BaseComponentEvidence } from './baseComponentOptionTypes';

const OBSERVED_ON = '2026-08-03' as const;

const evidence = (
  id: string,
  label: string,
  url: `https://${string}`,
  supports: readonly string[],
): BaseComponentEvidence => ({ id, label, url, observedOn: OBSERVED_ON, supports });

export const BASE_COMPONENT_EVIDENCE_REGISTRY = [
  evidence('heroui-components', 'HeroUI v3 components', 'https://heroui.com/docs/react/components', [
    'HeroUI component ownership and wrapper reuse',
  ]),
  evidence('heroui-tabs', 'HeroUI v3 Tabs', 'https://beta.heroui.com/docs/components/tabs', [
    'Tabs compound API and visual variants',
  ]),
  evidence('react-aria', 'React Aria', 'https://react-spectrum.adobe.com/react-aria/index.html', [
    'Accessible interaction primitives',
  ]),
  evidence('react-aria-tabs', 'React Aria Tabs', 'https://react-spectrum.adobe.com/Tabs', [
    'Tabs state, orientation and keyboard behavior',
  ]),
  evidence('react-aria-combobox', 'React Aria ComboBox', 'https://react-spectrum.adobe.com/react-aria/ComboBox.html', [
    'Combobox behavior and accessibility',
  ]),
  evidence('react-aria-table', 'React Aria Table', 'https://react-spectrum.adobe.com/react-aria/Table.html', [
    'Table interaction and accessibility',
  ]),
  evidence('react-aria-datepicker', 'React Aria DatePicker', 'https://react-spectrum.adobe.com/react-aria/DatePicker.html', [
    'Date and time field behavior',
  ]),
  evidence('react-aria-dropzone', 'React Aria DropZone', 'https://react-spectrum.adobe.com/react-aria/DropZone.html', [
    'File drop interaction',
  ]),
  evidence('react-aria-kanban', 'React Aria Kanban example', 'https://react-aria.adobe.com/examples/kanban', [
    'Keyboard and pointer card movement',
  ]),
  evidence('wai-aria-apg-patterns', 'WAI-ARIA APG patterns', 'https://www.w3.org/WAI/ARIA/apg/patterns/', [
    'Accessible widget pattern selection',
  ]),
  evidence('wai-aria-apg-tabs', 'WAI-ARIA APG Tabs', 'https://www.w3.org/WAI/ARIA/apg/patterns/tabs/', [
    'Tablist semantics, focus and activation',
  ]),
  evidence('wai-aria-apg-tabs-actions', 'WAI-ARIA APG Tabs with Actions', 'https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-actions/', [
    'Tabs with lifecycle actions',
  ]),
  evidence('wai-aria-apg-toolbar', 'WAI-ARIA APG Toolbar', 'https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/', [
    'Toolbar keyboard behavior',
  ]),
  evidence('wai-aria-apg-grid', 'WAI-ARIA APG Grid', 'https://www.w3.org/WAI/ARIA/apg/patterns/grid/', [
    'Grid keyboard behavior',
  ]),
  evidence('wai-aria-apg-tree-view', 'WAI-ARIA APG Tree View', 'https://www.w3.org/WAI/ARIA/apg/patterns/treeview/', [
    'Tree navigation behavior',
  ]),
  evidence('wai-aria-apg-dialog', 'WAI-ARIA APG Dialog', 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/', [
    'Modal focus and dismissal behavior',
  ]),
  evidence('radix-tabs', 'Radix Tabs', 'https://www.radix-ui.com/primitives/docs/components/tabs', [
    'Tabs API comparison',
  ]),
  evidence('radix-toolbar', 'Radix Toolbar', 'https://www.radix-ui.com/primitives/docs/components/toolbar', [
    'Toolbar API comparison',
  ]),
  evidence('radix-dropdown-menu', 'Radix Dropdown Menu', 'https://www.radix-ui.com/primitives/docs/components/dropdown-menu', [
    'Menu API comparison',
  ]),
  evidence('material-components', 'Material 3 components', 'https://m3.material.io/components', [
    'Component taxonomy comparison',
  ]),
  evidence('material-tabs', 'Material 3 Tabs', 'https://m3.material.io/components/tabs/guidelines', [
    'Tabs layout and usage guidance',
  ]),
  evidence('material-navigation-rail', 'Material 3 navigation rail', 'https://m3.material.io/components/navigation-rail/guidelines', [
    'Navigation rail behavior',
  ]),
  evidence('fluent-components', 'Fluent 2 components', 'https://fluent2.microsoft.design/components/web/react', [
    'Component taxonomy comparison',
  ]),
  evidence('fluent-tablist', 'Fluent 2 Tablist', 'https://fluent2.microsoft.design/components/web/react/core/tablist/usage', [
    'Tablist usage comparison',
  ]),
  evidence('fluent-tree', 'Fluent 2 Tree', 'https://fluent2.microsoft.design/components/web/react/core/tree/usage', [
    'Tree usage comparison',
  ]),
  evidence('carbon-tabs', 'Carbon Tabs', 'https://carbondesignsystem.com/components/tabs/usage/', [
    'Tabs responsive and usage guidance',
  ]),
  evidence('carbon-modal', 'Carbon Modal', 'https://carbondesignsystem.com/components/modal/usage/', [
    'Modal usage guidance',
  ]),
  evidence('ark-components', 'Ark UI components', 'https://ark-ui.com/docs/components', [
    'Headless component API comparison',
  ]),
  evidence('wcag-target-size', 'WCAG 2.2 Target Size', 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum', [
    'Pointer target sizing',
  ]),
  evidence('wcag-animation-interactions', 'WCAG Animation from Interactions', 'https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html', [
    'Reduced-motion and user-controlled animation fallbacks',
  ]),
  evidence('mdn-save-data', 'MDN Save-Data', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Save-Data', [
    'Reduced-data runtime projection',
  ]),
  evidence('webgl-best-practices', 'WebGL best practices', 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices', [
    'Bounded visual-engine resources and context-loss fallback',
  ]),
  evidence('fortune-sheet', 'FortuneSheet Workbook', 'https://ruilisi.github.io/fortune-sheet-docs/guide/api.html', [
    'Excel-like spreadsheet host and WorkbookInstance actions',
  ]),
  evidence('apache-echarts', 'Apache ECharts option', 'https://echarts.apache.org/en/option.html#title', [
    'Chart option keys, components, series, and ready example configurations',
  ]),
] as const satisfies readonly BaseComponentEvidence[];

export const BASE_COMPONENT_EVIDENCE_BY_ID = new Map(
  BASE_COMPONENT_EVIDENCE_REGISTRY.map((entry) => [entry.id, entry]),
);
