import type { DesignerBindingDefinition, DesignerNode, DesignerSessionField } from '../../../domain/component-designer/types';
import {
  getNodePropertyBinding,
  resolveBindingRole,
} from '../../../domain/component-designer/bindingEngine';
import { getNodeRegionColumnBinding } from '../../../domain/component-designer/bindingRegionEngine';
import { getNodeSessionReadBindingForProp } from '../../../domain/component-designer/bindingSessionEngine';
import { getNodeStoreReadBindingForProp } from '../../../domain/component-designer/bindingStoreEngine';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

export const INSPECTOR_BINDING_CARD_CLASS =
  `overflow-hidden rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]`;

export const INSPECTOR_BINDING_PANEL_CLASS =
  `rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-gradient-to-b from-white to-slate-50/60 p-3`;

export const isManagedNodeBindingKey = (bindingKey: string): boolean =>
  bindingKey.startsWith('prop:') || bindingKey.startsWith('event:') || bindingKey.startsWith('store:') || bindingKey === 'regionDataSource' || bindingKey === 'gridListResource';

/** Permanent field-level indicator kinds (T1-11f / inspector spec §5). */
export type PropBindingSourceKind = 'store' | 'api' | 'regionColumn' | 'expression' | 'session' | 'formula';

export const PROP_BINDING_SOURCE_INDICATOR: Record<
  PropBindingSourceKind,
  { label: string; title: string; dotClassName: string; ringClassName: string }
> = {
  store: {
    label: 'Store',
    title: 'Bound to Store',
    dotClassName: 'bg-violet-500',
    ringClassName: 'ring-violet-200',
  },
  api: {
    label: 'API',
    title: 'Bound to API',
    dotClassName: 'bg-indigo-500',
    ringClassName: 'ring-indigo-200',
  },
  regionColumn: {
    label: 'Region Column',
    title: 'Bound to Region Column',
    dotClassName: 'bg-sky-500',
    ringClassName: 'ring-sky-200',
  },
  expression: {
    label: 'Page Data',
    title: 'Bound to Page Data',
    dotClassName: 'bg-amber-500',
    ringClassName: 'ring-amber-200',
  },
  session: {
    label: 'Session',
    title: 'Bound to Current Session',
    dotClassName: 'bg-emerald-500',
    ringClassName: 'ring-emerald-200',
  },
  formula: {
    label: 'Formula',
    title: 'Bound to Formula',
    dotClassName: 'bg-fuchsia-500',
    ringClassName: 'ring-fuchsia-200',
  },
};

const isApiPropertyBinding = (definition: DesignerBindingDefinition): boolean => {
  if (definition.sourceType === 'apiRef') {
    return true;
  }

  if ((definition.fetchEndpoint?.trim().length ?? 0) > 0) {
    return true;
  }

  return (definition.lovRef?.trim().length ?? 0) > 0;
};

/**
 * Resolves the permanent binding source indicator for a bindable prop.
 * Returns null when the prop is static / not actually bound (capability alone is not enough).
 */
export const resolvePropBindingSourceKind = (
  node: DesignerNode,
  propKey: string,
): PropBindingSourceKind | null => {
  if (getNodeRegionColumnBinding(node, propKey)) {
    return 'regionColumn';
  }

  if (getNodeSessionReadBindingForProp(node, propKey)) {
    return 'session';
  }

  const storeBinding = getNodeStoreReadBindingForProp(node, propKey);
  if (storeBinding) {
    if (storeBinding.definition.sourceType === 'session') {
      return 'session';
    }
    return 'store';
  }

  const property = getNodePropertyBinding(node, propKey);
  if (!property) {
    return null;
  }

  if (isApiPropertyBinding(property.definition)) {
    return 'api';
  }

  if (property.definition.sourceType === 'formula') {
    return 'formula';
  }

  if (
    property.definition.sourceType === 'expression'
    || property.definition.sourceType === 'static'
  ) {
    return 'expression';
  }

  return null;
};

export const resolveBindingBadge = (
  definition: DesignerBindingDefinition,
  bindingKey: string,
): { label: string; className: string } => {
  const role = resolveBindingRole(definition, bindingKey);

  if (role === 'property') {
    return { label: 'Property', className: 'border-cyan-200 bg-cyan-50 text-cyan-700' };
  }

  if (role === 'event') {
    return { label: 'Action', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }

  if (definition.sourceType === 'apiRef') {
    return { label: 'API', className: 'border-indigo-200 bg-indigo-50 text-indigo-700' };
  }

  if (definition.sourceType === 'store') {
    return { label: 'Store', className: 'border-violet-200 bg-violet-50 text-violet-700' };
  }

  if (definition.sourceType === 'session') {
    return { label: 'Session', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }

  if (definition.sourceType === 'regionColumn') {
    return { label: 'Record Field', className: 'border-sky-200 bg-sky-50 text-sky-700' };
  }

  if (definition.sourceType === 'expression') {
    return { label: 'Page Data', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  }

  if (definition.sourceType === 'formula') {
    return { label: 'Formula', className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700' };
  }

  return { label: 'Static', className: 'border-slate-200 bg-slate-100 text-slate-600' };
};

export const formatBindingKeyLabel = (bindingKey: string): string => {
  if (bindingKey.startsWith('prop:')) {
    return `Property · ${bindingKey.slice(5)}`;
  }

  if (bindingKey.startsWith('event:')) {
    return `Event · ${bindingKey.slice(6)}`;
  }

  if (bindingKey.startsWith('store:')) {
    return `Store · ${bindingKey.slice(6)}`;
  }

  if (bindingKey === 'regionDataSource') {
    return 'Record Context';
  }

  return bindingKey;
};

export type PropertyBindingSourceMode = 'state' | 'api' | 'store' | 'session' | 'formula';

/** Unified value-source selector shown in the property binding assistant. */
export type PropertyBindingValueSource = 'recordField' | 'pageData' | 'store' | 'api' | 'session' | 'formula';

export const PROPERTY_BINDING_VALUE_SOURCE_LABELS: Record<PropertyBindingValueSource, string> = {
  recordField: 'Record field (recommended)',
  pageData: 'Page data',
  formula: 'Formula / expression',
  store: 'Global store',
  session: 'Current session',
  api: 'API response',
};

export const resolvePropertyBindingValueSource = (
  hasRegionColumn: boolean,
  sourceMode: PropertyBindingSourceMode,
  hasSessionBinding = false,
): PropertyBindingValueSource => {
  if (hasRegionColumn) {
    return 'recordField';
  }

  if (hasSessionBinding || sourceMode === 'session') {
    return 'session';
  }

  if (sourceMode === 'formula') {
    return 'formula';
  }

  if (sourceMode === 'store') {
    return 'store';
  }

  if (sourceMode === 'api') {
    return 'api';
  }

  return 'pageData';
};

export const resolvePropertyBindingSourceMode = (
  fetchEndpoint: string,
  hasStoreBinding: boolean,
  lovRef?: string,
  preferredMode?: PropertyBindingSourceMode,
  hasSessionBinding = false,
  hasFormulaBinding = false,
): PropertyBindingSourceMode => {
  if (hasSessionBinding) {
    return 'session';
  }

  if (hasFormulaBinding || preferredMode === 'formula') {
    return 'formula';
  }

  if (hasStoreBinding) {
    return 'store';
  }

  if (fetchEndpoint.trim().length > 0 || (lovRef?.trim().length ?? 0) > 0) {
    return 'api';
  }

  if (preferredMode === 'api') {
    return 'api';
  }

  if (preferredMode === 'session') {
    return 'session';
  }

  return 'state';
};

export type { DesignerSessionField };
