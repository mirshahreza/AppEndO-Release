import {
  BASE_COMPONENT_EVIDENCE_REGISTRY,
} from './baseComponentEvidenceRegistry';
import type { BaseComponentCatalog } from './baseComponentOptionTypes';
import {
  CATALOG_SECTION_COMPONENTS,
  CATALOG_SECTION_DEMOS,
  CATALOG_SECTION_EXPORTS,
  CATALOG_SECTION_OPTIONS,
  CATALOG_SECTION_TESTS,
} from './sections/catalogSections.options';
import { TABS_COMPONENT_META, TABS_OPTIONS } from './sections/tabs.options';
import { attachBaseComponentOptionProvenance } from './baseComponentOptionProvenance';

const components = [...CATALOG_SECTION_COMPONENTS, TABS_COMPONENT_META];
const demos = [
  ...CATALOG_SECTION_DEMOS,
  {
    id: 'tabs.primary',
    componentId: 'tabs',
    sectionId: 'tabs',
    anchor: 'content-tabs',
    primary: true,
    scenarios: TABS_COMPONENT_META.requiredScenarios,
  },
];
const tests = [
  ...CATALOG_SECTION_TESTS,
  ...TABS_COMPONENT_META.requiredTests.map((testId) => ({
    id: `tabs.${testId}`,
    componentId: 'tabs',
    testId,
    testFile:
      testId === 'tabs.option-liveness'
        ? 'src/features/base-components/__tests__/layoutOptionLiveness.test.tsx'
        : testId === 'tabs.config-export'
          ? 'src/features/base-components/tabs/__tests__/TabsBaseComponentsWorkspace.test.ts'
          : 'src/features/base-components/catalog/__tests__/baseComponentCatalog.test.ts',
  })),
];
const options = attachBaseComponentOptionProvenance(
  [...CATALOG_SECTION_OPTIONS, ...TABS_OPTIONS],
  components,
  demos,
  tests,
);

/**
 * The catalog is assembled from deterministic section shards. Workspaces
 * consume this authority instead of copying option definitions into demo state.
 */
export const BASE_COMPONENT_CATALOG = {
  evidence: BASE_COMPONENT_EVIDENCE_REGISTRY,
  exports: [
    ...CATALOG_SECTION_EXPORTS,
    {
      exportId: 'UiTabs',
      classification: 'public-primitive',
      componentId: 'tabs',
    },
  ],
  components,
  options,
  demos,
  tests,
} as const satisfies BaseComponentCatalog;

export const BASE_COMPONENTS_BY_ID = new Map(
  BASE_COMPONENT_CATALOG.components.map((component) => [component.id, component]),
);

export const BASE_COMPONENT_OPTIONS_BY_ID = new Map(
  BASE_COMPONENT_CATALOG.options.map((option) => [option.id, option]),
);

export const getBaseComponentOptions = (componentId: string) =>
  BASE_COMPONENT_CATALOG.options.filter((option) => option.componentId === componentId);
