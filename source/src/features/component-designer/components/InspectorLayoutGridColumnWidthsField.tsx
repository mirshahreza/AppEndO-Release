import * as React from 'react';
import type { DesignerAction, DesignerNode } from '../../../domain/component-designer/types';
import {
  LAYOUT_GRID_COLUMN_WIDTHS_PROP,
  LAYOUT_GRID_DIRECTION_PROP,
  resolveLayoutGridColumnWidthsForNode,
  resolveLayoutGridDirection,
  serializeLayoutGridColumnWidths,
  type LayoutGridColumnWidth,
  type LayoutGridColumnWidthUnit,
} from '../../../domain/component-designer/layoutGridColumnWidths';
import { resolveLayoutGridColumnCount } from '../../../domain/component-designer/layoutGridSlots';
import { UiInput, UiSelect } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';
import { resolveInspectorFieldHelp } from '../lib/designerInspectorHelp';
import {
  INSPECTOR_TEXT_2XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorLayoutGridColumnWidthsFieldProps = {
  node: DesignerNode;
  dispatch: React.Dispatch<DesignerAction>;
};

const UNIT_OPTIONS: Array<{ value: LayoutGridColumnWidthUnit; label: string }> = [
  { value: 'fr', label: 'fr' },
  { value: 'px', label: 'px' },
  { value: '%', label: '%' },
  { value: 'auto', label: 'auto' },
];

export const InspectorLayoutGridColumnWidthsField: React.FC<InspectorLayoutGridColumnWidthsFieldProps> = ({
  node,
  dispatch,
}) => {
  const columnCount = resolveLayoutGridColumnCount(node) ?? 2;
  const direction = resolveLayoutGridDirection(node.props);
  const [widths, setWidths] = React.useState<LayoutGridColumnWidth[]>(
    () => resolveLayoutGridColumnWidthsForNode(node),
  );

  React.useEffect(() => {
    setWidths(resolveLayoutGridColumnWidthsForNode(node));
  }, [node.id, node.props.className, node.props[LAYOUT_GRID_COLUMN_WIDTHS_PROP], node.props[LAYOUT_GRID_DIRECTION_PROP], columnCount]);

  const commitWidths = React.useCallback((nextWidths: LayoutGridColumnWidth[]) => {
    setWidths(nextWidths);
    dispatch({
      type: 'set-node-prop',
      nodeId: node.id,
      key: LAYOUT_GRID_COLUMN_WIDTHS_PROP,
      value: serializeLayoutGridColumnWidths(nextWidths),
    });
  }, [dispatch, node.id]);

  const updateWidth = React.useCallback((index: number, patch: Partial<LayoutGridColumnWidth>) => {
    const nextWidths = widths.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...patch } : entry
    ));
    commitWidths(nextWidths);
  }, [commitWidths, widths]);

  if (direction === 'column') {
    return (
      <p className={`ps-[4px] ${INSPECTOR_TEXT_2XS} leading-relaxed text-slate-500`}>
        Column sizes apply in Row direction. Switch Direction to Row to set individual column widths.
      </p>
    );
  }

  return (
    <DesignerFieldRow label="Column Sizes" layout="stack" help={resolveInspectorFieldHelp(LAYOUT_GRID_COLUMN_WIDTHS_PROP)}>
      <div className="space-y-2">
        {widths.slice(0, columnCount).map((column, index) => (
          <div
            key={`${node.id}:layout-column-width:${index}`}
            className={`grid grid-cols-[minmax(0,4.5rem)_minmax(0,1fr)_minmax(0,4.5rem)] items-center gap-1.5 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}
          >
            <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} font-bold uppercase tracking-[0.08em] text-slate-500`}>
              Col {index + 1}
            </span>
            <UiInput
              size="sm"
              nested
              className="min-w-0"
              type="number"
              min={column.unit === 'fr' ? 0.1 : 0}
              step={column.unit === 'fr' ? 0.1 : 1}
              placeholder={column.unit === 'auto' ? 'auto' : '1'}
              value={column.unit === 'auto' ? '' : column.value}
              disabled={column.unit === 'auto'}
              onChange={(event) => updateWidth(index, { value: event.target.value })}
              ariaLabel={`Column ${index + 1} size`}
            />
            <UiSelect
              size="sm"
              nested
              className="min-w-0"
              value={column.unit}
              onChange={(event) => {
                const unit = event.target.value as LayoutGridColumnWidthUnit;
                updateWidth(index, {
                  unit,
                  value: unit === 'auto' ? '' : (widths[index]?.value || '1'),
                });
              }}
              ariaLabel={`Column ${index + 1} unit`}
            >
              {UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </UiSelect>
          </div>
        ))}
        <p className={`ps-[4px] ${INSPECTOR_TEXT_2XS} leading-relaxed text-slate-500`}>
          Use fr for flexible columns, px or % for fixed sizes. Change Grid Columns above to add or remove columns.
        </p>
      </div>
    </DesignerFieldRow>
  );
};
