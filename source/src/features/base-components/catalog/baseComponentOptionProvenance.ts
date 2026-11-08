import { resolveCatalogInspectorGroup } from '../../../domain/base-components/catalogInspectorGroups';
import type {
  BaseComponentDemoMapping,
  BaseComponentMeta,
  BaseComponentOptionMeta,
  BaseComponentTestMapping,
} from './baseComponentOptionTypes';

const isProductionOption = (
  option: BaseComponentOptionMeta,
): option is BaseComponentOptionMeta & {
  disposition: 'public-prop' | 'composition-prop';
  propPath: string;
} =>
  (option.disposition === 'public-prop' || option.disposition === 'composition-prop')
  && typeof option.propPath === 'string'
  && option.propPath.length > 0;

/**
 * Joins the option, component, demo, and executable-test registries into one
 * production provenance record. This deliberately uses catalog identities,
 * not source-text inspection.
 */
export function attachBaseComponentOptionProvenance(
  options: readonly BaseComponentOptionMeta[],
  components: readonly BaseComponentMeta[],
  demos: readonly BaseComponentDemoMapping[],
  tests: readonly BaseComponentTestMapping[],
): BaseComponentOptionMeta[] {
  const componentsById = new Map(components.map((component) => [component.id, component]));

  return options.map((option) => {
    const grouped: BaseComponentOptionMeta = {
      ...option,
      inspectorGroup: option.inspectorGroup
        ?? resolveCatalogInspectorGroup(option.id, undefined, option.axis),
    };
    if (grouped.disposition !== 'public-prop' && grouped.disposition !== 'composition-prop') {
      return grouped;
    }
    if (!isProductionOption(option)) {
      throw new Error(`Production option "${option.id}" requires an explicit propPath.`);
    }

    const component = componentsById.get(option.componentId);
    const primaryDemos = demos.filter(
      (demo) => demo.componentId === option.componentId && demo.primary,
    );
    const livenessTests = tests.filter(
      (test) =>
        test.componentId === option.componentId
        && test.testId.endsWith('.option-liveness'),
    );
    if (!component) throw new Error(`Unknown production option owner "${option.componentId}".`);
    if (primaryDemos.length !== 1) {
      throw new Error(`Production option "${option.id}" requires exactly one primary demo.`);
    }
    if (livenessTests.length !== 1) {
      throw new Error(`Production option "${option.id}" requires exactly one liveness test.`);
    }

    return {
      ...grouped,
      provenance: {
        ownerId: component.id,
        productionExportIds: component.publicExportIds,
        adapter:
          option.disposition === 'public-prop'
            ? 'component-prop'
            : 'composition-prop',
        propPath: option.propPath,
        demoId: primaryDemos[0].id,
        livenessTestId: livenessTests[0].testId,
        livenessTestFile: livenessTests[0].testFile,
      },
    };
  });
}
