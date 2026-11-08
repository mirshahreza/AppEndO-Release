import * as React from 'react';
import { parseDesignerSheetData } from './visualizationDataModel';
import { MOCK_SHEET_DATA_JSON } from './visualizationMockFixtures';
import { readString } from './runtimeShared';
import { UiInput, UiSelect } from '../../shared/ui/HeroFieldControls';
import {
  compileDesignerConditionExpression,
  isSafeDesignerRuntimeExpression,
} from './visibilityConditionEngine';
import { executeDynamicActions, type DynamicActionRuntimeContext } from './bindingDynamicActionsRuntime';
import { createDynamicActionsEventBindingDefinition, resolveDynamicActions } from './bindingDynamicActionsEngine';
import type { DesignerBindingDefinitions, DesignerNode } from './types';
import type { VizWidgetResolveOptions } from './designerVizRuntimeResolve';
import { resolveBoundVizDataValue } from './designerVizRuntimeResolve';
import { renderDesignerVizDataState } from './designerVizDataState';

type RuntimeSheetColumn = ReturnType<typeof parseDesignerSheetData>['columns'][number];
type RuntimeSheetRow = ReturnType<typeof parseDesignerSheetData>['rows'][number];

const resolveSheetSourceData = (data: unknown, vizListBound?: boolean) => (
  data && (typeof data === 'string' ? data.length > 0 : true)
    ? data
    : (vizListBound ? { columns: [], rows: [] } : MOCK_SHEET_DATA_JSON)
);

const toFormulaExpression = (formula: string): string => {
  const trimmed = formula.trim();
  return trimmed.startsWith('=') ? trimmed.slice(1).trim() : trimmed;
};

const buildFormulaScope = (row: RuntimeSheetRow, columns: RuntimeSheetColumn[]): Record<string, unknown> =>
  columns.reduce<Record<string, unknown>>((acc, column) => {
    acc[column.key] = row[column.key];
    return acc;
  }, {});

const coerceSheetCellValue = (value: unknown, type: RuntimeSheetColumn['type']): unknown => {
  if (type === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value ?? '';
};

export const evaluateSheetFormulaValue = (
  formula: string,
  row: RuntimeSheetRow,
  columns: RuntimeSheetColumn[],
  designerStore: Record<string, unknown> = {},
): unknown => {
  const expression = toFormulaExpression(formula);
  if (!expression) {
    return '';
  }
  if (!isSafeDesignerRuntimeExpression(expression)) {
    return '';
  }
  try {
    const aliasPatched = columns.reduce((compiled, column) => (
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(column.key)
        ? compiled.replace(new RegExp(`\\b${column.key}\\b`, 'g'), `item?.${column.key}`)
        : compiled
    ), compileDesignerConditionExpression(expression).replace(/\brow\./g, 'item?.'));
    const evaluator = new Function(
      'designerStore',
      'dataContext',
      'item',
      'index',
      `return (${aliasPatched});`,
    ) as (
      designerStore: Record<string, unknown>,
      dataContext: Record<string, unknown> | null,
      item: RuntimeSheetRow,
      index: number,
    ) => unknown;
    return evaluator(designerStore, buildFormulaScope(row, columns), row, 0);
  } catch {
    return '';
  }
};

export const resolveSheetComputedRows = (
  rows: RuntimeSheetRow[],
  columns: RuntimeSheetColumn[],
  designerStore: Record<string, unknown> = {},
): RuntimeSheetRow[] => rows.map((row) => {
  const nextRow = { ...row };
  for (const column of columns) {
    if (column.type === 'formula' && column.formula) {
      nextRow[column.key] = evaluateSheetFormulaValue(column.formula, nextRow, columns, designerStore);
    } else if (!(column.key in nextRow)) {
      nextRow[column.key] = '';
    }
  }
  return nextRow;
});

export const executeSheetCellChangeActions = async (
  column: RuntimeSheetColumn,
  rowIndex: number,
  nextRow: RuntimeSheetRow,
  bindingDefinitions?: DesignerBindingDefinitions,
  dynamicActionRuntime?: DynamicActionRuntimeContext,
): Promise<void> => {
  if (!bindingDefinitions || !dynamicActionRuntime || !column.onCellChangeAction?.length) {
    return;
  }
  const resolved = resolveDynamicActions(
    createDynamicActionsEventBindingDefinition('onCellChange', column.onCellChangeAction),
    bindingDefinitions,
  );
  await executeDynamicActions(resolved, dynamicActionRuntime, new CustomEvent('onCellChange', {
    detail: {
      rowIndex,
      field: column.key,
      value: nextRow[column.key],
      row: nextRow,
    },
  }));
};

export const DesignerVizSheet: React.FC<{
  title?: string;
  data?: unknown;
  className?: string;
  style?: React.CSSProperties;
  vizListBound?: boolean;
  vizListLoading?: boolean;
  vizListError?: boolean;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
  toolbar?: React.ReactNode;
  bindingDefinitions?: DesignerBindingDefinitions;
  dynamicActionRuntime?: DynamicActionRuntimeContext;
}> = ({
  title = 'Spreadsheet',
  data,
  className,
  style,
  vizListBound,
  vizListLoading,
  vizListError,
  isLoading,
  emptyContent,
  errorContent,
  toolbar,
  bindingDefinitions,
  dynamicActionRuntime,
}) => {
  const sheet = React.useMemo(
    () => parseDesignerSheetData(resolveSheetSourceData(data, vizListBound)),
    [data, vizListBound],
  );
  const [rows, setRows] = React.useState(() => resolveSheetComputedRows(
    sheet.rows,
    sheet.columns,
    dynamicActionRuntime?.designerStore,
  ));

  // `dynamicActionRuntime` (and its `designerStore`) is a fresh object on most parent re-renders
  // (e.g. an unrelated visual-style className edit), not only on a genuine source-data change.
  // Resetting to `sheet.rows` on every such re-render silently discarded in-progress cell edits.
  // Only reset from the pristine source when `sheet` itself actually changed (new `data`/
  // `vizListBound`); otherwise recompute formula columns against the *current* (possibly
  // user-edited) rows so edits survive incidental re-renders.
  const previousSheetRef = React.useRef(sheet);
  React.useEffect(() => {
    if (previousSheetRef.current !== sheet) {
      previousSheetRef.current = sheet;
      setRows(resolveSheetComputedRows(sheet.rows, sheet.columns, dynamicActionRuntime?.designerStore));
      return;
    }
    setRows((prev) => resolveSheetComputedRows(prev, sheet.columns, dynamicActionRuntime?.designerStore));
  }, [sheet, dynamicActionRuntime?.designerStore]);

  const updateCell = async (rowIndex: number, column: RuntimeSheetColumn, rawValue: string) => {
    let changedRow: RuntimeSheetRow | null = null;
    setRows((prev) => {
      const nextRows = prev.map((row, index) => {
        if (index !== rowIndex) {
          return row;
        }
        const nextRow = { ...row, [column.key]: coerceSheetCellValue(rawValue, column.type) };
        changedRow = nextRow;
        return nextRow;
      });
      return resolveSheetComputedRows(nextRows, sheet.columns, dynamicActionRuntime?.designerStore);
    });
    if (changedRow) {
      await executeSheetCellChangeActions(column, rowIndex, changedRow, bindingDefinitions, dynamicActionRuntime);
    }
  };

  return (
    <div className={className} style={style} data-designer-component="viz.sheet">
      {title ? <h3 className="mb-2 ps-[4px] text-sm font-semibold text-slate-800">{title}</h3> : null}
      {toolbar}
      {renderDesignerVizDataState({
        isLoading: vizListLoading || isLoading,
        loadingMessage: 'Loading sheet…',
        hasError: vizListError,
        errorContent,
        isEmpty: vizListBound && rows.length === 0,
        emptyContent,
        children: (
        <div className="overflow-auto rounded-md border border-slate-200">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50">
                {sheet.columns.map((column) => (
                  <th key={column.key} className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {sheet.columns.map((column) => (
                    <td key={column.key} className="border border-slate-200 p-0">
                      {column.type === 'formula' ? (
                        <div className="flex h-8 min-w-[80px] items-center bg-slate-50 px-2 text-slate-700">
                          {String(row[column.key] ?? '')}
                        </div>
                      ) : column.type === 'select' ? (
                        <UiSelect
                          size="sm"
                          ariaLabel={column.header}
                          className="min-w-[80px] rounded-none border-0 bg-transparent"
                          value={String(row[column.key] ?? '')}
                          onChange={(event) => {
                            void updateCell(rowIndex, column, event.target.value);
                          }}
                        >
                          {(column.options ?? []).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </UiSelect>
                      ) : (
                        <UiInput
                          size="sm"
                          autoDir={false}
                          ariaLabel={column.header}
                          type={column.type === 'number' ? 'number' : 'text'}
                          className="min-w-[80px] rounded-none border-0 bg-transparent"
                          value={String(row[column.key] ?? '')}
                          onChange={(event) => {
                            void updateCell(rowIndex, column, event.target.value);
                          }}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ),
      })}
    </div>
  );
};

export const resolveSheetPropsFromNode = (
  node: DesignerNode,
  options: VizWidgetResolveOptions = {},
) => ({
  title: readString(node.props.title, 'Spreadsheet'),
  data: resolveBoundVizDataValue(node, MOCK_SHEET_DATA_JSON, options),
  className: readString(node.props.className, 'w-full'),
  vizListBound: options.vizListBound,
  vizListLoading: options.vizListLoading,
  vizListError: options.vizListError,
  isLoading: node.props.isLoading === true,
  emptyContent: readString(node.props.emptyContent),
  errorContent: readString(node.props.errorContent),
  toolbar: options.toolbar,
  bindingDefinitions: options.bindingDefinitions,
  dynamicActionRuntime: options.previewEvents?.patchStore
    ? {
      designerStore: options.designerStore ?? options.previewEvents.designerStore,
      patchStore: options.previewEvents.patchStore,
      refreshDataSource: options.previewEvents.refreshDataSource,
      navigate: options.previewEvents.navigate,
    }
    : undefined,
});
