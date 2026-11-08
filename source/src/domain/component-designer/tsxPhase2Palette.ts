import { resolveBoundEventAttribute, resolveNodePropertyBindingExpression, resolveToolbarLovFilterOptionsExpression, tsxBindingRawExpr } from './bindingCodegen';
import { regionColumnToExpression } from './bindingRegionEngine';
import type { TsxBindingRenderContext } from './bindingCodegen';
import { resolveEntityPickerConfig } from './bindingEntityPickerCodegen';
import { sanitizeDesignerHtml } from './sanitizeDesignerHtml';
import { renderDesignerRichTextToolbarJsxProps, DESIGNER_RICH_TEXT_TOOLBAR_PROP_KEYS } from '../../shared/lib/designerRichTextConfig';
import { resolveGridDetailRowActionHandlerName } from './bindingGridDetailEngine';
import {
  isActionGridColumn,
  MOCK_DESIGNER_DATA_GRID_ROWS,
  parseDesignerDataGridColumns,
  parseDesignerGridSortOptions,
  resolveActionGridColumnId,
  resolveAppTableGridVarNames,
} from './designerDataGridColumns';
import {
  normalizeDesignerGridToolbarConfig,
  parseDesignerGridToolbarConfig,
  fieldFilterSupportsMatchLogic,
  resolveEffectiveFieldFilters,
  resolveFieldFilterStaticOptions,
} from './designerGridToolbarConfig';
import { DEFAULT_FILTER_MATCH_LOGIC } from '../../shared/lib/filterMatchLogic';
import { resolveEffectiveAppTableGridQueryMode } from './designerDataGridRuntime';
import {
  GRID_COMPACT_DESIGNER_PROP_KEYS,
  parseGridCompactFromProps,
  serializeGridCompactJsx,
} from '../../shared/lib/gridCompactViewport';
import { sanitizeGridCardBelow } from '../../shared/lib/appTableGridPresentation';
import { resolveAppTableGridSizeFromDensity } from '../../shared/lib/appTableGridDensity';
import { DESIGNER_STORE_PATCH_VAR, DESIGNER_STORE_VAR } from './bindingStoreCodegen';
import { visibilityStorePathForNode } from './bindingDynamicActionsEngine';
import { adaptPaginationOnPageChangeAttr } from './tsxParityPalette';
import type { DesignerDocument, DesignerNode } from './types';
import { getNodePaletteItemId, readBoolean, readNumber, readString } from './runtimeShared';
import { appTableGridNodeUsesCultureKeys } from './designerGridCultureKeys';
import { readUiDockPaneDock } from '../../shared/ui/UiDockPane';
import { parseRecordFormColumns } from './crudSetSpec';
import {
  buildNodeJsxAttributesWithBindings,
  escapeJsxTextContent,
  indentJsxBlock,
  renderNodeJsxAttributes,
} from './tsxPropMapper';

const toJsxString = (value: unknown, fallback = ''): string =>
  JSON.stringify(typeof value === 'string' ? value : fallback);

const resolveGridCultureTextExpr = (
  node: DesignerNode,
  translationKeyProp: string,
  literal: string,
): string => {
  const key = readString(node.props[translationKeyProp], '').trim();
  if (key && appTableGridNodeUsesCultureKeys(node)) {
    return `culture.t(${JSON.stringify(key)})`;
  }
  return JSON.stringify(literal);
};

/**
 * Inspector fields that appear on Designer form-field widgets but are NOT accepted by the
 * shared Designer*Field components (Monaco / rich-text / color / mask / calculator). Leaving
 * them in the generic attrs pass makes exported TSX fail `tsc` (parity audit items 43/62).
 * `isInvalid`/`errorMessage`/`description` ARE accepted and must stay.
 */
const DESIGNER_FORM_FIELD_UNSUPPORTED_EXPORT_KEYS = [
  'pattern',
  'minLength',
  'maxLength',
  'validationRule',
  'validationErrorMessage',
  'startContent',
  'endContent',
  'isClearable',
  'autoFocus',
  'size',
  'inputMode',
] as const;

const renderAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  options: Parameters<typeof renderNodeJsxAttributes>[1] = {},
): string => (bindingContext
  ? buildNodeJsxAttributesWithBindings(node, bindingContext, options)
  : renderNodeJsxAttributes(node, options));

const sanitizeHandlerSuffix = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, '_');

const renderActionCellJsx = (
  columnKey: string,
  label: string,
  actionId: string,
  handlerName: string,
): string => (
  `<Table.Cell key=${toJsxString(columnKey)}>`
  + `<button type="button" className="inline-flex h-7 items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100" onClick={() => { void ${handlerName}(item as Record<string, unknown>, ${toJsxString(actionId)}); }}>`
  + `${label}`
  + '</button>'
  + '</Table.Cell>'
);

export const renderDataGridCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const columns = parseDesignerDataGridColumns(node.props.columns);
  const gridQueryMode = readString(node.props.gridQueryMode, 'client');
  const pageSize = readNumber(node.props.pageSize, 15);
  const page = readNumber(node.props.page, 1);
  const total = readNumber(node.props.total, MOCK_DESIGNER_DATA_GRID_ROWS.length);
  const rowsBinding = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'rows', bindingContext)
    : null;
  const rowActionHandler = resolveGridDetailRowActionHandlerName(node.id);

  // Bug found (parity audit item 12): `isLoading`/`emptyContent`/`errorContent`/`isHeaderSticky`
  // are all real, working Inspector fields — the live canvas/interactive Preview
  // (DesignerRuntimeDataGrid.tsx) shows a loading placeholder, an error panel, an inline empty
  // row, and applies a max-height/scroll style for the sticky header respectively — but Export
  // never read any of them at all, and (since none were excluded from the generic attrs pass)
  // they leaked onto the real `<Table>` root as unknown, untyped JSX attributes.
  const isLoadingLiteral = readBoolean(node.props.isLoading);
  const isHeaderSticky = readBoolean(node.props.isHeaderSticky);
  const emptyContentText = readString(node.props.emptyContent, 'No records found');
  const errorContentText = readString(node.props.errorContent, 'Could not load records');
  const gridFetch = bindingContext?.plan.gridPlan.gridListFetches.find((entry) => entry.nodeId === node.id);
  const errorExpr = gridFetch ? `Boolean(error_${gridFetch.dataVar})` : null;

  const tableAttrs = renderAttrs(node, bindingContext, {
    excludeKeys: new Set([
      'columns', 'gridQueryMode', 'pageSize', 'page', 'total', 'rows',
      'isLoading', 'emptyContent', 'errorContent', 'isHeaderSticky',
    ]),
    reservedAttributes: {
      gridQueryMode,
      pageSize,
      page,
      total,
      isStriped: readBoolean(node.props.isStriped),
    },
  });

  const sortChangeAttr = bindingContext
    ? resolveBoundEventAttribute(node.id, 'onSortChange', bindingContext)
    : '';

  // Bug found: the footer's Previous/Next buttons had no `onPress` at all (inert in the
  // published app — clicking them did nothing), the bound `onPageChange` was attached to the
  // `<Pagination>` root (a prop the real component doesn't have), and the active-page link was
  // hardcoded to the literal "1" regardless of the grid's actual page. Reuse the exact same
  // fix already proven correct for the standalone `heroui.pagination` element.
  const { previousProps, nextProps } = adaptPaginationOnPageChangeAttr(
    '',
    node.id,
    page,
    total,
    bindingContext,
  );

  const headerColumns = columns
    .map((column) => {
      const sortAttr = column.sort && !isActionGridColumn(column) ? ' allowsSorting' : '';
      return `<Table.Column id=${toJsxString(column.key)}${sortAttr}>${column.label}</Table.Column>`;
    })
    .join('\n');

  const staticRows = MOCK_DESIGNER_DATA_GRID_ROWS.map((row) => {
    const cells = columns.map((column) => {
      if (isActionGridColumn(column)) {
        return `<Table.Cell><span className="text-[11px] text-slate-400">${column.label}</span></Table.Cell>`;
      }
      return `<Table.Cell>${row[column.key] ?? ''}</Table.Cell>`;
    }).join('');
    return `<Table.Row id=${toJsxString(String(row.id))}>${cells}</Table.Row>`;
  }).join('\n');

  const dataColumnKeys = columns.filter((column) => !isActionGridColumn(column)).map((column) => column.key);
  const actionColumns = columns.filter((column) => isActionGridColumn(column));

  const dynamicCells = [
    ...dataColumnKeys.map((columnKey) => (
      `<Table.Cell key={${toJsxString(columnKey)}}>{String((item as Record<string, unknown>)[${toJsxString(columnKey)}] ?? "")}</Table.Cell>`
    )),
    ...actionColumns.map((column) => renderActionCellJsx(
      column.key,
      column.label,
      resolveActionGridColumnId(column),
      rowActionHandler,
    )),
  ].join('');

  const colSpan = Math.max(columns.length, 1);
  const emptyRowJsx = `<Table.Row id="__empty__"><Table.Cell colSpan={${colSpan}}><span className="block py-6 text-center text-sm text-slate-500">${escapeJsxTextContent(emptyContentText)}</span></Table.Cell></Table.Row>`;

  const bodyContent = rowsBinding
    ? `{(${rowsBinding} ?? []).length === 0 ? (<Table.Body>${emptyRowJsx}</Table.Body>) : (<Table.Body items={${rowsBinding} ?? []}>{(item) => (<Table.Row id={String((item as Record<string, unknown>).id ?? "")}>${dynamicCells}</Table.Row>)}</Table.Body>)}`
    : (MOCK_DESIGNER_DATA_GRID_ROWS.length === 0
      ? `<Table.Body>${emptyRowJsx}</Table.Body>`
      : `<Table.Body>${staticRows}</Table.Body>`);

  const rowActionAttr = actionColumns.length > 0
    ? ` onGridRowAction={${rowActionHandler}}`
    : '';

  // Bug found (parity audit item 12, continued): `isHeaderSticky`/`isLoading`/`errorContent`
  // aren't real props on the actual `@heroui/react` Table components at all (confirmed against
  // their type defs) — the live canvas/Preview instead uses them to drive its OWN wrapper
  // markup (a placeholder div for loading/error, a max-height scroll style for sticky). Mirror
  // that exact wrapper approach here instead of passing them through as component props.
  const scrollContainerStyleAttr = isHeaderSticky ? ' style={{ maxHeight: "20rem", overflowY: "auto" }}' : '';
  const tableBlock = `<Table${tableAttrs}${sortChangeAttr}${rowActionAttr}><Table.ScrollContainer${scrollContainerStyleAttr}><Table.Content><Table.Header>${headerColumns}</Table.Header>${bodyContent}</Table.Content></Table.ScrollContainer></Table>`;
  const loadingBlock = '<div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">Loading records…</div>';
  const errorBlock = `<div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-rose-200 bg-rose-50 px-4 text-sm text-rose-700">${escapeJsxTextContent(errorContentText)}</div>`;

  const gridArea = isLoadingLiteral
    ? loadingBlock
    : errorExpr
      ? `{${errorExpr} ? (${errorBlock}) : (${tableBlock})}`
      : tableBlock;

  return `<div className="flex w-full flex-col gap-2">${gridArea}<Pagination><Pagination.Summary>Page ${page} · ${pageSize} per page · ${total} total (${gridQueryMode})</Pagination.Summary><Pagination.Content><Pagination.Item><Pagination.Previous${previousProps} /></Pagination.Item><Pagination.Item><Pagination.Link isActive>${page}</Pagination.Link></Pagination.Item><Pagination.Item><Pagination.Next${nextProps} /></Pagination.Item></Pagination.Content></Pagination></div>`;
};

const resolveAppTableGridRefreshCallExpression = (
  nodeId: string,
  bindingContext: TsxBindingRenderContext,
): string => {
  const gridFetch = bindingContext.plan.gridPlan.gridListFetches.find((entry) => entry.nodeId === nodeId);
  return gridFetch ? `void refresh_${gridFetch.dataVar}();` : '';
};

export const renderCrudSetCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const specRaw = typeof node.props.spec === 'string' && node.props.spec.trim().length > 0
    ? node.props.spec.trim()
    : JSON.stringify(node.props.spec ?? {});
  const rowsBinding = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'rows', bindingContext)
    : null;
  const rowsExpr = rowsBinding ?? '[]';
  const gridFetch = bindingContext?.plan.gridPlan.gridListFetches.find((entry) => entry.nodeId === node.id);
  const loadingExpr = gridFetch ? `Boolean(isLoading_${gridFetch.dataVar})` : 'false';
  const errorExpr = gridFetch ? `Boolean(error_${gridFetch.dataVar})` : 'false';
  const refreshExpr = gridFetch
    ? `() => { void refresh_${gridFetch.dataVar}(); }`
    : 'undefined';
  const className = readString(node.props.className, 'flex h-full min-h-0 w-full flex-1 flex-col');

  return [
    `<CrudSet`,
    `  className=${JSON.stringify(className)}`,
    `  spec={${specRaw}}`,
    `  rows={(Array.isArray(${rowsExpr}) ? ${rowsExpr} : []) as Record<string, unknown>[]}`,
    `  isLoading={${loadingExpr}}`,
    `  isError={${errorExpr}}`,
    `  onRefresh={${refreshExpr}}`,
    `  onCreate={async (create, values) => {`,
    `    const response = await fetch(create.endpointId, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });`,
    `    if (!response.ok) { throw new Error('Create failed.'); }`,
    `  }}`,
    `  onPatch={async (patch, row, values) => {`,
    `    const id = row.id == null ? '' : encodeURIComponent(String(row.id));`,
    `    const url = /:[a-zA-Z_][a-zA-Z0-9_]*/.test(patch.endpointId) ? patch.endpointId.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/, id) : \`\${patch.endpointId.replace(/\\/+$/, '')}/\${id}\`;`,
    `    const response = await fetch(url, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });`,
    `    if (!response.ok) { throw new Error('Update failed.'); }`,
    `  }}`,
    `  onDelete={async (row) => {`,
    `    const endpoint = ${JSON.stringify('')};`,
    `    const spec = ${specRaw} as { deleteApi?: { endpointId?: string } };`,
    `    const template = spec.deleteApi?.endpointId ?? endpoint;`,
    `    if (!template) { return; }`,
    `    const id = row.id == null ? '' : encodeURIComponent(String(row.id));`,
    `    const url = /:[a-zA-Z_][a-zA-Z0-9_]*/.test(template) ? template.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/, id) : \`\${template.replace(/\\/+$/, '')}/\${id}\`;`,
    `    const response = await fetch(url, { method: 'DELETE', credentials: 'include' });`,
    `    if (!response.ok) { throw new Error('Delete failed.'); }`,
    `  }}`,
    `/>`,
  ].join('\n');
};

export const renderRecordFormCustomJsx = (node: DesignerNode): string => {
  const columns = parseRecordFormColumns(node.props.spec);
  const mode = readString(node.props.mode, 'edit');
  const sidePanelTitle = readString(node.props.sidePanelTitle, 'Flags') || 'Flags';
  const sidePanelPlacement = readString(node.props.sidePanelPlacement, 'end') || 'end';
  const sidePanelPinnable = node.props.sidePanelPinnable === true || node.props.sidePanelPinnable === 'true';
  const sidePanelSplitter = node.props.sidePanelSplitter !== false && node.props.sidePanelSplitter !== 'false';
  const sidePanelShowTitle = node.props.sidePanelShowTitle !== false && node.props.sidePanelShowTitle !== 'false';
  const sidePanelTitleInHeader = node.props.sidePanelTitleInHeader === true
    || node.props.sidePanelTitleInHeader === 'true';
  const sidePanelBackground = readString(node.props.sidePanelBackground, 'theme') || 'theme';
  const sidePanelBackgroundColor = readString(node.props.sidePanelBackgroundColor, '#F1F5F9')
    || '#F1F5F9';
  const fields = columns.map((column) => column.field);

  return [
    `<RecordForm`,
    `  mode=${JSON.stringify(mode)}`,
    `  sidePanelTitle=${JSON.stringify(sidePanelTitle)}`,
    `  sidePanelPlacement=${JSON.stringify(sidePanelPlacement)}`,
    `  sidePanelPinnable={${sidePanelPinnable}}`,
    `  sidePanelSplitter={${sidePanelSplitter}}`,
    `  sidePanelShowTitle={${sidePanelShowTitle}}`,
    `  sidePanelTitleInHeader={${sidePanelTitleInHeader}}`,
    `  sidePanelBackground=${JSON.stringify(sidePanelBackground)}`,
    `  sidePanelBackgroundColor=${JSON.stringify(sidePanelBackgroundColor)}`,
    `  columns={${JSON.stringify(columns)} as never}`,
    `  fields={${JSON.stringify(fields)}}`,
    `  values={{}}`,
    `/>`,
  ].join('\n');
};

export const renderAppTableGridCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const names = resolveAppTableGridVarNames(node.id);
  const presentation = readString(node.props.presentation, 'auto');
  const fillHeight = node.props.fillHeight !== false && node.props.fillHeight !== 'false';
  const chrome = readString(node.props.chrome, 'classic') === 'hero' ? 'hero' : 'classic';
  const enableColumnLayout = node.props.enableColumnLayout !== false;
  const rowKeyField = readString(node.props.rowKeyField, 'id');
  const loadingMessage = readString(node.props.loadingMessage, 'Loading records…');
  const emptyMessage = readString(node.props.emptyContent, 'No records found');
  const errorContent = readString(node.props.errorContent, 'Could not load records');
  const loadingMessageJsx = resolveGridCultureTextExpr(node, 'loadingMessageTranslationKey', loadingMessage);
  const emptyMessageJsx = resolveGridCultureTextExpr(node, 'emptyContentTranslationKey', emptyMessage);
  const errorContentJsx = resolveGridCultureTextExpr(node, 'errorContentTranslationKey', errorContent);
  const isLoading = readBoolean(node.props.isLoading);
  const gridFetch = bindingContext?.plan.gridPlan.gridListFetches.find((entry) => entry.nodeId === node.id);
  const isLoadingExpr = gridFetch ? `isLoading_${gridFetch.dataVar}` : String(isLoading);
  const errorContentExpr = gridFetch
    ? `(error_${gridFetch.dataVar} ? ${errorContentJsx} : undefined)`
    : 'undefined';
  const sortOptions = parseDesignerGridSortOptions(node.props.sortOptions);
  const sortOptionsJsx = sortOptions.some((option) => Boolean(option.labelTranslationKey?.trim()))
    ? names.sortOptions
    : JSON.stringify(sortOptions);
  const toolbarConfig = normalizeDesignerGridToolbarConfig(parseDesignerGridToolbarConfig(node.props.toolbarConfig) ?? {});
  const hasRowActionHandler = Boolean(bindingContext?.appTableGridRowActionNodeIds.has(node.id));
  const rowActionHandler = resolveGridDetailRowActionHandlerName(node.id);
  const cardBelow = sanitizeGridCardBelow(readString(node.props.cardBelow, 'tablet'));
  const gridSize = resolveAppTableGridSizeFromDensity({
    density: node.props.density,
    size: node.props.size,
    fallbackDensity: 'default',
  });
  const compactJsx = serializeGridCompactJsx(parseGridCompactFromProps(node.props as Record<string, unknown>));
  const showSortControls = node.props.showSortControls !== false && sortOptions.length > 0;
  const showListModeControls = node.props.showListModeControls !== false;
  const edgeAlignPagingFooter = node.props.edgeAlignPagingFooter === true;
  const gridQueryMode = readString(node.props.gridQueryMode, 'server') === 'client' ? 'client' : 'server';
  const effectiveGridQueryMode = resolveEffectiveAppTableGridQueryMode(
    gridQueryMode,
    toolbarConfig.serverQuery?.enabled === true,
  );

  // Bug found: `gridId`/`gridColumnLayoutStorePath`/`toolbarConfig` (and previously
  // `isLoading`/`emptyContent`/`errorContent`) were never excluded from the generic attrs pass,
  // so they leaked onto `<AppTableGrid>` as raw JSON-string/bogus props the real component
  // doesn't declare. All grid state (columns/rows/query/paging/column layout) is now driven by
  // the real hooks declared in the component preamble (see renderAppTableGridStateHookLines in
  // bindingCodegen.ts), not by anything left in the generic attrs pass.
  const gridAttrs = renderAttrs(node, bindingContext, {
    excludeKeys: new Set([
      'columns',
      'gridQueryMode',
      'pageSize',
      'page',
      'total',
      'rows',
      'presentation',
      'fillHeight',
      'chrome',
      'cardBelow',
      ...GRID_COMPACT_DESIGNER_PROP_KEYS,
      'enableColumnLayout',
      'showSortControls',
      'showListModeControls',
      'listMode',
      'defaultSortBy',
      'sortOptions',
      'rowKeyField',
      'loadingMessage',
      'emptyContent',
      'errorContent',
      'loadingMessageTranslationKey',
      'emptyContentTranslationKey',
      'errorContentTranslationKey',
      'searchPlaceholderTranslationKey',
      'refreshLabelTranslationKey',
      'isLoading',
      'gridId',
      'gridColumnLayoutStorePath',
      'toolbarConfig',
      'edgeAlignPagingFooter',
      'density',
      'size',
    ]),
    reservedAttributes: { presentation, cardBelow },
  });

  const compactAttr = compactJsx ? ` compact={${compactJsx}}` : '';
  const fillHeightAttr = fillHeight ? '' : ' fillHeight={false}';
  const chromeAttr = chrome === 'hero' ? ' chrome="hero"' : '';
  const footerChromeAttr = chrome === 'hero' ? ' chrome="hero"' : '';
  const rowActionAttr = hasRowActionHandler ? ` onGridRowAction={${rowActionHandler}}` : '';
  const getRowKeyExpr = `(row) => String((row as Record<string, unknown>)[${JSON.stringify(rowKeyField)}] ?? '')`;
  const listModeAttr = showListModeControls
    ? ` listMode={${names.listMode}} onListModeChange={${names.setListMode}}`
    : '';
  const visibleInfiniteAttr = ` visibleInfiniteCount={${names.listMode} === 'infinite' ? ${names.paging}.displayRows.length : undefined}`;
  const edgeAlignFooterAttr = edgeAlignPagingFooter ? ' edgeAlignInDialog' : '';

  const gridJsx = `<AppTableGrid${gridAttrs} size=${JSON.stringify(gridSize)} columns={${names.columns}} rows={${names.paging}.displayRows} getRowKey={${getRowKeyExpr}} enableColumnLayout={${enableColumnLayout}} columnLayout={${names.columnLayout}} onColumnLayoutChange={${names.setColumnLayout}} isLoading={${isLoadingExpr}} loadingMessage={${loadingMessageJsx}} emptyMessage={${emptyMessageJsx}} isEmpty={${names.aggregatedRows}.length === 0} errorContent={${errorContentExpr}} gridQueryMode={${JSON.stringify(effectiveGridQueryMode)}} query={${names.query}} onQueryChange={${`handleGridQueryChange_${sanitizeHandlerSuffix(node.id)}`}}${rowActionAttr}${compactAttr}${fillHeightAttr}${chromeAttr} footer={<GridPagingFooter totalCount={${names.totalCount}} safePage={${names.paging}.safePage} pageSize={${names.pageSize}} onPageSizeChange={${`handleGridPageSizeChange_${sanitizeHandlerSuffix(node.id)}`}} sortBy={${names.query}.sort?.columnId ?? ''} sortOptions={${sortOptionsJsx}} onSortByChange={${`handleGridSortByChange_${sanitizeHandlerSuffix(node.id)}`}} sortDirection={${names.query}.sort?.direction ?? 'asc'} onToggleSortDirection={${`handleGridToggleSortDirection_${sanitizeHandlerSuffix(node.id)}`}} showSortControls={${showSortControls}} totalPages={${names.paging}.totalPages} pageNumbers={buildDataGridPageNumbers(${names.paging}.safePage, ${names.paging}.totalPages)} onPageChange={${`handleGridPageChange_${sanitizeHandlerSuffix(node.id)}`}}${listModeAttr}${visibleInfiniteAttr}${edgeAlignFooterAttr}${footerChromeAttr} />} />`;

  if (!toolbarConfig.enabled) {
    return gridJsx;
  }

  const handlerSuffix = sanitizeHandlerSuffix(node.id);
  const searchPlaceholder = toolbarConfig.search?.placeholder ?? 'Search…';
  const searchPlaceholderJsx = readString(node.props.searchPlaceholderTranslationKey, '').trim()
    ? `culture.t(${JSON.stringify(readString(node.props.searchPlaceholderTranslationKey, '').trim())})`
    : JSON.stringify(searchPlaceholder);
  const toolbarSearch = toolbarConfig.search?.enabled
    ? `<input type="text" value={${names.searchInput}} onChange={(event) => handleGridSearchChange_${handlerSuffix}(event.target.value)} placeholder={${searchPlaceholderJsx}} className="h-8 rounded-md border border-slate-200 px-2 text-sm" />`
    : '';
  const fieldFilters = resolveEffectiveFieldFilters(toolbarConfig);
  const toolbarFieldFiltersJsx = fieldFilters.map((filter) => {
    const staticOptions = resolveFieldFilterStaticOptions(filter);
    let lovOptionsExpr = staticOptions.length === 0
      ? resolveToolbarLovFilterOptionsExpression(filter, bindingContext)
      : null;
    if (!lovOptionsExpr && staticOptions.length === 0 && filter.optionsSource === 'lov' && filter.lovRef?.trim() && bindingContext) {
      const lov = bindingContext.lovs[filter.lovRef.trim()];
      if (lov?.endpoint?.trim()) {
        const dataVar = names.toolbarLovData(filter.id);
        lovOptionsExpr = `mapDesignerLovItems(${dataVar}, ${JSON.stringify(lov.returnValue)}, ${JSON.stringify(lov.displayValue)}).map((item) => ({ value: item.id, label: item.textValue }))`;
      }
    }
    const options = staticOptions.length > 0
      ? JSON.stringify(staticOptions)
      : lovOptionsExpr;
    if (!options) {
      return '';
    }
    if (filter.controlType === 'checkbox-group') {
      if (staticOptions.length === 0) {
        return '';
      }
      const matchLogicExpr = `${names.matchLogicByFilterId}[${JSON.stringify(filter.id)}] ?? ${JSON.stringify(filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC)}`;
      const optionLabels = staticOptions.map((option) => (
        `<label key={${JSON.stringify(option.value)}} className="inline-flex items-center gap-1.5 text-xs text-slate-700"><UiCheckbox size="sm" checked={Boolean((${names.checkboxSelections}[${JSON.stringify(filter.id)}] ?? {})[${JSON.stringify(option.value)}])} onChange={(event) => handleGridCheckboxFilterChange_${handlerSuffix}(${JSON.stringify(filter.id)}, ${JSON.stringify(option.value)}, event.target.checked)} />${option.label}</label>`
      )).join('');
      return `<div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1"><button type="button" className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700" onClick={() => handleGridMatchLogicChange_${handlerSuffix}(${JSON.stringify(filter.id)}, (${matchLogicExpr}) === 'and' ? 'or' : 'and')}>{String(${matchLogicExpr}).toUpperCase()}</button>${optionLabels}</div>`;
    }
    if (filter.controlType === 'select') {
      const multipleAttr = filter.multiple === true ? ' multiple' : '';
      const filterAriaLabel = filter.labelTranslationKey?.trim()
        ? `culture.t(${JSON.stringify(filter.labelTranslationKey.trim())})`
        : JSON.stringify(filter.label);
      const filterAllLabel = `culture.t(${JSON.stringify('grid.filter.all')})`;
      const selectOptionsExpr = staticOptions.length > 0
        ? `[${staticOptions.map((option) => {
          const key = option.labelTranslationKey?.trim();
          if (key) {
            return `{value:${JSON.stringify(option.value)},label:culture.t(${JSON.stringify(key)})}`;
          }
          return `{value:${JSON.stringify(option.value)},label:${JSON.stringify(option.label)}}`;
        }).join(',')}]`
        : options;
      const matchLogicAttrs = fieldFilterSupportsMatchLogic(filter)
        ? ` matchLogic={${names.matchLogicByFilterId}[${JSON.stringify(filter.id)}] ?? ${JSON.stringify(filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC)}} onMatchLogicChange={(nextLogic) => handleGridMatchLogicChange_${handlerSuffix}(${JSON.stringify(filter.id)}, nextLogic)} matchLogicAriaLabel={\`\${${filterAriaLabel}} match logic\`}`
        : '';
      return `<ToolbarFilterSelect value={${names.radioSelections}[${JSON.stringify(filter.id)}] ?? ''} options={${selectOptionsExpr}} onChange={(value) => handleGridRadioFilterChange_${handlerSuffix}(${JSON.stringify(filter.id)}, value)} ariaLabel={${filterAriaLabel}} allLabel={${filterAllLabel}}${multipleAttr}${matchLogicAttrs} />`;
    }
    if (staticOptions.length === 0) {
      return '';
    }
    const radioOptions = staticOptions.map((option) => (
      `<label key={${JSON.stringify(option.value)}} className="inline-flex items-center gap-1 text-xs text-slate-700"><input type="radio" name={${JSON.stringify(`${node.id}-${filter.id}`)}} checked={(${names.radioSelections}[${JSON.stringify(filter.id)}] ?? '') === ${JSON.stringify(option.value)}} onChange={() => handleGridRadioFilterChange_${handlerSuffix}(${JSON.stringify(filter.id)}, ${JSON.stringify(option.value)})} className="h-3.5 w-3.5" />${option.label}</label>`
    )).join('');
    return `<div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"><span className="font-semibold">${filter.label}</span>${radioOptions}</div>`;
  }).join('');
  const toolbarCreate = toolbarConfig.create?.enabled
    ? (() => {
      const behavior = toolbarConfig.create?.behavior;
      const onClick = behavior?.kind === 'open-modal' && behavior.modalNodeId
        ? `() => { ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(behavior.selectionStorePath?.trim() || 'selection.id')}, null); ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityStorePathForNode(behavior.modalNodeId))}, true); }`
        : '() => {}';
      return `<button type="button" onClick={${onClick}} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">${toolbarConfig.create?.label ?? 'Add'}</button>`;
    })()
    : '';
  const refreshLabelJsx = readString(node.props.refreshLabelTranslationKey, '').trim()
    ? `{culture.t(${JSON.stringify(readString(node.props.refreshLabelTranslationKey, '').trim())})}`
    : 'Refresh';
  const toolbarTotalCount = toolbarConfig.refresh?.enabled && toolbarConfig.serverQuery?.enabled !== false
    ? `<span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{${names.totalCount}.toLocaleString()}</span>`
    : '';
  const toolbarRefresh = toolbarConfig.refresh?.enabled
    ? `<button type="button" onClick={() => { ${bindingContext ? resolveAppTableGridRefreshCallExpression(node.id, bindingContext) : ''} }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">${refreshLabelJsx}</button>`
    : '';
  const exportEnabled = toolbarConfig.export?.enabled === true || toolbarConfig.showExportButton === true;
  const exportDefaultFormat = toolbarConfig.export?.defaultFormat === 'xlsx' || toolbarConfig.export?.defaultFormat === 'pdf'
    ? toolbarConfig.export.defaultFormat
    : 'csv';
  const toolbarExport = exportEnabled
    ? `<button type="button" data-testid="designer-grid-toolbar-export" onClick={() => { void exportDesignerData({ format: ${JSON.stringify(exportDefaultFormat)}, rows: ${names.filteredRows} as Record<string, unknown>[], filename: ${JSON.stringify(`grid-${node.id}`)} }); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Export</button>`
    : '';

  const toolbarJsx = `<ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>${toolbarSearch}${toolbarFieldFiltersJsx}</div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>${toolbarCreate}${toolbarExport}${toolbarTotalCount}${toolbarRefresh}</div></ListPageToolbarFrame>`;

  return `<ListPageShell className="flex min-h-0 w-full flex-1 flex-col">${toolbarJsx}${gridJsx}</ListPageShell>`;
};

/**
 * HeroUI's real `Autocomplete` (react-aria ComboBox) exposes `onSelectionChange(key)`, not
 * `onChange` — it has no `onChange` prop at all. Bug found: the generic attrs pass emits
 * `onChange={handler}` for any form-input palette item with a configured onChange binding
 * (heroui.autocomplete / heroui.entity-picker both register onChange generically), so that
 * binding silently never fired in exported/published code even though the canvas preview
 * (DesignerRuntimeAutocomplete.tsx / runtimePhase2Palette.tsx) already adapts it correctly.
 * Rewrite it into a real adapter, mirroring adaptSelectionChangeAttr (tsxNodeRenderer.ts).
 */
export const adaptAutocompleteOnChangeAttr = (
  attrs: string,
  nodeId: string,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  if (!bindingContext) {
    return attrs;
  }
  const handlerName = bindingContext.handlerNames.get(`${nodeId}:onChange`);
  if (!handlerName) {
    return attrs;
  }
  const needle = ` onChange={${handlerName}}`;
  if (!attrs.includes(needle)) {
    return attrs;
  }
  return attrs.replace(
    needle,
    ` onSelectionChange={(key) => ${handlerName}({ target: { value: key === undefined || key === null ? '' : String(key) } } as unknown as React.ChangeEvent<HTMLInputElement>)}`,
  );
};

export const renderEntityPickerCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const label = readString(node.props.label, 'Entity');
  const placeholder = readString(node.props.placeholder, 'Select entity…');
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const entityConfig = bindingContext
    ? resolveEntityPickerConfig(node.id, bindingContext.entityPickerConfigs)
    : undefined;
  const searchHandlerName = `handleEntitySearch_${sanitizeHandlerSuffix(node.id)}`;

  // Bug found (parity audit items 27/49/50): `entityRef`/`searchParam`/`returnField`/`displayField`
  // and validation/adornment keys are Designer-internal — never real Autocomplete props. Label is
  // rendered as a visible <span> (Canvas/Preview parity), not a dead `label=` on <Autocomplete>.
  const autocompleteAttrs = adaptAutocompleteOnChangeAttr(
    renderAttrs(node, bindingContext, {
      excludeKeys: new Set([
        'entityRef',
        'searchParam',
        'returnField',
        'displayField',
        'label',
        'placeholder',
        'items',
        'isInvalid',
        'errorMessage',
        'pattern',
        'minLength',
        'maxLength',
        'validationRule',
        'validationErrorMessage',
        'isRequired',
        'required',
        'startContent',
        'endContent',
        'isClearable',
        'autoFocus',
        'closeOnSelect',
        'shouldCloseOnSelect',
        'allowCustomValue',
      ]),
      reservedAttributes: {
        placeholder,
        ...(isDisabled ? { isDisabled: true } : {}),
        // Bug found (parity audit item 47, re-verified): `shouldCloseOnSelect` was previously
        // re-added here for truthy values only — asymmetric with the field's removal below, and
        // moot anyway since the real Autocomplete/Select never reads this prop (verified against
        // the installed react-aria-components type defs: only Menu/DatePicker support it).
        // `closeOnSelect`/`shouldCloseOnSelect` are still excluded above so a legacy document
        // value never leaks as a dead raw attribute.
        ...(entityConfig
          ? {
            items: tsxBindingRawExpr(entityConfig.itemsVar),
            isPending: tsxBindingRawExpr(entityConfig.loadingVar),
            // Initial options load via useEffect in useEntityPickerOptions; onInputChange is a
            // no-op on Select-based Autocomplete (Option A) but kept for future ComboBox work.
            onInputChange: tsxBindingRawExpr(searchHandlerName),
          }
          : {}),
      },
    }),
    node.id,
    bindingContext,
  );

  const listBoxItems = entityConfig
    ? `{${entityConfig.itemsVar}.map((item) => (<ListBox.Item key={item.id} id={item.id} textValue={item.textValue}>{item.textValue}</ListBox.Item>))}`
    : '<ListBox.Item id="entity-1">Sample entity</ListBox.Item>';

  const labelExpr = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'label', bindingContext)
    : null;
  const labelContent = labelExpr
    ? `{${labelExpr} ?? ${JSON.stringify(label)}}`
    : escapeJsxTextContent(label);
  const labelBlock = label.length > 0 || labelExpr
    ? `<span className="ps-[4px] text-sm text-slate-700">${labelContent}</span>`
    : '';

  return `<div className="flex w-full flex-col gap-[2px]">${labelBlock}<Autocomplete${autocompleteAttrs}><Autocomplete.Trigger><Autocomplete.Value /><Autocomplete.Indicator /></Autocomplete.Trigger><Autocomplete.Popover><ListBox>${listBoxItems}</ListBox></Autocomplete.Popover></Autocomplete></div>`;
};

/**
 * DesignerDateRangeField calls onChange with (startIso, endIso) strings — adapt to the designer
 * event system's CSV "<start>,<end>" shape when a binding handler is present.
 */
const adaptDesignerDateRangeFieldChangeAttr = (
  attrs: string,
  nodeId: string,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  if (!bindingContext) {
    return attrs;
  }
  const handlerName = bindingContext.handlerNames.get(`${nodeId}:onChange`);
  if (!handlerName) {
    return attrs;
  }
  const needle = ` onChange={${handlerName}}`;
  if (!attrs.includes(needle)) {
    return attrs;
  }
  return attrs.replace(
    needle,
    ` onChange={(start, end) => ${handlerName}({ target: { value: start && end ? start + ',' + end : '' } } as unknown as React.ChangeEvent<HTMLInputElement>)}`,
  );
};

export const renderDateRangeCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const label = readString(node.props.label, 'Date range');
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const isRequired = readBoolean(node.props.isRequired) || readBoolean(node.props.required);
  const isReadOnly = readBoolean(node.props.isReadOnly) || readBoolean(node.props.readOnly);
  const granularity = readString(node.props.granularity, 'day');
  const minValue = readString(node.props.minValue);
  const maxValue = readString(node.props.maxValue);
  const presetsJson = readString(node.props.presets);
  const timeZone = readString(node.props.timeZone);

  const startExpr = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'startValue', bindingContext)
    : null;
  const endExpr = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'endValue', bindingContext)
    : null;
  const startValue = readString(node.props.startValue);
  const endValue = readString(node.props.endValue);
  const startAttr = startExpr
    ? ` startValue={String(${startExpr} ?? '')}`
    : startValue.trim().length > 0
      ? ` startValue=${JSON.stringify(startValue)}`
      : '';
  const endAttr = endExpr
    ? ` endValue={String(${endExpr} ?? '')}`
    : endValue.trim().length > 0
      ? ` endValue=${JSON.stringify(endValue)}`
      : '';

  const attrs = adaptDesignerDateRangeFieldChangeAttr(
    renderAttrs(node, bindingContext, {
      excludeKeys: new Set([
        'label',
        'value',
        'startValue',
        'endValue',
        'presets',
        'timeZone',
        'minValue',
        'maxValue',
        'granularity',
        'isRequired',
        'required',
        'isReadOnly',
        'readOnly',
        'size',
      ]),
      reservedAttributes: {
        ...(isDisabled ? { isDisabled: true } : {}),
        ...(isRequired ? { isRequired: true } : {}),
        ...(isReadOnly ? { isReadOnly: true } : {}),
      },
    }),
    node.id,
    bindingContext,
  );

  const constraintAttrs = [
    ` label={${JSON.stringify(label)}}`,
    startAttr,
    endAttr,
    presetsJson.trim().length > 0 ? ` presetsJson={${JSON.stringify(presetsJson)}}` : '',
    timeZone.trim().length > 0 ? ` timeZone={${JSON.stringify(timeZone)}}` : '',
    ` granularity={${JSON.stringify(granularity)}}`,
    minValue.trim().length > 0 ? ` minValue={${JSON.stringify(minValue)}}` : '',
    maxValue.trim().length > 0 ? ` maxValue={${JSON.stringify(maxValue)}}` : '',
  ].join('');

  return `<DesignerDateRangeField${attrs}${constraintAttrs} />`;
};

/** Legacy hook — parseDate is no longer emitted inline; DesignerDateRangeField owns date parsing. */
export const documentUsesDateRangeParsedValue = (
  _document: DesignerDocument,
  _bindingContext: TsxBindingRenderContext,
): boolean => false;

export const renderDatePickerCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'placeholder',
    'label',
    'value',
    'calendarSystem',
    'locale',
    'granularity',
    'hourCycle',
    'hideTimeZone',
    'shouldForceLeadingZeros',
    'minValue',
    'maxValue',
    'placeholderValue',
    'firstDayOfWeek',
    'timeZone',
    'visibleMonths',
    'pageBehavior',
    'isReadOnly',
    'autoFocus',
  ]);
  const label = readString(node.props.label, 'Date');
  const placeholder = readString(node.props.placeholder, 'Select date');
  const calendarSystem = readString(node.props.calendarSystem, 'gregorian');
  const locale = readString(node.props.locale, '');
  const granularity = readString(node.props.granularity, 'day');
  const hourCycle = readString(node.props.hourCycle, 'auto');
  const minValue = readString(node.props.minValue, '');
  const maxValue = readString(node.props.maxValue, '');
  const placeholderValue = readString(node.props.placeholderValue, '');
  const firstDayOfWeek = readString(node.props.firstDayOfWeek, '');
  const timeZone = readString(node.props.timeZone, '');
  const pageBehavior = readString(node.props.pageBehavior, 'visible') === 'single' ? 'single' : 'visible';

  const explicitProps = [
    `label=${toJsxString(label)}`,
    `placeholder=${toJsxString(placeholder)}`,
    `calendarSystem=${toJsxString(calendarSystem)}`,
    `granularity=${toJsxString(granularity)}`,
    `hourCycle=${toJsxString(hourCycle)}`,
    `hideTimeZone={${readBoolean(node.props.hideTimeZone)}}`,
    `shouldForceLeadingZeros={${node.props.shouldForceLeadingZeros !== false}}`,
    `visibleMonths={${readNumber(node.props.visibleMonths, 1)}}`,
    `pageBehavior=${toJsxString(pageBehavior)}`,
    `isReadOnly={${readBoolean(node.props.isReadOnly) || readBoolean(node.props.readOnly)}}`,
    `autoFocus={${readBoolean(node.props.autoFocus)}}`,
  ];

  if (locale.trim().length > 0) {
    explicitProps.push(`locale=${toJsxString(locale.trim())}`);
  }
  if (minValue.trim().length > 0) {
    explicitProps.push(`minValue=${toJsxString(minValue.trim())}`);
  }
  if (maxValue.trim().length > 0) {
    explicitProps.push(`maxValue=${toJsxString(maxValue.trim())}`);
  }
  if (placeholderValue.trim().length > 0) {
    explicitProps.push(`placeholderValue=${toJsxString(placeholderValue.trim())}`);
  }
  if (firstDayOfWeek.trim().length > 0) {
    explicitProps.push(`firstDayOfWeek=${toJsxString(firstDayOfWeek.trim())}`);
  }
  if (timeZone.trim().length > 0) {
    explicitProps.push(`timeZone=${toJsxString(timeZone.trim())}`);
  }

  return `<DesignerDatePickerField${attrs} ${explicitProps.join(' ')} />`;
};

const renderDesignerFormFieldAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  extraExcludeKeys: string[] = [],
  options?: { sanitizeHtmlValue?: boolean },
): string => {
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const valueBinding = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'value', bindingContext)
    : null;
  const rawValue = typeof node.props.value === 'string' ? node.props.value.trim() : '';
  const staticValue = options?.sanitizeHtmlValue && rawValue.length > 0
    ? sanitizeDesignerHtml(rawValue)
    : rawValue;

  return renderAttrs(node, bindingContext, {
    excludeKeys: new Set(['value', ...DESIGNER_FORM_FIELD_UNSUPPORTED_EXPORT_KEYS, ...extraExcludeKeys]),
    reservedAttributes: {
      ...(isDisabled ? { isDisabled: true } : {}),
      // Bound `value` is emitted by buildNodeJsxAttributesWithBindings' binding loop — do not
      // also put it in reservedAttributes (would duplicate the JSX attribute).
      // Bug found (parity audit item 44): previously passed `toJsxString(staticValue)` here —
      // claimJsxAttribute/jsxAttributeStringValue then JSON.stringified again, producing
      // `value={"\"#3B82F6\""}`. Pass the raw string so the generic path encodes exactly once
      // (same pattern as heroui.input-text in tsxNodeRenderer.ts).
      ...(staticValue.length > 0 && !valueBinding
        ? { value: staticValue }
        : {}),
    },
  });
};

export const renderCodeEditorCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'language',
    'theme',
    'editorHeight',
    'lineNumbers',
    'wordWrap',
    'readOnly',
    'minimap',
    'tabSize',
    'fontSize',
    'placeholder',
    'label',
  ]);
  const language = readString(node.props.language, 'typescript');
  const theme = readString(node.props.theme, 'vs');
  const placeholder = readString(node.props.placeholder, '// Enter code…');
  const label = readString(node.props.label, 'Code');
  return `<DesignerCodeEditorField${attrs} label=${toJsxString(label)} language=${toJsxString(language)} theme=${toJsxString(theme)} placeholder=${toJsxString(placeholder)} lineNumbers={${readBoolean(node.props.lineNumbers)}} wordWrap={${node.props.wordWrap !== false}} readOnly={${readBoolean(node.props.readOnly)}} minimap={${readBoolean(node.props.minimap)}} tabSize={${readNumber(node.props.tabSize, 2)}} fontSize={${readNumber(node.props.fontSize, 13)}} />`;
};

export const renderHtmlEditorCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'editorHeight',
    'fontSize',
    'readOnly',
    'placeholder',
    'label',
    // Toolbar flags are re-emitted explicitly via renderDesignerRichTextToolbarJsxProps —
    // leaving them in the generic attrs pass duplicates every enable* / showToolbar attribute
    // (TS17001) whenever catalog defaults are present.
    ...DESIGNER_RICH_TEXT_TOOLBAR_PROP_KEYS,
  ], { sanitizeHtmlValue: true });
  const placeholder = readString(node.props.placeholder, 'Start writing…');
  const label = readString(node.props.label, 'Rich Text');
  const toolbarProps = renderDesignerRichTextToolbarJsxProps(node.props);
  return `<DesignerHtmlEditorField${attrs} label=${toJsxString(label)} placeholder=${toJsxString(placeholder)} editorHeight={${readNumber(node.props.editorHeight, 160)}} fontSize={${readNumber(node.props.fontSize, 14)}} ${toolbarProps} readOnly={${readBoolean(node.props.readOnly)}} />`;
};

export const renderMarkdownEditorCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'editorHeight',
    'fontSize',
    'readOnly',
    'placeholder',
    'label',
    ...DESIGNER_RICH_TEXT_TOOLBAR_PROP_KEYS,
  ]);
  const placeholder = readString(node.props.placeholder, 'Write in Markdown…');
  const label = readString(node.props.label, 'Markdown');
  const toolbarProps = renderDesignerRichTextToolbarJsxProps(node.props);
  return `<DesignerMarkdownEditorField${attrs} label=${toJsxString(label)} placeholder=${toJsxString(placeholder)} editorHeight={${readNumber(node.props.editorHeight, 160)}} fontSize={${readNumber(node.props.fontSize, 14)}} ${toolbarProps} readOnly={${readBoolean(node.props.readOnly)}} />`;
};

export const renderHwyInstituteLogoUploadCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const regionColumnBinding = bindingContext?.plan.regionPlan.regionColumnBindings.find(
    (binding) => binding.nodeId === node.id,
  );
  const valueExpr = bindingContext && regionColumnBinding
    ? regionColumnToExpression(regionColumnBinding.dataVar, regionColumnBinding.column)
    : (bindingContext
      ? resolveNodePropertyBindingExpression(node.id, 'value', bindingContext)
      : null);
  const instituteIdExpr = regionColumnBinding
    ? regionColumnToExpression(regionColumnBinding.dataVar, 'id')
    : 'null';
  const formFieldName = bindingContext?.plan.regionPlan.regionColumnBindings.some(
    (binding) => binding.nodeId === node.id,
  )
    ? node.id
    : '';
  const className = readString(node.props.className, 'flex w-full flex-col items-center');
  const ariaLabel = readString(node.props.ariaLabel, readString(node.props.label, 'Institute logo'));
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const valueAttr = valueExpr ? ` value={${valueExpr}}` : '';
  const formFieldAttr = formFieldName ? ` formFieldName=${JSON.stringify(formFieldName)}` : '';
  const disabledAttr = isDisabled ? ' disabled' : '';

  return `<div className=${JSON.stringify(`${className} pb-1`)}><HwyInstituteLogoUploadField instituteId={${instituteIdExpr}}${valueAttr}${formFieldAttr} ariaLabel=${JSON.stringify(ariaLabel)}${disabledAttr} /></div>`;
};

export const renderColorEditorCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'placeholder',
    'label',
    'showAlpha',
    'presetColors',
  ]);
  const label = readString(node.props.label, 'Color');
  const placeholder = readString(node.props.placeholder, '#RRGGBB');
  return `<DesignerColorEditorField${attrs} label=${toJsxString(label)} placeholder=${toJsxString(placeholder)} showAlpha={${readBoolean(node.props.showAlpha)}} presetColors=${toJsxString(readString(node.props.presetColors))} />`;
};

export const renderMaskInputCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'placeholder',
    'label',
    'maskKind',
    'maskPreset',
    'maskPattern',
    'maskPlaceholderChar',
    'maskLazy',
    'maskEager',
    'maskOverwrite',
    'maskAutofix',
    'maskDefinitions',
    'maskBlocks',
    'maskEnum',
    'maskRegExp',
    'maskNumberScale',
    'maskNumberRadix',
    'maskNumberThousandsSeparator',
    'maskNumberPadFractionalZeros',
    'maskNumberNormalizeZeros',
    'maskNumberMin',
    'maskNumberMax',
    'maskDatePattern',
    'maskOptionsJson',
    'unmask',
    'showMaskFormatHint',
  ]);
  const label = readString(node.props.label, 'Masked Input');
  const placeholder = readString(node.props.placeholder, '');
  const maskKind = readString(node.props.maskKind, 'pattern');
  const maskPreset = readString(node.props.maskPreset, 'custom');
  const maskPattern = readString(node.props.maskPattern, '');
  const maskPlaceholderChar = readString(node.props.maskPlaceholderChar, '_');
  const maskRegExp = readString(node.props.maskRegExp, '');
  const maskEnum = readString(node.props.maskEnum, '');
  const maskDefinitions = readString(node.props.maskDefinitions, '');
  const maskBlocks = readString(node.props.maskBlocks, '');
  const maskOptionsJson = readString(node.props.maskOptionsJson, '');
  const maskNumberScale = readString(node.props.maskNumberScale, '');
  const maskNumberRadix = readString(node.props.maskNumberRadix, '.');
  const maskNumberThousandsSeparator = readString(node.props.maskNumberThousandsSeparator, ',');
  const maskNumberMin = readString(node.props.maskNumberMin, '');
  const maskNumberMax = readString(node.props.maskNumberMax, '');
  const maskDatePattern = readString(node.props.maskDatePattern, 'Y-m-d');
  const showMaskFormatHint = node.props.showMaskFormatHint === true;

  const explicitProps = [
    `label=${toJsxString(label)}`,
    `placeholder=${toJsxString(placeholder)}`,
    `maskKind=${toJsxString(maskKind)}`,
    `maskPreset=${toJsxString(maskPreset)}`,
    `maskPattern=${toJsxString(maskPattern)}`,
    `maskPlaceholderChar=${toJsxString(maskPlaceholderChar)}`,
    `maskLazy={${node.props.maskLazy !== false}}`,
    `maskEager={${readBoolean(node.props.maskEager)}}`,
    `maskOverwrite={${node.props.maskOverwrite !== false}}`,
    `maskAutofix={${node.props.maskAutofix !== false}}`,
    `maskNumberRadix=${toJsxString(maskNumberRadix)}`,
    `maskNumberThousandsSeparator=${toJsxString(maskNumberThousandsSeparator)}`,
    `maskNumberPadFractionalZeros={${readBoolean(node.props.maskNumberPadFractionalZeros)}}`,
    `maskNumberNormalizeZeros={${node.props.maskNumberNormalizeZeros !== false}}`,
    `unmask={${readBoolean(node.props.unmask)}}`,
    `showMaskFormatHint={${showMaskFormatHint}}`,
    `maskDatePattern=${toJsxString(maskDatePattern)}`,
  ];

  if (maskRegExp.trim()) explicitProps.push(`maskRegExp=${toJsxString(maskRegExp.trim())}`);
  if (maskEnum.trim()) explicitProps.push(`maskEnum=${toJsxString(maskEnum.trim())}`);
  if (maskDefinitions.trim()) explicitProps.push(`maskDefinitions=${toJsxString(maskDefinitions.trim())}`);
  if (maskBlocks.trim()) explicitProps.push(`maskBlocks=${toJsxString(maskBlocks.trim())}`);
  if (maskOptionsJson.trim()) explicitProps.push(`maskOptionsJson=${toJsxString(maskOptionsJson.trim())}`);
  if (maskNumberScale.trim()) explicitProps.push(`maskNumberScale=${toJsxString(maskNumberScale.trim())}`);
  if (maskNumberMin.trim()) explicitProps.push(`maskNumberMin=${toJsxString(maskNumberMin.trim())}`);
  if (maskNumberMax.trim()) explicitProps.push(`maskNumberMax=${toJsxString(maskNumberMax.trim())}`);

  return `<DesignerMaskInputField${attrs} ${explicitProps.join(' ')} />`;
};

export const renderCalculatorCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'placeholder',
    'label',
    'min',
    'max',
    'step',
    'decimalPlaces',
    'showKeypad',
    'keypadMode',
    'allowManualInput',
  ]);
  const label = readString(node.props.label, 'Amount');
  const placeholder = readString(node.props.placeholder, '0');
  const keypadMode = readString(node.props.keypadMode, 'basic');
  return `<DesignerCalculatorField${attrs} label=${toJsxString(label)} placeholder=${toJsxString(placeholder)} min=${toJsxString(readString(node.props.min))} max=${toJsxString(readString(node.props.max))} step=${toJsxString(readString(node.props.step))} decimalPlaces={${readNumber(node.props.decimalPlaces, 2)}} showKeypad={${node.props.showKeypad !== false}} keypadMode=${toJsxString(keypadMode)} allowManualInput={${node.props.allowManualInput !== false}} />`;
};

export const renderRelationTagsListCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'relationTagsDataSourceRef',
    'relationTagsContentIdPath',
    'relationTagsValueField',
    'relationTagsRowKeyField',
    'relationTagsParentField',
    'relationTagsSelectPlacement',
    'relationTagsPlaceholder',
    'relationTagsOptions',
  ]);
  return `<DesignerRelationTagsListField${attrs} />`;
};

export const renderRelatedContentsListCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'relatedContentsDataSourceRef',
    'relatedContentsContentIdPath',
    'relatedContentsCreateModalNodeId',
    'relatedContentsOptionsDataSourceRef',
    'relatedContentsContentOptions',
    'relatedContentsExcludeContentTypeCode',
  ]);
  return `<DesignerRelatedContentsListField${attrs} />`;
};

export const renderBaseInfoRecordCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'baseInfoRecordDataSourceRef',
    'baseInfoRecordFixedParentId',
    'baseInfoRecordParentLabel',
  ]);
  return `<DesignerBaseInfoRecordFormField${attrs} />`;
};

export const renderCmsContentAssetsCustomJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderDesignerFormFieldAttrs(node, bindingContext, [
    'cmsContentAssetsDataSourceRef',
    'cmsContentAssetsContentIdPath',
    'cmsContentAssetsMode',
  ]);
  return `<DesignerCmsContentAssetsField${attrs} />`;
};

export const renderSplitPaneContainerJsx = (
  node: DesignerNode,
  childBlocks: string[],
  bindingContext?: TsxBindingRenderContext,
): string => {
  const directionStatic = readString(node.props.direction, 'horizontal');
  const defaultSplitStatic = readNumber(node.props.defaultSplit, 50);
  // Bug found (parity audit item 38): direction/defaultSplit were always baked as static
  // literals into className/style/`data-split-*`, so Property Bindings never affected layout
  // in Export (Preview had the same static-only read). Resolve bindings and emit runtime
  // expressions when bound; keep the compact static path when unbound.
  const directionBound = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'direction', bindingContext)
    : null;
  const defaultSplitBound = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'defaultSplit', bindingContext)
    : null;
  const defaultSplitExpr = defaultSplitBound ?? String(defaultSplitStatic);
  const paneBlocks = childBlocks.length > 0
    ? childBlocks
    : [
      '<div className="min-h-[120px] rounded-md border border-dashed border-slate-300 bg-slate-50/80 p-3 text-xs text-slate-500">Pane</div>',
      '<div className="min-h-[120px] rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-3 text-xs text-slate-500">Pane</div>',
    ];
  const attrs = renderAttrs(node, bindingContext, {
    excludeKeys: new Set(['direction', 'defaultSplit', 'isDisabled', 'disabled']),
    reservedAttributes: {
      direction: directionBound ? tsxBindingRawExpr(directionBound) : directionStatic,
      defaultSplit: defaultSplitBound ? tsxBindingRawExpr(`Number(${defaultSplitExpr})`) : defaultSplitStatic,
      'data-designer-component': 'layout.split-pane',
      'data-split-direction': directionBound ? tsxBindingRawExpr(directionBound) : directionStatic,
      'data-default-split': defaultSplitBound ? tsxBindingRawExpr(defaultSplitBound) : defaultSplitStatic,
      'data-split-pane-count': String(paneBlocks.length),
    },
  });
  const childrenJsx = paneBlocks.map((block) => indentJsxBlock(block, 2)).join('\n');
  return `<UiSplitPane${attrs}>\n${childrenJsx}\n</UiSplitPane>`;
};

export const renderDockPaneContainerJsx = (
  node: DesignerNode,
  childBlocks: string[],
  bindingContext?: TsxBindingRenderContext,
): string => {
  const dockStatic = readUiDockPaneDock(node.props.dock);
  const dockBound = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'dock', bindingContext)
    : null;
  const attrs = renderAttrs(node, bindingContext, {
    excludeKeys: new Set(['dock']),
    reservedAttributes: {
      dock: dockBound ? tsxBindingRawExpr(dockBound) : dockStatic,
      'data-designer-component': 'layout.dock-pane',
    },
  });
  const childrenJsx = childBlocks.map((block) => indentJsxBlock(block, 2)).join('\n');
  if (childrenJsx.length === 0) {
    return `<UiDockPane${attrs} />`;
  }
  return `<UiDockPane${attrs}>\n${childrenJsx}\n</UiDockPane>`;
};

export const renderContentStatusPickerJsx = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string | null => {
  if (node.props.contentStatusPicker !== true && node.props.contentStatusPicker !== 'true') {
    return null;
  }

  const dataSourceRef = readString(node.props.contentStatusPickerDataSourceRef);
  const gridFetch = bindingContext?.plan.gridPlan.gridListFetches.find(
    (entry) => entry.dataSourceId === dataSourceRef,
  );
  const refreshCall = gridFetch ? `await refresh_${gridFetch.dataVar}();` : '';
  const bindingDefinitionsJson = JSON.stringify(bindingContext?.bindingDefinitions ?? {
    definitions: {},
    storeSegments: {},
    dataSources: {},
    lovs: {},
  });
  const nodeJson = JSON.stringify({
    id: node.id,
    type: node.type,
    props: node.props,
    parentId: node.parentId ?? null,
    order: node.order,
    layout: node.layout,
    binding: node.binding,
    children: node.children,
  });

  return `<DesignerRuntimeContentStatusPicker node={${nodeJson} as any} options={{ mode: 'runtime', bindingDefinitions: ${bindingDefinitionsJson}, designerStore: ${DESIGNER_STORE_VAR}, previewEvents: { patchStore: ${DESIGNER_STORE_PATCH_VAR}, getDesignerStore: () => ${DESIGNER_STORE_VAR}, refreshDataSource: async () => { ${refreshCall} } } }} />`;
};
