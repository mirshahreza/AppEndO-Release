import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE_COMPONENT_CATALOG } from '../baseComponentCatalog';
import { BASE_COMPONENT_EVIDENCE_REGISTRY } from '../baseComponentEvidenceRegistry';
import { BASE_COMPONENT_SECTION_WORKSPACES } from '../../components/BaseComponentsSectionContent';
import type {
  BaseComponentCatalog,
  BaseComponentOptionMeta,
} from '../baseComponentOptionTypes';
import { TARGET_BASE_COMPONENT_SECTION_IDS } from '../sections/catalogSections.options';
import { exportBaseComponentConfig } from '../exportBaseComponentConfig';
import {
  assertValidBaseComponentCatalog,
  validateBaseComponentCatalog,
} from '../validateBaseComponentCatalog';

const mutableCatalog = (): BaseComponentCatalog =>
  structuredClone(BASE_COMPONENT_CATALOG) as BaseComponentCatalog;

const catalogOptions: readonly BaseComponentOptionMeta[] =
  BASE_COMPONENT_CATALOG.options;

describe('Base Components catalog metadata', () => {
  it('validates all target sections and the frozen evidence registry', () => {
    expect(validateBaseComponentCatalog(BASE_COMPONENT_CATALOG, {
      expectedComponentIds: TARGET_BASE_COMPONENT_SECTION_IDS,
      expectedSectionIds: TARGET_BASE_COMPONENT_SECTION_IDS,
      expectedBijectionSectionIds: TARGET_BASE_COMPONENT_SECTION_IDS,
      runtimeSectionIds: Object.keys(BASE_COMPONENT_SECTION_WORKSPACES),
    })).toEqual([]);
    expect(BASE_COMPONENT_EVIDENCE_REGISTRY).toHaveLength(34);
    expect(new Set(BASE_COMPONENT_EVIDENCE_REGISTRY.map(({ id }) => id)).size).toBe(34);
    expect(
      BASE_COMPONENT_EVIDENCE_REGISTRY.every(({ url }) => url.startsWith('https://')),
    ).toBe(true);
    expect(new Set(BASE_COMPONENT_CATALOG.components.map(({ id }) => id))).toEqual(
      new Set(TARGET_BASE_COMPONENT_SECTION_IDS),
    );
    expect(new Set(BASE_COMPONENT_CATALOG.demos.map(({ sectionId }) => sectionId))).toEqual(
      new Set(TARGET_BASE_COMPONENT_SECTION_IDS),
    );
    expect(BASE_COMPONENT_CATALOG.components).toHaveLength(TARGET_BASE_COMPONENT_SECTION_IDS.length);
    expect(
      BASE_COMPONENT_CATALOG.components.every(
        ({ optionIds, requiredTests, anatomy }) =>
          optionIds.length > 0 && requiredTests.length > 0 && anatomy.required.length > 0,
      ),
    ).toBe(true);
  });

  it('keeps every option closed where its control requires a finite domain', () => {
    const closedControls = new Set([
      'checkbox', 'segmented', 'select', 'multi-select', 'combobox', 'number-step',
      'range', 'repeater', 'state-matrix', 'responsive-matrix', 'data-editor',
    ]);
    const openOptions = catalogOptions.filter(
      ({ control, values, recordFields }) =>
        closedControls.has(control)
        && !values
        && !(control === 'repeater' && recordFields && recordFields.length > 0),
    );

    expect(openOptions).toEqual([]);
    expect(new Set(catalogOptions.map(({ id }) => id)).size).toBe(
      catalogOptions.length,
    );
  });

  it('requires executable option-liveness evidence for every section', () => {
    const livenessTests = BASE_COMPONENT_CATALOG.tests.filter(({ testId }) =>
      testId.endsWith('.option-liveness'),
    );

    expect(new Set(livenessTests.map(({ componentId }) => componentId))).toEqual(
      new Set(TARGET_BASE_COMPONENT_SECTION_IDS),
    );
    expect(
      livenessTests.every(({ testFile }) => existsSync(resolve(process.cwd(), testFile))),
    ).toBe(true);
  });

  it('gates every public and composition option through explicit production provenance', () => {
    const productionOptions = catalogOptions.filter(
      ({ disposition }) =>
        disposition === 'public-prop' || disposition === 'composition-prop',
    );
    const mappingKeys = productionOptions.map(({ provenance }) =>
      `${provenance?.ownerId}:${provenance?.adapter}:${provenance?.propPath}`);

    expect(productionOptions.length).toBeGreaterThan(150);
    expect(new Set(mappingKeys).size).toBe(mappingKeys.length);
    for (const option of productionOptions) {
      expect(option.propPath, option.id).toBeTruthy();
      expect(option.provenance, option.id).toMatchObject({
        ownerId: option.componentId,
        propPath: option.propPath,
        demoId: `${option.componentId}.primary`,
      });
      expect(
        existsSync(resolve(process.cwd(), option.provenance!.livenessTestFile)),
        option.provenance!.livenessTestFile,
      ).toBe(true);
    }
  });

  it('keeps fixture, scenario, and catalog state out of production adapters and export', () => {
    const demoOnly = catalogOptions.filter(
      ({ disposition }) =>
        disposition === 'fixture'
        || disposition === 'scenario'
        || disposition === 'catalog-only',
    );
    expect(demoOnly.every(({ provenance }) => provenance === undefined)).toBe(true);

    const exported = exportBaseComponentConfig(
      catalogOptions,
      Object.fromEntries(catalogOptions.map(({ id }) => [id, `sentinel:${id}`])),
    );
    const productionText = JSON.stringify({
      public: exported.public,
      composition: exported.composition,
    });
    for (const option of demoOnly) {
      expect(productionText).not.toContain(`sentinel:${option.id}`);
    }
  });

  it('encodes key dependency boundaries instead of prose-only conflicts', () => {
    const byId = new Map(catalogOptions.map((entry) => [entry.id, entry]));

    expect(byId.get('tabs.activationMode')?.enabledWhen).toEqual({
      optionId: 'tabs.panelLifecycle',
      equals: 'eager',
    });
    expect(byId.get('wizard.clickableSteps')?.enabledWhen).toEqual({
      optionId: 'wizard.navigation',
      equals: 'nonlinear',
    });
    expect(byId.get('progress.value')?.enabledWhen).toEqual({
      optionId: 'progress.mode',
      equals: 'determinate',
    });
    expect(byId.get('kanban.keyboardMove')?.enabledWhen).toEqual({
      optionId: 'kanban.interactive',
      equals: true,
    });
  });

  it('rejects duplicate IDs and unresolved evidence references', () => {
    const catalog = mutableCatalog();
    catalog.evidence = [...catalog.evidence, catalog.evidence[0]];
    catalog.options = catalog.options.map((option, index) =>
      index === 0
        ? { ...option, evidenceRefs: [...option.evidenceRefs, 'missing-source'] }
        : option,
    );

    const codes = validateBaseComponentCatalog(catalog).map(({ code }) => code);
    expect(codes).toContain('duplicate-evidence-id');
    expect(codes).toContain('unknown-evidence-reference');
    expect(() => assertValidBaseComponentCatalog(catalog)).toThrow(
      'Invalid Base Components catalog',
    );
  });

  it('rejects orphan option coverage and missing export classifications', () => {
    const catalog = mutableCatalog();
    catalog.components = catalog.components.map((component) => ({
      ...component,
      optionIds: component.optionIds.filter((id) => id !== 'tabs.variant'),
    }));

    const codes = validateBaseComponentCatalog(catalog, {
      expectedExportIds: ['UiTabs', 'UiWorkspaceTabs'],
    }).map(({ code }) => code);
    expect(codes).toContain('orphan-option');
    expect(codes).toContain('missing-export-classification');
  });

  it('rejects gaps in the closed section target inventory', () => {
    const catalog = mutableCatalog();
    catalog.components = catalog.components.filter(({ id }) => id !== 'shell-effects');
    catalog.demos = catalog.demos.filter(({ sectionId }) => sectionId !== 'shell-navigation');

    const codes = validateBaseComponentCatalog(catalog, {
      expectedComponentIds: TARGET_BASE_COMPONENT_SECTION_IDS,
      expectedSectionIds: TARGET_BASE_COMPONENT_SECTION_IDS,
    }).map(({ code }) => code);

    expect(codes).toContain('missing-component');
    expect(codes).toContain('missing-section');
    expect(codes).toContain('unknown-option-component');
  });

  it('enforces the catalog/export/demo/test bijection', () => {
    const catalog = mutableCatalog();
    catalog.tests = catalog.tests.filter(({ componentId }) => componentId !== 'creative-scenes');
    const runtimeSectionIds = Object.keys(BASE_COMPONENT_SECTION_WORKSPACES).filter(
      (id) => id !== 'shell-effects',
    );

    const issues = validateBaseComponentCatalog(catalog, {
      expectedBijectionSectionIds: TARGET_BASE_COMPONENT_SECTION_IDS,
      runtimeSectionIds,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'section-bijection-mismatch',
        path: 'exports',
        message: expect.stringContaining('shell-effects'),
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'section-bijection-mismatch',
        path: 'tests',
        message: expect.stringContaining('creative-scenes'),
      }),
    );
  });

  it('can compare public mappings with a caller-provided runtime contract', () => {
    const issues = validateBaseComponentCatalog(BASE_COMPONENT_CATALOG, {
      knownPublicPropPathsByComponent: {
        tabs: ['visualMode'],
      },
    });

    expect(issues.map(({ code }) => code)).toContain('unknown-public-prop-path');
    expect(issues.find(({ code }) => code === 'unknown-public-prop-path')?.path).toBe(
      'options.tabs.variant',
    );
  });

  it('requires public prop mappings and exactly one primary demo', () => {
    const catalog = mutableCatalog();
    catalog.options = catalog.options.map((option) =>
      option.id === 'tabs.variant' ? { ...option, propPath: undefined } : option,
    );
    catalog.demos = [
      ...catalog.demos,
      { ...catalog.demos[0], id: 'tabs.duplicate-primary' },
    ];

    const codes = validateBaseComponentCatalog(catalog).map(({ code }) => code);
    expect(codes).toContain('missing-public-prop-path');
    expect(codes).toContain('invalid-primary-demo-count');
  });

  it('rejects missing composition mappings and forged fixture provenance', () => {
    const catalog = mutableCatalog();
    catalog.options = catalog.options.map((option) => {
      if (option.id === 'toolbar.presentation') {
        return { ...option, propPath: undefined };
      }
      if (option.id === 'toolbar.actions.fixture') {
        return {
          ...option,
          provenance: catalog.options.find(
            ({ id }) => id === 'toolbar.orientation',
          )!.provenance,
        };
      }
      return option;
    });

    const codes = validateBaseComponentCatalog(catalog).map(({ code }) => code);
    expect(codes).toContain('missing-composition-prop-path');
    expect(codes).toContain('demo-option-provenance-leak');
  });
});
