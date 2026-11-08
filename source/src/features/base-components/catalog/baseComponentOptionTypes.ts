export const BASE_COMPONENT_OPTION_AXES = [
  'preset',
  'content',
  'behavior',
  'layout',
  'appearance',
  'state',
  'responsive',
  'accessibility',
  'data',
] as const;

export type BaseComponentOptionAxis = (typeof BASE_COMPONENT_OPTION_AXES)[number];

export const BASE_COMPONENT_OPTION_DISPOSITIONS = [
  'public-prop',
  'composition-prop',
  'fixture',
  'scenario',
  'catalog-only',
] as const;

export type BaseComponentOptionDisposition =
  (typeof BASE_COMPONENT_OPTION_DISPOSITIONS)[number];

export const BASE_COMPONENT_OPTION_CONTROLS = [
  'checkbox',
  'segmented',
  'select',
  'multi-select',
  'combobox',
  'text',
  'number-step',
  'range',
  'color',
  'icon-picker',
  'repeater',
  'state-matrix',
  'responsive-matrix',
  'data-editor',
] as const;

export type BaseComponentOptionControl =
  (typeof BASE_COMPONENT_OPTION_CONTROLS)[number];

export type BaseComponentOptionScalar = string | number | boolean;

export type BaseComponentOptionCondition =
  | { optionId: string; equals: BaseComponentOptionScalar }
  | { optionId: string; in: readonly (string | number)[] }
  | { all: readonly BaseComponentOptionCondition[] }
  | { any: readonly BaseComponentOptionCondition[] };

export type BaseComponentOptionProvenance = {
  ownerId: string;
  productionExportIds: readonly string[];
  adapter: 'component-prop' | 'composition-prop';
  propPath: string;
  demoId: string;
  livenessTestId: string;
  livenessTestFile: string;
};

export type BaseComponentRecordFieldDef = {
  key: string;
  label: string;
  control?: 'text' | 'textarea' | 'checkbox';
  placeholder?: string;
};

export type BaseComponentOptionMeta = {
  id: string;
  componentId: string;
  label: string;
  axis: BaseComponentOptionAxis;
  disposition: BaseComponentOptionDisposition;
  propPath?: string;
  control: BaseComponentOptionControl;
  defaultValue: unknown;
  values?: readonly unknown[];
  /** Open collection editor — `repeater` does not need closed `values` when this is set. */
  recordFields?: readonly BaseComponentRecordFieldDef[];
  recordItemLabel?: string;
  recordHasId?: boolean;
  visibleWhen?: BaseComponentOptionCondition;
  enabledWhen?: BaseComponentOptionCondition;
  /** Living-sample FormSection title. Designer Properties reads this — it does not invent groups. */
  inspectorGroup?: string;
  conflicts?: readonly string[];
  requires?: readonly string[];
  responsiveOwner: 'component' | 'composition' | 'none';
  accessibilityImpact?: string;
  evidenceRefs: readonly string[];
  /**
   * Attached by the catalog adapter for every production-facing option.
   * Demo-only dispositions must never carry this mapping.
   */
  provenance?: BaseComponentOptionProvenance;
};

export type BaseComponentKind = 'primitive' | 'composite' | 'recipe';
export type BaseComponentMaturity =
  | 'experimental'
  | 'supported'
  | 'preferred'
  | 'deprecated';

export type BaseComponentMeta = {
  id: string;
  family: string;
  kind: BaseComponentKind;
  maturity: BaseComponentMaturity;
  publicExportIds: readonly string[];
  useWhen: readonly string[];
  avoidWhen: readonly string[];
  anatomy: {
    required: readonly string[];
    optional: readonly string[];
  };
  optionIds: readonly string[];
  requiredScenarios: readonly string[];
  requiredTests: readonly string[];
  antiOptions: readonly string[];
};

export type BaseComponentEvidence = {
  id: string;
  label: string;
  url: `https://${string}`;
  observedOn: '2026-08-03';
  supports: readonly string[];
};

export type BaseComponentExportClassification =
  | 'public-primitive'
  | 'public-composite'
  | 'private-internal'
  | 'token'
  | 'runtime-adapter';

export type BaseComponentExportMeta = {
  exportId: string;
  classification: BaseComponentExportClassification;
  componentId?: string;
};

export type BaseComponentDemoMapping = {
  id: string;
  componentId: string;
  sectionId: string;
  anchor: string;
  primary: boolean;
  scenarios: readonly string[];
};

export type BaseComponentTestMapping = {
  id: string;
  componentId: string;
  testId: string;
  testFile: string;
};

export type BaseComponentCatalog = {
  evidence: readonly BaseComponentEvidence[];
  exports: readonly BaseComponentExportMeta[];
  components: readonly BaseComponentMeta[];
  options: readonly BaseComponentOptionMeta[];
  demos: readonly BaseComponentDemoMapping[];
  tests: readonly BaseComponentTestMapping[];
};

export type BaseComponentsConfigExport = {
  public: Record<string, unknown>;
  composition: Record<string, unknown>;
  demo: {
    fixtures: Record<string, unknown>;
    scenarios: Record<string, unknown>;
  };
};

export type BaseComponentOptionValueState = Record<string, unknown>;

export type BaseComponentOptionResolution = {
  values: BaseComponentOptionValueState;
  optionState: Record<
    string,
    {
      visible: boolean;
      enabled: boolean;
    }
  >;
  adjustments: readonly {
    optionId: string;
    from: unknown;
    to: unknown;
    reason: string;
  }[];
  violations: readonly {
    optionId: string;
    relatedOptionId?: string;
    message: string;
  }[];
};
