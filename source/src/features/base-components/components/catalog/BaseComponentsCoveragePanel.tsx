import React from 'react';
import type {
  BaseComponentDemoMapping,
  BaseComponentMeta,
  BaseComponentTestMapping,
} from '../../catalog/baseComponentOptionTypes';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataBadge,
  BaseComponentsMetadataList,
} from './BaseComponentsCatalogPanel';

export const BaseComponentsCoveragePanel: React.FC<{
  component: BaseComponentMeta;
  demos: readonly BaseComponentDemoMapping[];
  tests: readonly BaseComponentTestMapping[];
}> = ({ component, demos, tests }) => {
  const componentDemos = demos.filter((demo) => demo.componentId === component.id);
  const componentTests = tests.filter((test) => test.componentId === component.id);
  return (
    <BaseComponentsCatalogPanel
      title="Coverage"
      headerExtra={
        <div className="flex gap-1">
          <BaseComponentsMetadataBadge tone="cyan">
            {componentDemos.length} demo
          </BaseComponentsMetadataBadge>
          <BaseComponentsMetadataBadge tone="emerald">
            {componentTests.length} tests
          </BaseComponentsMetadataBadge>
        </div>
      }
    >
      <div>
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Demo mappings
        </h4>
        <BaseComponentsMetadataList
          items={componentDemos.map(
            (demo) =>
              `${demo.primary ? 'Primary' : 'Secondary'} · ${demo.sectionId}#${demo.anchor}`,
          )}
        />
      </div>
      <div>
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Test mappings
        </h4>
        <BaseComponentsMetadataList
          items={componentTests.map((test) => `${test.testId} · ${test.testFile}`)}
        />
      </div>
    </BaseComponentsCatalogPanel>
  );
};
