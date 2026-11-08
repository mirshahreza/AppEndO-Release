/**
 * Designer-readable Base Components catalog surface (p-103).
 * Feature `component-designer` must not import feature `base-components`;
 * this domain adapter is the single downward read of the living catalog.
 */
import {
  BASE_COMPONENTS_NAV_SECTIONS,
  BASE_COMPONENTS_SECTION_GROUPS,
  BASE_COMPONENTS_SECTIONS,
  type BaseComponentsSectionGroupId,
} from '../../features/base-components/baseComponentsSections';
import {
  BASE_COMPONENT_CATALOG,
  getBaseComponentOptions,
} from '../../features/base-components/catalog/baseComponentCatalog';
import { evaluateBaseComponentOptionCondition } from '../../features/base-components/catalog/resolveBaseComponentConfig';
import type {
  BaseComponentOptionCondition,
  BaseComponentOptionMeta,
} from '../../features/base-components/catalog/baseComponentOptionTypes';

export type {
  BaseComponentOptionAxis,
  BaseComponentOptionCondition,
  BaseComponentOptionControl,
  BaseComponentOptionDisposition,
  BaseComponentOptionMeta,
} from '../../features/base-components/catalog/baseComponentOptionTypes';

export { evaluateBaseComponentOptionCondition };

const PRODUCTION_DISPOSITIONS = new Set(['public-prop', 'composition-prop']);

export const isProductionCatalogOption = (option: BaseComponentOptionMeta): boolean =>
  PRODUCTION_DISPOSITIONS.has(option.disposition);

export type CatalogSectionGroupMeta = {
  id: BaseComponentsSectionGroupId;
  label: string;
};

export type CatalogSectionMeta = {
  id: string;
  label: string;
  group: BaseComponentsSectionGroupId;
};

export type { BaseComponentsSectionGroupId };

const SECTION_BY_ID = new Map<string, (typeof BASE_COMPONENTS_SECTIONS)[number]>(
  BASE_COMPONENTS_SECTIONS.map((section) => [section.id, section]),
);

export const listCatalogComponentIds = (): readonly string[] =>
  BASE_COMPONENT_CATALOG.components.map((component) => component.id);

export const listCatalogSectionGroups = (): readonly CatalogSectionGroupMeta[] =>
  BASE_COMPONENTS_SECTION_GROUPS.map((group) => ({ id: group.id, label: group.label }));

export const listCatalogSectionMeta = (): readonly CatalogSectionMeta[] =>
  BASE_COMPONENTS_NAV_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    group: section.group,
  }));

export const getCatalogSection = (componentId: string): CatalogSectionMeta | undefined => {
  const section = SECTION_BY_ID.get(componentId);
  return section
    ? { id: section.id, label: section.label, group: section.group }
    : undefined;
};

export const getCatalogSectionLabel = (componentId: string): string | undefined =>
  SECTION_BY_ID.get(componentId)?.label;

export const getCatalogSectionGroup = (
  componentId: string,
): BaseComponentsSectionGroupId | undefined =>
  SECTION_BY_ID.get(componentId)?.group;

export const getCatalogProductionOptions = (
  componentId: string,
): BaseComponentOptionMeta[] =>
  getBaseComponentOptions(componentId).filter(isProductionCatalogOption);

export const getCatalogBindableOptions = (
  componentId: string,
): BaseComponentOptionMeta[] =>
  getCatalogProductionOptions(componentId).filter((option) =>
    option.axis === 'data' || option.control === 'data-editor',
  );

export const optionIsVisible = (
  option: BaseComponentOptionMeta,
  values: Readonly<Record<string, unknown>>,
): boolean => (
  !option.visibleWhen
  || evaluateBaseComponentOptionCondition(option.visibleWhen as BaseComponentOptionCondition, values)
);

export const optionIsEnabled = (
  option: BaseComponentOptionMeta,
  values: Readonly<Record<string, unknown>>,
): boolean => (
  !option.enabledWhen
  || evaluateBaseComponentOptionCondition(option.enabledWhen as BaseComponentOptionCondition, values)
);
