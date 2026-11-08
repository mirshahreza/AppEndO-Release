import * as React from 'react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode, DesignerViewportPreset } from '../../../domain/component-designer/types';
import type { InspectorFieldSchema } from '../../../domain/component-designer/inspectorRegistry';
import { evaluateBaseComponentOptionCondition } from '../../../domain/base-components/catalogAccess';
import { applyCatalogProp, readCatalogProp } from '../../../domain/component-designer/applyCatalogProp';
import { compileInspectorForPaletteItem } from '../../../domain/component-designer/compileInspectorFromCatalog';
import { UiInput, UiSelect } from '../../../shared/ui';
import { InspectorCatalogOptionField } from './InspectorCatalogOptionField';
import { InspectorCrudSetColumnsField } from './InspectorCrudSetColumnsField';
import { InspectorCrudSetLivingFields } from './InspectorCrudSetLivingFields';
import { DesignerFieldRow } from './DesignerFieldRow';
import { InspectorPropDialogField } from './InspectorPropDialogField';
import { InspectorBindablePropField } from './InspectorPropBindingControl';
import { InspectorOptionItemsField } from './InspectorOptionItemsField';
import { InspectorStaticListItemsField } from './InspectorStaticListItemsField';
import { InspectorDataGridColumnsField } from './InspectorDataGridColumnsField';
import { InspectorGridSortOptionsField } from './InspectorGridSortOptionsField';
import { InspectorGridAggregationField } from './InspectorGridAggregationField';
import { InspectorGridToolbarField } from './InspectorGridToolbarField';
import { InspectorLayoutGridColumnWidthsField } from './InspectorLayoutGridColumnWidthsField';
import { InspectorLucideIconPickerField } from './InspectorLucideIconPickerField';
import { InspectorContentRecordsField } from './InspectorContentRecordsField';
import {
  applyTailwindUtility,
  resolveTailwindUtilityValue,
  resolveResponsiveTailwindUtilityValue,
  applyResponsiveTailwindUtility,
} from '../../../domain/component-designer/tailwindClasses';
import {
  TAILWIND_INSPECTOR_FIELDS,
  type TailwindInspectorField,
} from '../../../domain/component-designer/inspectorRegistry';
import { resolveInspectorFieldHelp } from '../lib/designerInspectorHelp';
import { INSPECTOR_FIELD_HIGHLIGHT_CLASS } from '../../../domain/component-designer/inspectorFieldSearch';
import {
  InspectorVisualStylePanel,
  VISUAL_STYLE_REPLACED_FIELD_KEYS,
} from './InspectorVisualStylePanel';
import { nodeHasCapability } from '../../../domain/component-designer/catalog';
import { isLayoutGridPaletteItemId } from '../../../domain/component-designer/layoutGridSlots';
import { getNodePaletteItemId } from '../../../domain/component-designer/runtimeShared';
import type { BreakpointPrefix } from '../../../domain/component-designer/tailwindStyleCodec';
import {
  styleBreakpointIdFromPrefix,
  styleBreakpointIdFromViewportPreset,
  styleBreakpointPrefix,
  viewportPresetFromStyleBreakpoint,
} from '../lib/designerStyleBreakpoints';
import {
  INSPECTOR_TEXT_SM,
} from './inspectorDesignTokens';

type InspectorPropFieldsProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  selectedNodeId: string;
  fields: InspectorFieldSchema[];
  dispatch: React.Dispatch<DesignerAction>;
  /** Keys matched by inspector field search (T1-11b). */
  highlightedFieldKeys?: ReadonlySet<string>;
  /** Active canvas viewport — keeps Style breakpoint tabs aligned with the frame. */
  viewportPreset?: DesignerViewportPreset;
};

const DIALOG_TEXT_FIELD_KEYS = new Set(['className', 'style']);

const validateJsonFieldDraft = (draft: string): string | null => {
  const trimmed = draft.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    JSON.parse(trimmed);
    return null;
  } catch {
    return 'Invalid JSON — check for missing quotes, commas, or brackets.';
  }
};

const catalogValuesFromFields = (
  node: DesignerNode,
  fields: InspectorFieldSchema[],
): Record<string, unknown> => {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.catalogOptionId || !field.propPath) continue;
    const current = readCatalogProp(node.props, { propPath: field.propPath });
    values[field.catalogOptionId] = current === undefined ? field.catalogDefaultValue : current;
  }
  return values;
};

const shouldShowInspectorField = (
  node: DesignerNode,
  field: InspectorFieldSchema,
  catalogValues?: Record<string, unknown>,
): boolean => {
  if (field.catalogVisibleWhen && catalogValues) {
    return evaluateBaseComponentOptionCondition(field.catalogVisibleWhen, catalogValues);
  }
  if (field.key === 'text') {
    return node.props.textContentMode !== 'translation';
  }

  if (field.key === 'translationKey') {
    return node.props.textContentMode === 'translation';
  }

  if (field.key === 'gaugeMin' || field.key === 'gaugeMax' || field.key === 'gaugeThresholds') {
    return node.props.chartVariant === 'gauge';
  }

  // Phase 52 — advanced chart type-specific Inspector fields (parity with gauge pattern).
  const chartType = typeof node.props.chartType === 'string' ? node.props.chartType : 'scatter';
  if (field.key === 'sizeKey' || field.key === 'showTrendline') {
    return chartType === 'scatter';
  }
  if (field.key === 'yAxisKey') {
    return chartType === 'scatter' || chartType === 'heatmap';
  }
  if (field.key === 'showConversionRate') {
    return chartType === 'funnel';
  }
  if (field.key === 'showConnectors') {
    return chartType === 'waterfall';
  }
  if (field.key === 'showVolume') {
    return chartType === 'candlestick';
  }
  if (field.key === 'maxValue') {
    return chartType === 'radar';
  }
  if (field.key === 'colorKey') {
    return chartType === 'treemap' || chartType === 'sunburst' || chartType === 'heatmap' || chartType === 'scatter';
  }
  if (field.key === 'mapboxAccessToken') {
    return node.props.tileProvider === 'mapbox';
  }

  return true;
};

const tailwindFieldByKey = new Map<string, TailwindInspectorField>(
  TAILWIND_INSPECTOR_FIELDS.map((field) => [field.key, field]),
);

const normalizePropValue = (field: InspectorFieldSchema, rawValue: string): unknown => {
  if (field.type === 'number') {
    const trimmed = rawValue.trim();
    return trimmed.length === 0 ? undefined : Number(trimmed);
  }

  if (field.type === 'boolean') {
    return rawValue === 'true';
  }

  const trimmed = rawValue.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const readPropDisplayValue = (node: DesignerNode, field: InspectorFieldSchema, breakpoint: BreakpointPrefix = ''): string => {
  const tailwindField = tailwindFieldByKey.get(field.key);
  if (tailwindField) {
    const className = typeof node.props.className === 'string' ? node.props.className : '';
    const val = resolveResponsiveTailwindUtilityValue(className, tailwindField, breakpoint);
    return val.replace(/^(?:md:|lg:)/, '');
  }

  const value = field.propPath
    ? readCatalogProp(node.props, { propPath: field.propPath })
    : node.props[field.key];
  if (field.type === 'boolean') {
    return value === true || value === 'true' ? 'true' : 'false';
  }

  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
};

type InspectorFieldControlProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  field: InspectorFieldSchema;
  setProp: (key: string, value: unknown) => void;
  dispatch: React.Dispatch<DesignerAction>;
  breakpoint?: BreakpointPrefix;
  catalogValues?: Record<string, unknown>;
};

const BINDABLE_INSPECTOR_FIELD_TYPES = new Set<InspectorFieldSchema['type']>(['string', 'number', 'boolean', 'select']);

const isBindableField = (field: InspectorFieldSchema): boolean => {
  if (field.key.startsWith('tw')) return false;
  if (field.catalogOptionId) {
    return field.catalogAxis === 'data' || field.catalogControl === 'data-editor';
  }
  return BINDABLE_INSPECTOR_FIELD_TYPES.has(field.type);
};

const InspectorFieldControl: React.FC<InspectorFieldControlProps> = ({
  node,
  document,
  bindingDefinitions,
  field,
  setProp,
  dispatch,
  breakpoint = '',
  catalogValues = {},
}) => {
  if (field.catalogControl) {
    const disabled = Boolean(
      field.catalogEnabledWhen
      && !evaluateBaseComponentOptionCondition(field.catalogEnabledWhen, catalogValues),
    );
    return (
      <InspectorCatalogOptionField
        field={field}
        value={field.propPath ? readCatalogProp(node.props, { propPath: field.propPath }) : node.props[field.key]}
        disabled={disabled}
        onChange={(next) => setProp(field.key, next)}
      />
    );
  }

  if (field.type === 'option-items') {
    return (
      <InspectorOptionItemsField
        node={node}
        bindingDefinitions={bindingDefinitions}
        label={field.label}
        dispatch={dispatch}
      />
    );
  }

  if (field.type === 'static-list-items') {
    return (
      <InspectorStaticListItemsField
        node={node}
        document={document}
        dispatch={dispatch}
      />
    );
  }

  if (field.type === 'data-grid-columns' || field.type === 'app-table-grid-columns') {
    return (
      <InspectorDataGridColumnsField
        node={node}
        document={document}
        bindingDefinitions={bindingDefinitions}
        dispatch={dispatch}
      />
    );
  }

  if (field.type === 'app-table-grid-sort-options') {
    return (
      <InspectorGridSortOptionsField
        node={node}
        dispatch={dispatch}
      />
    );
  }

  if (field.type === 'app-table-grid-aggregation') {
    return (
      <InspectorGridAggregationField
        node={node}
        dispatch={dispatch}
      />
    );
  }

  if (field.type === 'app-table-grid-toolbar') {
    return (
      <InspectorGridToolbarField
        node={node}
        document={document}
        bindingDefinitions={bindingDefinitions}
        dispatch={dispatch}
      />
    );
  }

  if (field.type === 'layout-grid-column-widths') {
    return (
      <InspectorLayoutGridColumnWidthsField
        node={node}
        dispatch={dispatch}
      />
    );
  }

  if (field.type === 'icon-picker') {
    const currentValue = typeof node.props[field.key] === 'string' ? (node.props[field.key] as string) : undefined;
    return (
      <InspectorLucideIconPickerField
        label={field.label}
        value={currentValue}
        onChange={(iconName) => setProp(field.key, iconName)}
      />
    );
  }

  if (field.type === 'content-records') {
    return (
      <InspectorContentRecordsField
        node={node}
        dispatch={dispatch}
        propKey={field.key}
        title={field.label}
        itemLabel={field.recordItemLabel ?? 'item'}
        fields={field.recordFields ?? []}
        hasId={field.recordHasId !== false}
      />
    );
  }

  if (isBindableField(field)) {
    return (
      <InspectorBindablePropField
        node={node}
        document={document}
        bindingDefinitions={bindingDefinitions}
        field={field}
        setProp={setProp}
        dispatch={dispatch}
      />
    );
  }

  if ((DIALOG_TEXT_FIELD_KEYS.has(field.key) || field.jsonEditor) && field.type === 'string') {
    return (
      <InspectorPropDialogField
        label={field.label}
        value={readPropDisplayValue(node, field, breakpoint)}
        placeholder={field.placeholder}
        dialogTitle={`Edit ${field.label}`}
        onChange={(nextValue) => setProp(field.key, normalizePropValue(field, nextValue))}
        validate={field.jsonEditor ? validateJsonFieldDraft : undefined}
      />
    );
  }

  return (
    <DesignerFieldRow
      label={field.label}
      align="center"
      help={resolveInspectorFieldHelp(field.key)}
    >
      {field.type === 'boolean' ? (
        <UiSelect
          size="sm"
          value={node.props[field.key] === true ? 'yes' : 'no'}
          onChange={(event) => setProp(field.key, event.target.value === 'yes' ? true : undefined)}
          ariaLabel={field.label}
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </UiSelect>
      ) : null}

      {field.type === 'number' ? (
        <UiInput
          size="sm"
          type="number"
          aiAssist={false}
          autoDir={false}
          placeholder={field.placeholder}
          value={readPropDisplayValue(node, field, breakpoint)}
          onChange={(event) => setProp(field.key, normalizePropValue(field, event.target.value))}
        />
      ) : null}

      {field.type === 'string' ? (
        <UiInput
          size="sm"
          aiAssist={false}
          autoDir={false}
          placeholder={field.placeholder}
          value={readPropDisplayValue(node, field, breakpoint)}
          onChange={(event) => setProp(field.key, normalizePropValue(field, event.target.value))}
        />
      ) : null}

      {field.type === 'select' ? (
        <UiSelect
          size="sm"
          value={readPropDisplayValue(node, field, breakpoint)}
          onChange={(event) => {
            const tailwindField = tailwindFieldByKey.get(field.key);
            if (tailwindField) {
              const currentClassName = typeof node.props.className === 'string' ? node.props.className : '';
              setProp('className', applyResponsiveTailwindUtility(currentClassName, tailwindField, event.target.value, breakpoint ?? ''));
              return;
            }

            setProp(field.key, normalizePropValue(field, event.target.value));
          }}
        >
          {(field.options ?? []).map((option) => (
            <option key={`${field.key}:${option.value || '(empty)'}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </UiSelect>
      ) : null}
    </DesignerFieldRow>
  );
};

export const InspectorPropFields: React.FC<InspectorPropFieldsProps> = ({
  node,
  document,
  bindingDefinitions,
  selectedNodeId,
  fields,
  dispatch,
  highlightedFieldKeys,
  viewportPreset = 'desktop',
}) => {
  const selectedNodeIdRef = React.useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  // Desktop → lg:, Tablet → md:, Mobile → base (''). Default matches the canvas desktop frame.
  const [breakpoint, setBreakpoint] = React.useState<BreakpointPrefix>(() =>
    styleBreakpointPrefix(styleBreakpointIdFromViewportPreset(viewportPreset)),
  );

  React.useEffect(() => {
    setBreakpoint(styleBreakpointPrefix(styleBreakpointIdFromViewportPreset(viewportPreset)));
  }, [viewportPreset]);

  const setProp = React.useCallback((key: string, value: unknown) => {
    const catalogField = fields.find((field) => field.key === key && field.propPath);
    if (catalogField?.propPath) {
      const nextProps = applyCatalogProp(node.props, { propPath: catalogField.propPath }, value);
      const rootKey = catalogField.propPath.split('.')[0] ?? key;
      dispatch({
        type: 'set-node-prop',
        nodeId: selectedNodeIdRef.current,
        key: rootKey,
        value: nextProps[rootKey],
      });
      return;
    }
    dispatch({
      type: 'set-node-prop',
      nodeId: selectedNodeIdRef.current,
      key,
      value,
    });
  }, [dispatch, fields, node.props]);

  const handleBreakpointChange = React.useCallback((next: BreakpointPrefix) => {
    setBreakpoint(next);
    const preset = viewportPresetFromStyleBreakpoint(styleBreakpointIdFromPrefix(next));
    dispatch({ type: 'set-viewport-preset', preset });
  }, [dispatch]);

  const handleClassNameChange = React.useCallback((nextClassName: string) => {
    setProp('className', nextClassName.trim().length > 0 ? nextClassName : undefined);
  }, [setProp]);

  const handleStyleChange = React.useCallback((nextStyle: string) => {
    setProp('style', nextStyle.trim().length > 0 ? nextStyle : undefined);
  }, [setProp]);

  const isTailwindSection = React.useMemo(() => fields.some((f) => f.key.startsWith('tw')), [fields]);

  const currentClassName = typeof node.props.className === 'string' ? node.props.className : '';
  const currentStyle = typeof node.props.style === 'string' ? node.props.style : '';

  const paletteItemId = getNodePaletteItemId(node);
  const catalogValues = catalogValuesFromFields(node, [
    ...(compileInspectorForPaletteItem(paletteItemId ?? '') ?? []),
    ...fields,
  ]);
  const visibleFields = fields
    .filter((field) => shouldShowInspectorField(node, field, catalogValues))
    .filter((field) => !(isTailwindSection && VISUAL_STYLE_REPLACED_FIELD_KEYS.has(field.key)));
  const isCatalogContent = visibleFields.some((field) => Boolean(field.catalogOptionId));

  if (paletteItemId === 'heroui.crud-set' && isCatalogContent) {
    return <InspectorCrudSetLivingFields node={node} dispatch={dispatch} />;
  }

  let lastCatalogGroup: string | undefined;

  return (
    <div className="space-y-2">
      {isTailwindSection ? (
        <InspectorVisualStylePanel
          className={currentClassName}
          styleValue={currentStyle}
          breakpoint={breakpoint}
          highlightedFieldKeys={highlightedFieldKeys}
          showContainerLayout={nodeHasCapability(node, 'container')}
          isStructuralGrid={isLayoutGridPaletteItemId(paletteItemId)}
          onBreakpointChange={handleBreakpointChange}
          onClassNameChange={handleClassNameChange}
          onStyleChange={handleStyleChange}
        />
      ) : null}
      {visibleFields.map((field) => {
        const isHighlighted = highlightedFieldKeys?.has(field.key) === true;
        const groupTitle = field.catalogGroup;
        const showGroup = Boolean(groupTitle) && groupTitle !== lastCatalogGroup;
        if (groupTitle) {
          lastCatalogGroup = groupTitle;
        }
        return (
          <React.Fragment key={`prop:${field.key}`}>
            {showGroup ? (
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {groupTitle}
              </p>
            ) : null}
            <div
              data-inspector-field={field.key}
              data-inspector-field-match={isHighlighted ? 'true' : undefined}
              className={isHighlighted ? INSPECTOR_FIELD_HIGHLIGHT_CLASS : undefined}
            >
              <InspectorFieldControl
                node={node}
                document={document}
                bindingDefinitions={bindingDefinitions}
                field={field}
                setProp={setProp}
                dispatch={dispatch}
                breakpoint={breakpoint}
                catalogValues={catalogValues}
              />
            </div>
          </React.Fragment>
        );
      })}
      {paletteItemId === 'heroui.record-form' && isCatalogContent ? (
        <InspectorCrudSetColumnsField node={node} dispatch={dispatch} propPath="spec.columns" />
      ) : null}
    </div>
  );
};

