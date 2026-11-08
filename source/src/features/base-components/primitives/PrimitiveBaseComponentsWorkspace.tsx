import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import { FormSection } from '../../../shared/ui';
import { CATALOG_AXIS_GROUP_TITLES } from '../../../domain/base-components/catalogInspectorGroups';
import { BASE_COMPONENT_OPTION_AXES, type BaseComponentOptionMeta } from '../catalog/baseComponentOptionTypes';
import { BASE_COMPONENTS_BY_ID, getBaseComponentOptions } from '../catalog/baseComponentCatalog';
import { exportBaseComponentConfig } from '../catalog/exportBaseComponentConfig';
import { resolveBaseComponentConfig } from '../catalog/resolveBaseComponentConfig';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { getBaseComponentsSectionLabel } from '../baseComponentsSections';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import type { SectionId } from '../types';
import { PrimitiveCatalogOptionField } from './PrimitiveCatalogOptionField';
import { PrimitiveLivingPreview } from './PrimitiveLivingPreview';

const isProductionOption = (option: BaseComponentOptionMeta) =>
  option.disposition === 'public-prop' || option.disposition === 'composition-prop';

const optionSectionTitle = (option: BaseComponentOptionMeta): string =>
  option.inspectorGroup
  ?? (option.axis in CATALOG_AXIS_GROUP_TITLES
    ? CATALOG_AXIS_GROUP_TITLES[option.axis]
    : option.axis);

export const groupPrimitiveConfigSections = (
  options: readonly BaseComponentOptionMeta[],
  sectionLabel: string,
): { title: string; options: BaseComponentOptionMeta[] }[] => {
  const production = options.filter(isProductionOption);
  const titles: string[] = [];
  for (const option of production) {
    const title = optionSectionTitle(option);
    if (!titles.includes(title)) titles.push(title);
  }
  const axisOrder = BASE_COMPONENT_OPTION_AXES.map((axis) => CATALOG_AXIS_GROUP_TITLES[axis]);
  titles.sort((left, right) => {
    const leftIndex = axisOrder.indexOf(left as (typeof axisOrder)[number]);
    const rightIndex = axisOrder.indexOf(right as (typeof axisOrder)[number]);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
  if (titles.length <= 1) {
    return [{ title: sectionLabel, options: production }];
  }
  return titles.map((title) => ({
    title,
    options: production.filter((option) => optionSectionTitle(option) === title),
  }));
};

export const isCatalogFillHeight = (value: unknown): boolean =>
  value === 'h-full' || value === 'full' || value === 'fill';

export const PrimitiveBaseComponentsWorkspace: React.FC<{ sectionId: SectionId }> = ({ sectionId }) => {
  const component = BASE_COMPONENTS_BY_ID.get(sectionId);
  const options = useMemo(() => getBaseComponentOptions(sectionId), [sectionId]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const sectionLabel = getBaseComponentsSectionLabel(sectionId);

  const resolution = resolveBaseComponentConfig(options, values);
  const configExport = exportBaseComponentConfig(options, resolution.values);
  const configJson = useMemo(
    () => JSON.stringify({ ...configExport.public, ...configExport.composition }, null, 2),
    [configExport],
  );
  const sections = useMemo(
    () => groupPrimitiveConfigSections(options, sectionLabel),
    [options, sectionLabel],
  );

  if (!component) {
    return <p className="p-3 text-sm text-slate-600">Missing catalog component for {sectionId}.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId={sectionId} json={configJson}>
          <BaseComponentsResetButton onClick={() => setValues({})} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            {sections.map((section) => {
              const visibleOptions = section.options.filter((option) => resolution.optionState[option.id]?.visible);
              if (visibleOptions.length === 0) return null;
              return (
                <FormSection key={section.title} title={section.title} tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
                  <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                    {visibleOptions.map((option) => (
                      <PrimitiveCatalogOptionField
                        key={option.id}
                        option={option}
                        value={resolution.values[option.id]}
                        disabled={!resolution.optionState[option.id]?.enabled}
                        onChange={(value) => setValues((current) => ({ ...current, [option.id]: value }))}
                      />
                    ))}
                  </div>
                </FormSection>
              );
            })}
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame
          sectionId={sectionId}
          fill={isCatalogFillHeight(configExport.public.height)}
        >
          <div className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <PrimitiveLivingPreview
              sectionId={sectionId}
              label={sectionLabel}
              publicProps={configExport.public}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};

export const createPrimitiveWorkspace = (sectionId: SectionId): React.FC => {
  const Workspace: React.FC = () => <PrimitiveBaseComponentsWorkspace sectionId={sectionId} />;
  Workspace.displayName = `PrimitiveWorkspace(${sectionId})`;
  return Workspace;
};
