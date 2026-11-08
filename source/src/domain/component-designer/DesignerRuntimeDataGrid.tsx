import * as React from 'react';
import {
  applyClientGridQuery,
  EMPTY_GRID_QUERY,
  sanitizeGridQuery,
  type AppTableGridColumnDef,
  type GridQueryState,
} from '../../shared/lib/appTableGridQuery';
import { AppTableGrid, GridPagingFooter } from '../../shared/ui';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
} from '../../shared/ui/surfaceClasses';
import { DesignerGridBulkActionsBar } from './designerGridBulkActionsBar';
import {
  DEFAULT_GRID_SELECTION_STORE_PATH,
  readSelectedKeysFromStore,
} from './designerGridSelectionRuntime';
import { parseDesignerGridToolbarConfig } from './designerGridToolbarConfig';
import { parseGridDetailFlowConfig } from './bindingGridDetailEngine';
import { getNodeGridListResourceBinding } from './bindingGridEngine';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { readNestedContextValue } from './bindingResourceModel';
import { DesignerDataGridTable } from './DesignerDataGridTable';
import {
  formatPreviewCultureScalar,
  inferGridColumnPreviewKind,
  type PreviewCultureFormatOptions,
} from './previewCultureFormatting';
import {
  buildDataGridPageNumbers,
  resolveDataGridPagingConfig,
  resolveDataGridScrollContainerStyle,
  resolveDataGridTotalCount,
  resolveDesignerDataGridShellStyle,
  resolveGridColumnWidth,
  shouldUseDesignerDataGridContainedScroll,
  sliceDataGridRowsForDisplay,
  type DataGridQueryMode,
} from './designerDataGridRuntime';
import {
  createDefaultGridRowAction,
  isActionGridColumn,
  MOCK_DESIGNER_DATA_GRID_ROWS,
  parseDesignerDataGridColumns,
  resolveActionGridColumnId,
  type DesignerDataGridColumn,
} from './designerDataGridColumns';
import { DesignerGridIconActionCell } from './designerGridActionRuntime';
import { DesignerGridInlineEditCell } from './designerGridInlineEditCell';
import type { DynamicActionRuntimeContext } from './bindingDynamicActionsRuntime';
import type { DesignerBindingDefinitions, DesignerNode } from './types';
import { getNodePaletteItemId, mergeClassNames, readBoolean, readString, wrapDesignerChildSlot } from './runtimeShared';
import type { RuntimeRenderMode, RuntimeRenderOptions } from './runtimeTypes';

const designInteractionClass = (mode: RuntimeRenderMode, allowRowActions = false): string | undefined =>
  mode === 'design'
    ? allowRowActions
      ? 'pointer-events-none [&_thead]:pointer-events-auto [&_tbody_button]:pointer-events-auto'
      : 'pointer-events-none [&_thead]:pointer-events-auto'
    : undefined;

type DesignerRuntimeDataGridProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions & {
    className?: string;
    children?: React.ReactNode;
  };
};

type DesignerGridRow = Record<string, unknown> & {
  __designerRowKey: string;
};

const readPageFromStore = (
  designerStore: Record<string, unknown> | undefined,
  pageStorePath: string,
): number | undefined => {
  if (!designerStore) {
    return undefined;
  }

  const value = readNestedContextValue(designerStore, pageStorePath);
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
};

const buildAppTableGridColumns = (
  columns: DesignerDataGridColumn[],
  gridQueryMode: DataGridQueryMode,
  options: {
    mode: RuntimeRenderMode;
    detailFlow: ReturnType<typeof parseGridDetailFlowConfig>;
    rowActionHandler?: (row: Record<string, unknown>, actionId: string) => void;
    cultureFormat?: PreviewCultureFormatOptions;
    bindingDefinitions?: DesignerBindingDefinitions;
    dynamicActionRuntime?: DynamicActionRuntimeContext;
  },
): AppTableGridColumnDef<DesignerGridRow>[] =>
  columns.map((column) => {
    if (isActionGridColumn(column)) {
      const actionId = resolveActionGridColumnId(column);
      const label = column.label || 'Details';
      const canInvoke = Boolean(options.rowActionHandler) || Boolean(options.detailFlow);
      const allowDesignInvoke = options.mode !== 'design' || Boolean(options.rowActionHandler);
      // Same action definition/behavior model App Table Grid uses (icon, intent, on-click
      // behavior — none/detail-flow/open-modal — configured via InspectorGridActionColumnFields),
      // now shared by Data Grid too so the "on click" picker actually has a real effect here.
      const actionDefinition = createDefaultGridRowAction(actionId, {
        icon: column.actionIcon ?? 'Eye',
        intent: column.actionIntent ?? 'view',
        tooltip: column.actionTooltip ?? label,
        label,
        ...(column.actionBehavior ? { behavior: column.actionBehavior } : {}),
      });

      return {
        id: column.key,
        label,
        sort: false,
        filter: false,
        width: resolveGridColumnWidth(column.width),
        layout: {
          hideable: column.layoutHideable !== false,
          resizable: column.layoutResizable !== false,
          reorderable: column.layoutReorderable !== false,
          ...(column.layoutPinned === 'left' || column.layoutPinned === 'right'
            ? { pinned: column.layoutPinned }
            : {}),
        },
        headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
        cellClassName: APP_TABLE_GRID_ACTION_CELL_CLASS,
        renderCell: (row) => (
          <DesignerGridIconActionCell
            action={actionDefinition}
            label={label}
            display={column.actionDisplay === 'icon' ? 'icon' : 'button'}
            context={{
              mode: options.mode,
              canInvoke,
              allowDesignInvoke,
              onInvoke: (invokedActionId) => {
                if (!canInvoke || (options.mode === 'design' && !options.rowActionHandler)) {
                  return;
                }
                options.rowActionHandler?.(row, invokedActionId);
              },
            }}
          />
        ),
      };
    }

    return {
      id: column.key,
      label: column.label,
      width: resolveGridColumnWidth(column.width),
      layout: {
        hideable: column.layoutHideable !== false,
        resizable: column.layoutResizable !== false,
        reorderable: column.layoutReorderable !== false,
        ...(column.layoutPinned === 'left' || column.layoutPinned === 'right'
          ? { pinned: column.layoutPinned }
          : {}),
      },
      sort: column.sort ? { mode: gridQueryMode } : false,
      filter: column.filter ? { mode: gridQueryMode, type: 'text' as const } : false,
      getSortValue: (row) => row[column.key] as string | number | boolean | null | undefined,
      getFilterValue: (row) => row[column.key] as string | number | boolean | null | undefined,
      renderCell: (row) => {
        if (column.editable === true) {
          return (
            <DesignerGridInlineEditCell
              column={column}
              row={row}
              rowKey={row.__designerRowKey}
              mode={options.mode === 'design' ? 'design' : 'runtime'}
              bindingDefinitions={options.bindingDefinitions}
              runtime={options.dynamicActionRuntime}
            />
          );
        }
        const rawValue = row[column.key];
        if (options.cultureFormat) {
          const kind = inferGridColumnPreviewKind(rawValue);
          return formatPreviewCultureScalar(rawValue, options.cultureFormat, kind) ?? '';
        }
        return String(rawValue ?? '');
      },
    };
  });

export const DesignerRuntimeDataGrid: React.FC<DesignerRuntimeDataGridProps> = ({
  node,
  options,
}) => {
  const columns = parseDesignerDataGridColumns(node.props.columns);
  const pagingConfig = resolveDataGridPagingConfig(node);
  const isHeaderSticky = readBoolean(node.props.isHeaderSticky);
  const isStriped = readBoolean(node.props.isStriped);
  const isLoading = readBoolean(node.props.isLoading);
  const emptyContent = readString(node.props.emptyContent, 'No records found');
  const errorContent = readString(node.props.errorContent, 'Could not load records');
  const gridQueryMode = pagingConfig.gridQueryMode;
  const mockEvents = resolveCanvasMockEventProps(node);
  const previewHandlers = options.previewEvents
    ? resolveCanvasPreviewEventProps(node, {
      ...options.previewEvents,
      document: options.previewEvents.document,
      bindingDefinitions: options.previewEvents.bindingDefinitions,
    })
    : {};
  const detailFlow = parseGridDetailFlowConfig(node);
  const rowActionHandler = options.onGridRowAction;
  const tableInteractionClass = designInteractionClass(options.mode, Boolean(rowActionHandler));

  const hydratedRows = options.gridRows;
  const fallbackRows = MOCK_DESIGNER_DATA_GRID_ROWS;
  const allRows = (options.gridListBound
    ? (hydratedRows ?? [])
    : (hydratedRows && hydratedRows.length > 0 ? hydratedRows : fallbackRows)) as Array<Record<string, unknown>>;
  const showErrorState = options.gridListBound
    && !isLoading
    && options.gridListError === true
    && errorContent.trim().length > 0;

  const gridBinding = getNodeGridListResourceBinding(node);
  const pageStorePath = gridBinding?.dataPath?.trim() || 'gridQuery.page';
  const storePage = readPageFromStore(options.designerStore, pageStorePath);

  const [localPage, setLocalPage] = React.useState(() => storePage ?? pagingConfig.page);
  const [query, setQuery] = React.useState<GridQueryState>(EMPTY_GRID_QUERY);

  React.useEffect(() => {
    setLocalPage(storePage ?? pagingConfig.page);
  }, [node.id, pagingConfig.page, pagingConfig.pageSize, storePage]);

  const dynamicActionRuntime = React.useMemo((): DynamicActionRuntimeContext | undefined => {
    if (!options.previewEvents?.patchStore) {
      return undefined;
    }
    return {
      designerStore: options.designerStore ?? {},
      patchStore: options.previewEvents.patchStore,
      refreshDataSource: options.previewEvents.refreshDataSource,
      navigate: options.previewEvents.navigate,
    };
  }, [
    options.designerStore,
    options.previewEvents?.navigate,
    options.previewEvents?.patchStore,
    options.previewEvents?.refreshDataSource,
  ]);

  const gridColumns = React.useMemo(
    () => buildAppTableGridColumns(columns, gridQueryMode, {
      mode: options.mode,
      detailFlow,
      rowActionHandler,
      cultureFormat: options.previewCultureFormat,
      bindingDefinitions: options.bindingDefinitions ?? options.previewEvents?.bindingDefinitions,
      dynamicActionRuntime,
    }),
    [
      columns,
      detailFlow,
      dynamicActionRuntime,
      gridQueryMode,
      options.bindingDefinitions,
      options.mode,
      options.previewCultureFormat,
      options.previewEvents?.bindingDefinitions,
      rowActionHandler,
    ],
  );

  const sanitizedQuery = React.useMemo(
    () => sanitizeGridQuery(query, gridColumns, gridQueryMode),
    [gridColumns, gridQueryMode, query],
  );

  const filteredRows = React.useMemo(
    () => applyClientGridQuery(allRows, sanitizedQuery, gridColumns, gridQueryMode),
    [allRows, gridColumns, gridQueryMode, sanitizedQuery],
  );

  const querySignature = React.useMemo(
    () => JSON.stringify(sanitizedQuery),
    [sanitizedQuery],
  );

  React.useEffect(() => {
    setLocalPage(1);
  }, [querySignature, pagingConfig.pageSize]);

  const totalCount = resolveDataGridTotalCount(pagingConfig, filteredRows.length);
  const { displayRows, safePage, totalPages } = sliceDataGridRowsForDisplay(
    filteredRows,
    localPage,
    pagingConfig.pageSize,
    totalCount,
    gridQueryMode,
  );
  const pageNumbers = buildDataGridPageNumbers(safePage, totalPages);
  const containedScroll = shouldUseDesignerDataGridContainedScroll(isHeaderSticky);
  const shellStyle = resolveDesignerDataGridShellStyle(options.style);
  const footerSortField = columns.find((column) => column.sort)?.key ?? columns[0]?.key ?? 'id';

  const keyedRows = React.useMemo(
    () => displayRows.map((row, index) => ({
      ...row,
      __designerRowKey: String(row.id ?? `page-${safePage}-row-${index}`),
    })),
    [displayRows, safePage],
  );

  const handleQueryChange = React.useCallback((nextQuery: GridQueryState) => {
    setQuery(nextQuery);
  }, []);

  const handlePageChange = React.useCallback((nextPage: number) => {
    const normalizedPage = Math.max(1, Math.min(nextPage, totalPages));
    setLocalPage(normalizedPage);

    if (options.mode !== 'runtime') {
      return;
    }

    const previewHandler = previewHandlers.onPageChange;
    if (previewHandler) {
      previewHandler({ target: { value: String(normalizedPage) } } as unknown as Event);
      return;
    }

    if (mockEvents.onPageChange) {
      mockEvents.onPageChange({ target: { value: String(normalizedPage) } } as unknown as Event);
      return;
    }

    options.previewEvents?.patchStore(pageStorePath, normalizedPage);
  }, [
    mockEvents.onPageChange,
    options.mode,
    options.previewEvents,
    pageStorePath,
    previewHandlers.onPageChange,
    totalPages,
  ]);

  const designerComponentId = getNodePaletteItemId(node) ?? 'heroui.data-grid';
  const selectionModeRaw = readString(node.props.selectionMode, 'none');
  const selectionMode = selectionModeRaw === 'single' || selectionModeRaw === 'multiple'
    ? selectionModeRaw
    : 'none';
  const toolbarConfig = React.useMemo(
    () => parseDesignerGridToolbarConfig(node.props.toolbarConfig),
    [node.props.toolbarConfig],
  );
  const selectionStorePath = toolbarConfig?.selectionStorePath?.trim()
    || readString(node.props.selectionStorePath, DEFAULT_GRID_SELECTION_STORE_PATH);
  const storeSelectedKeys = readSelectedKeysFromStore(options.designerStore, selectionStorePath);
  const [localSelectedKeys, setLocalSelectedKeys] = React.useState<string[]>(storeSelectedKeys);
  React.useEffect(() => {
    setLocalSelectedKeys(storeSelectedKeys);
  }, [storeSelectedKeys.join('|')]);
  const handleSelectionChange = React.useCallback((keys: string[]) => {
    setLocalSelectedKeys(keys);
    options.previewEvents?.patchStore?.(selectionStorePath, keys);
    const selectionHandler = (previewHandlers as { onSelectionChange?: (event: Event) => void }).onSelectionChange
      ?? (mockEvents as { onSelectionChange?: (event: Event) => void }).onSelectionChange;
    selectionHandler?.({ target: { value: keys.join(',') } } as unknown as Event);
  }, [mockEvents, options.previewEvents, previewHandlers, selectionStorePath]);
  const bulkActions = toolbarConfig?.bulkActions ?? [];
  const previewBindingDefinitions = options.bindingDefinitions ?? options.previewEvents?.bindingDefinitions;
  const bulkBar = options.mode !== 'design'
    && selectionMode !== 'none'
    && bulkActions.length > 0
    && localSelectedKeys.length > 0
    && previewBindingDefinitions
    && dynamicActionRuntime
    ? (
      <DesignerGridBulkActionsBar
        bulkActions={bulkActions}
        selectedKeys={localSelectedKeys}
        bindingDefinitions={previewBindingDefinitions}
        runtime={dynamicActionRuntime}
        selectionStorePath={selectionStorePath}
      />
    )
    : null;

  return (
    <div
      className={mergeClassNames('relative z-0 flex min-h-0 w-full flex-col', options.className)}
      style={shellStyle}
      data-designer-component={designerComponentId}
    >
      {bulkBar}
      <div className={mergeClassNames('min-h-0 w-full flex-1', tableInteractionClass)}>
        {isLoading ? (
          <div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            Loading records…
          </div>
        ) : showErrorState ? (
          <div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-rose-200 bg-rose-50 px-4 text-sm text-rose-700">
            {errorContent}
          </div>
        ) : selectionMode !== 'none' ? (
          <AppTableGrid
            persistListKey={`designer-datagrid:${node.id}`}
            columns={gridColumns}
            rows={keyedRows}
            getRowKey={(row) => row.__designerRowKey}
            gridQueryMode={gridQueryMode}
            query={query}
            onQueryChange={handleQueryChange}
            selectionMode={selectionMode}
            selectedKeys={localSelectedKeys}
            onSelectionChange={options.mode === 'design' ? undefined : handleSelectionChange}
            emptyMessage={emptyContent}
            isEmpty={keyedRows.length === 0}
            presentation="auto"
          />
        ) : (
          <DesignerDataGridTable
            columns={gridColumns}
            rows={keyedRows}
            getRowKey={(row) => row.__designerRowKey}
            gridQueryMode={gridQueryMode}
            emptyMessage={emptyContent}
            isStriped={isStriped}
            containedScroll={containedScroll}
            maxHeight={resolveDataGridScrollContainerStyle(isHeaderSticky, options.style)?.maxHeight ?? '20rem'}
            query={query}
            onQueryChange={handleQueryChange}
            skipClientQuery
          />
        )}
      </div>

      <GridPagingFooter
        totalCount={totalCount}
        safePage={safePage}
        pageSize={pagingConfig.pageSize}
        onPageSizeChange={() => {}}
        sortBy={footerSortField}
        sortOptions={[]}
        onSortByChange={() => {}}
        sortDirection={sanitizedQuery.sort?.direction ?? 'asc'}
        onToggleSortDirection={() => {}}
        showSortControls={false}
        totalPages={totalPages}
        pageNumbers={pageNumbers}
        onPageChange={handlePageChange}
      />
      {options.children ? wrapDesignerChildSlot(options.children, options.mode) : null}
    </div>
  );
};
