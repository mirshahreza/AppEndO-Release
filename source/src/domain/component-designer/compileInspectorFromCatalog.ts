import {
  getCatalogProductionOptions,
  type BaseComponentOptionControl,
  type BaseComponentOptionMeta,
} from '../base-components/catalogAccess';
import { resolveCatalogInspectorGroup } from '../base-components/catalogInspectorGroups';
import { getCompileComponentId } from './designerCatalogIdentity';

export type CompiledInspectorField = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'icon-picker' | 'content-records';
  group: 'content' | 'heroui';
  options?: Array<{ value: string; label: string }>;
  catalogOptionId: string;
  catalogGroup: string;
  propPath: string;
  catalogControl: BaseComponentOptionControl;
  catalogAxis?: BaseComponentOptionMeta['axis'];
  catalogDefaultValue: unknown;
  catalogVisibleWhen?: BaseComponentOptionMeta['visibleWhen'];
  catalogEnabledWhen?: BaseComponentOptionMeta['enabledWhen'];
  recordFields?: BaseComponentOptionMeta['recordFields'];
  recordItemLabel?: string;
  recordHasId?: boolean;
};

export const catalogOptionGroupTitle = (optionId: string): string =>
  resolveCatalogInspectorGroup(optionId);

const CONTROL_TO_FIELD_TYPE: Record<BaseComponentOptionControl, CompiledInspectorField['type']> = {
  checkbox: 'boolean',
  segmented: 'select',
  select: 'select',
  'multi-select': 'select',
  combobox: 'select',
  text: 'string',
  'number-step': 'number',
  range: 'number',
  color: 'string',
  'icon-picker': 'icon-picker',
  repeater: 'content-records',
  'state-matrix': 'select',
  'responsive-matrix': 'select',
  'data-editor': 'string',
};

const AXIS_TO_GROUP: Record<string, CompiledInspectorField['group']> = {
  content: 'content',
  data: 'content',
  preset: 'content',
  behavior: 'heroui',
  layout: 'heroui',
  appearance: 'heroui',
  state: 'heroui',
  responsive: 'heroui',
  accessibility: 'heroui',
};

const closedSelectOptions = (
  values: readonly unknown[] | undefined,
): Array<{ value: string; label: string }> | undefined => {
  if (!values || values.length === 0) return undefined;
  const scalars = values.every((value) => (
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
  ));
  if (!scalars) return undefined;
  return values.map((value) => ({
    value: String(value),
    label: String(value),
  }));
};

export const compileOptionToInspectorField = (
  option: BaseComponentOptionMeta,
): CompiledInspectorField => {
  const propPath = option.propPath ?? option.id;
  return {
    key: propPath.includes('.') ? option.id : propPath,
    label: option.label,
    type: CONTROL_TO_FIELD_TYPE[option.control] ?? 'string',
    group: AXIS_TO_GROUP[option.axis] ?? 'heroui',
    options: closedSelectOptions(option.values),
    catalogOptionId: option.id,
    catalogGroup: option.inspectorGroup ?? resolveCatalogInspectorGroup(option.id, undefined, option.axis),
    propPath,
    catalogControl: option.control,
    catalogAxis: option.axis,
    catalogDefaultValue: option.defaultValue,
    catalogVisibleWhen: option.visibleWhen,
    catalogEnabledWhen: option.enabledWhen,
    ...(option.recordFields ? { recordFields: option.recordFields } : {}),
    ...(option.recordItemLabel ? { recordItemLabel: option.recordItemLabel } : {}),
    ...(option.recordHasId === undefined ? {} : { recordHasId: option.recordHasId }),
  };
};

export const compileInspectorFromCatalog = (
  componentId: string,
): CompiledInspectorField[] =>
  getCatalogProductionOptions(componentId).map(compileOptionToInspectorField);

export const compileInspectorForPaletteItem = (
  paletteItemId: string,
): CompiledInspectorField[] | null => {
  const componentId = getCompileComponentId(paletteItemId);
  if (!componentId) return null;
  const fields = compileInspectorFromCatalog(componentId);
  return fields.length > 0 ? fields : null;
};
