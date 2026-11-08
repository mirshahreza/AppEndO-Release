import type {
  BaseComponentCatalog,
  BaseComponentOptionCondition,
  BaseComponentOptionMeta,
} from './baseComponentOptionTypes';

export type BaseComponentCatalogValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type BaseComponentCatalogValidationOptions = {
  /** When supplied by a full inventory test, every export must be classified. */
  expectedExportIds?: readonly string[];
  /** Optional runtime-contract snapshot used by later section coverage gates. */
  knownPublicPropPathsByComponent?: Readonly<Record<string, readonly string[]>>;
  /** Closed target inventory used by the p-85 section coverage gate. */
  expectedComponentIds?: readonly string[];
  /** Closed workspace/demo section inventory used by the p-85 coverage gate. */
  expectedSectionIds?: readonly string[];
  /** Requires catalog, workspace export, demo, and test mappings for exactly these sections. */
  expectedBijectionSectionIds?: readonly string[];
  /** Exported section-workspace IDs supplied by the route/runtime registry. */
  runtimeSectionIds?: readonly string[];
};

const duplicateValues = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const sameValue = (left: unknown, right: unknown): boolean =>
  Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right);

const conditionReferences = (
  condition: BaseComponentOptionCondition,
): string[] => {
  if ('optionId' in condition) return [condition.optionId];
  const children = 'all' in condition ? condition.all : condition.any;
  return children.flatMap(conditionReferences);
};

const pushDuplicates = (
  issues: BaseComponentCatalogValidationIssue[],
  code: string,
  path: string,
  values: readonly string[],
) => {
  for (const duplicate of duplicateValues(values)) {
    issues.push({
      code,
      path,
      message: `Duplicate ID "${duplicate}".`,
    });
  }
};

const pushSetDifference = (
  issues: BaseComponentCatalogValidationIssue[],
  expected: ReadonlySet<string>,
  actual: ReadonlySet<string>,
  code: string,
  path: string,
  label: string,
) => {
  for (const id of expected) {
    if (!actual.has(id)) {
      issues.push({ code, path, message: `${label} is missing section "${id}".` });
    }
  }
  for (const id of actual) {
    if (!expected.has(id)) {
      issues.push({ code, path, message: `${label} has unexpected section "${id}".` });
    }
  }
};

const validateOption = (
  option: BaseComponentOptionMeta,
  optionsById: ReadonlyMap<string, BaseComponentOptionMeta>,
  evidenceIds: ReadonlySet<string>,
  componentIds: ReadonlySet<string>,
  issues: BaseComponentCatalogValidationIssue[],
) => {
  const path = `options.${option.id}`;
  if (!componentIds.has(option.componentId)) {
    issues.push({
      code: 'unknown-option-component',
      path,
      message: `Option references unknown component "${option.componentId}".`,
    });
  }

  const hasPropPath = typeof option.propPath === 'string' && option.propPath.trim() !== '';
  if (
    (option.disposition === 'public-prop' || option.disposition === 'composition-prop')
    && !hasPropPath
  ) {
    issues.push({
      code:
        option.disposition === 'public-prop'
          ? 'missing-public-prop-path'
          : 'missing-composition-prop-path',
      path,
      message: `${option.disposition} options require propPath.`,
    });
  }
  if (
    ['fixture', 'scenario', 'catalog-only'].includes(option.disposition) &&
    option.propPath !== undefined
  ) {
    issues.push({
      code: 'forbidden-prop-path',
      path,
      message: `${option.disposition} options cannot declare propPath.`,
    });
  }
  if (hasPropPath && !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\.\*)*$/.test(option.propPath!)) {
    issues.push({
      code: 'invalid-prop-path',
      path,
      message: `Invalid dot-path "${option.propPath}".`,
    });
  }

  if (option.values) {
    if (option.values.length === 0) {
      issues.push({ code: 'empty-values', path, message: 'Option values cannot be empty.' });
    } else if (!option.values.some((value) => sameValue(value, option.defaultValue))) {
      issues.push({
        code: 'default-outside-values',
        path,
        message: 'defaultValue must be included in values.',
      });
    }
    const serialized = option.values.map((value) => JSON.stringify(value));
    if (duplicateValues(serialized).length > 0) {
      issues.push({
        code: 'duplicate-option-values',
        path,
        message: 'Option values must be unique.',
      });
    }
  }
  const closedControls = new Set([
    'checkbox',
    'segmented',
    'select',
    'multi-select',
    'combobox',
    'number-step',
    'range',
    'repeater',
    'state-matrix',
    'responsive-matrix',
    'data-editor',
  ]);
  const repeaterHasRecordShape = option.control === 'repeater' && Boolean(option.recordFields?.length);
  if (closedControls.has(option.control) && !option.values && !repeaterHasRecordShape) {
    issues.push({
      code: 'missing-closed-values',
      path,
      message: `Control "${option.control}" requires deterministic closed values.`,
    });
  }

  const references = [
    ...(option.visibleWhen ? conditionReferences(option.visibleWhen) : []),
    ...(option.enabledWhen ? conditionReferences(option.enabledWhen) : []),
    ...(option.conflicts ?? []),
    ...(option.requires ?? []),
  ];
  for (const reference of references) {
    const related = optionsById.get(reference);
    if (!related) {
      issues.push({
        code: 'unknown-option-reference',
        path,
        message: `Option references unknown option "${reference}".`,
      });
    } else if (related.componentId !== option.componentId) {
      issues.push({
        code: 'cross-component-option-reference',
        path,
        message: `Option reference "${reference}" belongs to another component.`,
      });
    } else if (reference === option.id) {
      issues.push({
        code: 'self-option-reference',
        path,
        message: 'An option cannot constrain itself.',
      });
    }
  }

  if (option.visibleWhen) {
    pushDuplicates(
      issues,
      'duplicate-option-reference',
      `${path}.visibleWhen`,
      conditionReferences(option.visibleWhen),
    );
  }
  if (option.enabledWhen) {
    pushDuplicates(
      issues,
      'duplicate-option-reference',
      `${path}.enabledWhen`,
      conditionReferences(option.enabledWhen),
    );
  }
  pushDuplicates(
    issues,
    'duplicate-option-reference',
    `${path}.conflicts`,
    option.conflicts ?? [],
  );
  pushDuplicates(
    issues,
    'duplicate-option-reference',
    `${path}.requires`,
    option.requires ?? [],
  );
  pushDuplicates(issues, 'duplicate-evidence-reference', path, option.evidenceRefs);
  if (option.evidenceRefs.length === 0) {
    issues.push({
      code: 'missing-evidence',
      path,
      message: 'Every option requires at least one evidence reference.',
    });
  }
  for (const evidenceRef of option.evidenceRefs) {
    if (!evidenceIds.has(evidenceRef)) {
      issues.push({
        code: 'unknown-evidence-reference',
        path,
        message: `Unknown evidence reference "${evidenceRef}".`,
      });
    }
  }
};

export const validateBaseComponentCatalog = (
  catalog: BaseComponentCatalog,
  options: BaseComponentCatalogValidationOptions = {},
): BaseComponentCatalogValidationIssue[] => {
  const issues: BaseComponentCatalogValidationIssue[] = [];
  pushDuplicates(issues, 'duplicate-evidence-id', 'evidence', catalog.evidence.map(({ id }) => id));
  pushDuplicates(issues, 'duplicate-component-id', 'components', catalog.components.map(({ id }) => id));
  pushDuplicates(issues, 'duplicate-option-id', 'options', catalog.options.map(({ id }) => id));
  pushDuplicates(issues, 'duplicate-export-id', 'exports', catalog.exports.map(({ exportId }) => exportId));
  pushDuplicates(issues, 'duplicate-demo-id', 'demos', catalog.demos.map(({ id }) => id));
  pushDuplicates(issues, 'duplicate-test-id', 'tests', catalog.tests.map(({ id }) => id));

  const evidenceIds = new Set(catalog.evidence.map(({ id }) => id));
  const componentIds = new Set(catalog.components.map(({ id }) => id));
  const optionsById = new Map(catalog.options.map((option) => [option.id, option]));
  const exportById = new Map(catalog.exports.map((entry) => [entry.exportId, entry]));
  const demoById = new Map(catalog.demos.map((entry) => [entry.id, entry]));
  const testByTestId = new Map(catalog.tests.map((entry) => [entry.testId, entry]));

  pushDuplicates(
    issues,
    'duplicate-production-option-mapping',
    'options.provenance',
    catalog.options.flatMap((option) =>
      option.provenance
        ? [`${option.provenance.ownerId}:${option.provenance.adapter}:${option.provenance.propPath}`]
        : []),
  );

  for (const entry of catalog.evidence) {
    const path = `evidence.${entry.id}`;
    if (!entry.url.startsWith('https://')) {
      issues.push({ code: 'non-https-evidence', path, message: 'Evidence URL must use HTTPS.' });
    }
    if (entry.observedOn !== '2026-08-03') {
      issues.push({
        code: 'invalid-observed-date',
        path,
        message: 'Evidence observedOn must match the approved research date.',
      });
    }
    if (entry.supports.length === 0) {
      issues.push({
        code: 'empty-evidence-support',
        path,
        message: 'Evidence must identify at least one supported decision.',
      });
    }
  }

  for (const option of catalog.options) {
    validateOption(option, optionsById, evidenceIds, componentIds, issues);
    const path = `options.${option.id}`;
    const isProduction =
      option.disposition === 'public-prop' || option.disposition === 'composition-prop';
    if (isProduction && !option.provenance) {
      issues.push({
        code: 'missing-option-provenance',
        path,
        message: 'Production-facing options require owner, adapter, demo, and liveness evidence.',
      });
      continue;
    }
    if (!isProduction && option.provenance) {
      issues.push({
        code: 'demo-option-provenance-leak',
        path,
        message: `${option.disposition} options cannot carry production provenance.`,
      });
      continue;
    }
    if (!option.provenance) continue;
    const provenance = option.provenance;
    if (
      provenance.ownerId !== option.componentId
      || provenance.propPath !== option.propPath
      || provenance.adapter
        !== (option.disposition === 'public-prop' ? 'component-prop' : 'composition-prop')
    ) {
      issues.push({
        code: 'invalid-option-provenance-mapping',
        path,
        message: 'Option provenance does not match its declared owner, disposition, or propPath.',
      });
    }
    const demo = demoById.get(provenance.demoId);
    if (!demo || !demo.primary || demo.componentId !== option.componentId) {
      issues.push({
        code: 'invalid-option-demo-evidence',
        path,
        message: `Primary demo "${provenance.demoId}" does not prove this option owner.`,
      });
    }
    const test = testByTestId.get(provenance.livenessTestId);
    if (
      !test
      || test.componentId !== option.componentId
      || test.testFile !== provenance.livenessTestFile
      || !test.testId.endsWith('.option-liveness')
    ) {
      issues.push({
        code: 'invalid-option-liveness-evidence',
        path,
        message: `Executable liveness evidence "${provenance.livenessTestId}" is not registered.`,
      });
    }
    if (
      provenance.productionExportIds.some((exportId) => {
        const entry = exportById.get(exportId);
        return !entry
          || entry.componentId !== option.componentId
          || !entry.classification.startsWith('public-');
      })
    ) {
      issues.push({
        code: 'invalid-option-production-export',
        path,
        message: 'Production export ownership is empty, orphaned, or not public.',
      });
    }
  }

  for (const component of catalog.components) {
    const path = `components.${component.id}`;
    pushDuplicates(issues, 'duplicate-component-option', path, component.optionIds);
    pushDuplicates(issues, 'duplicate-public-export', path, component.publicExportIds);
    if (
      component.useWhen.length === 0 ||
      component.avoidWhen.length === 0 ||
      component.anatomy.required.length === 0 ||
      component.optionIds.length === 0 ||
      component.antiOptions.length === 0
    ) {
      issues.push({
        code: 'incomplete-component-metadata',
        path,
        message: 'Component decision, anatomy, options, and anti-options must be substantive.',
      });
    }

    const actualOptionIds = catalog.options
      .filter((option) => option.componentId === component.id)
      .map(({ id }) => id);
    for (const optionId of component.optionIds) {
      if (!optionsById.has(optionId)) {
        issues.push({
          code: 'unknown-component-option',
          path,
          message: `Component references unknown option "${optionId}".`,
        });
      } else if (!actualOptionIds.includes(optionId)) {
        issues.push({
          code: 'foreign-component-option',
          path,
          message: `Option "${optionId}" belongs to another component.`,
        });
      }
    }
    for (const orphanOptionId of actualOptionIds.filter((id) => !component.optionIds.includes(id))) {
      issues.push({
        code: 'orphan-option',
        path,
        message: `Option "${orphanOptionId}" is not listed by its component.`,
      });
    }

    for (const exportId of component.publicExportIds) {
      const exportMeta = exportById.get(exportId);
      if (!exportMeta) {
        issues.push({
          code: 'unclassified-public-export',
          path,
          message: `Public export "${exportId}" has no classification.`,
        });
      } else if (
        !exportMeta.classification.startsWith('public-') ||
        exportMeta.componentId !== component.id
      ) {
        issues.push({
          code: 'invalid-public-export-classification',
          path,
          message: `Export "${exportId}" is not classified as public for this component.`,
        });
      }
    }

    const primaryDemos = catalog.demos.filter(
      (demo) => demo.componentId === component.id && demo.primary,
    );
    if (primaryDemos.length !== 1) {
      issues.push({
        code: 'invalid-primary-demo-count',
        path,
        message: `Component requires exactly one primary demo; found ${primaryDemos.length}.`,
      });
    }
    const coveredScenarios = new Set(
      catalog.demos
        .filter((demo) => demo.componentId === component.id)
        .flatMap((demo) => demo.scenarios),
    );
    for (const scenario of component.requiredScenarios) {
      if (!coveredScenarios.has(scenario)) {
        issues.push({
          code: 'missing-required-scenario',
          path,
          message: `Required scenario "${scenario}" has no demo mapping.`,
        });
      }
    }
    const mappedTests = new Set(
      catalog.tests
        .filter((test) => test.componentId === component.id)
        .map((test) => test.testId),
    );
    for (const testId of component.requiredTests) {
      if (!mappedTests.has(testId)) {
        issues.push({
          code: 'missing-required-test',
          path,
          message: `Required test "${testId}" has no test mapping.`,
        });
      }
    }
  }

  for (const entry of catalog.exports) {
    if (entry.componentId && !componentIds.has(entry.componentId)) {
      issues.push({
        code: 'orphan-export',
        path: `exports.${entry.exportId}`,
        message: `Export references unknown component "${entry.componentId}".`,
      });
    }
    if (entry.classification.startsWith('public-') && !entry.componentId) {
      issues.push({
        code: 'public-export-without-component',
        path: `exports.${entry.exportId}`,
        message: 'Public exports require a componentId.',
      });
    }
  }
  for (const demo of catalog.demos) {
    if (!componentIds.has(demo.componentId)) {
      issues.push({
        code: 'orphan-demo',
        path: `demos.${demo.id}`,
        message: `Demo references unknown component "${demo.componentId}".`,
      });
    }
    if (!componentIds.has(demo.sectionId)) {
      issues.push({
        code: 'unknown-demo-section',
        path: `demos.${demo.id}`,
        message: `Demo references unknown section "${demo.sectionId}".`,
      });
    }
    if (demo.componentId !== demo.sectionId) {
      issues.push({
        code: 'demo-section-mismatch',
        path: `demos.${demo.id}`,
        message: `Demo component "${demo.componentId}" must match section "${demo.sectionId}".`,
      });
    }
  }
  for (const test of catalog.tests) {
    if (!componentIds.has(test.componentId)) {
      issues.push({
        code: 'orphan-test',
        path: `tests.${test.id}`,
        message: `Test references unknown component "${test.componentId}".`,
      });
    }
  }
  for (const exportId of options.expectedExportIds ?? []) {
    if (!exportById.has(exportId)) {
      issues.push({
        code: 'missing-export-classification',
        path: 'exports',
        message: `Export "${exportId}" is not classified.`,
      });
    }
  }
  const demoSectionIds = new Set(catalog.demos.map(({ sectionId }) => sectionId));
  for (const componentId of options.expectedComponentIds ?? []) {
    if (!componentIds.has(componentId)) {
      issues.push({
        code: 'missing-component',
        path: 'components',
        message: `Target component "${componentId}" is not represented.`,
      });
    }
  }
  for (const sectionId of options.expectedSectionIds ?? []) {
    if (!demoSectionIds.has(sectionId)) {
      issues.push({
        code: 'missing-section',
        path: 'demos',
        message: `Target section "${sectionId}" has no catalog demo mapping.`,
      });
    }
  }
  if (options.expectedBijectionSectionIds) {
    const expected = new Set(options.expectedBijectionSectionIds);
    const mappedSets = [
      ['components', new Set(catalog.components.map(({ id }) => id))],
      ['exports', new Set(options.runtimeSectionIds ?? [])],
      ['demos', new Set(catalog.demos.map(({ componentId }) => componentId))],
      ['tests', new Set(catalog.tests.map(({ componentId }) => componentId))],
    ] as const;
    for (const [label, actual] of mappedSets) {
      pushSetDifference(
        issues,
        expected,
        actual,
        'section-bijection-mismatch',
        label,
        label,
      );
    }
  }
  for (const option of catalog.options) {
    if (option.disposition !== 'public-prop' || !option.propPath) continue;
    const knownPaths = options.knownPublicPropPathsByComponent?.[option.componentId];
    if (knownPaths && !knownPaths.includes(option.propPath)) {
      issues.push({
        code: 'unknown-public-prop-path',
        path: `options.${option.id}`,
        message: `propPath "${option.propPath}" is absent from the runtime contract snapshot.`,
      });
    }
  }

  return issues;
};

export const assertValidBaseComponentCatalog = (
  catalog: BaseComponentCatalog,
  options?: BaseComponentCatalogValidationOptions,
): void => {
  const issues = validateBaseComponentCatalog(catalog, options);
  if (issues.length > 0) {
    const detail = issues.map((issue) => `[${issue.code}] ${issue.path}: ${issue.message}`).join('\n');
    throw new Error(`Invalid Base Components catalog:\n${detail}`);
  }
};
