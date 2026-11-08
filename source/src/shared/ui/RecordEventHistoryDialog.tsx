import React, { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import { recordEventKindSchema, type RecordEventPublicRow } from '../api/contracts/record-events';
import { APP_GRID_IDS } from '../api/contracts/grids/gridIds';
import { fetchRecordEvents } from '../api/queries/recordEvents';
import { isAbortError } from '../api/client';
import { recordEventDateBound } from '../lib/formatRecordEventValue';
import { resolveRecordEventFieldQuery } from '../lib/recordEventHistoryFields';
import { APP_LIST_PREFERENCE_KEYS } from '../lib/listPreferenceKeys';
import { DEFAULT_GRID_PAGE_SIZE } from '../lib/gridPagingConstants';
import { EMPTY_GRID_QUERY } from '../lib/appTableGridQuery';
import { useGridColumnLayout } from '../lib/useGridColumnLayout';
import { usePersistedListPaging } from '../lib/usePersistedListPreferences';
import { AppTableGrid } from './AppTableGrid';
import { CreateEditModalShell } from './CreateEditModalShell';
import { GridPagingFooter } from './GridPagingFooter';
import { QueryErrorPanel } from './QueryErrorPanel';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
} from './surfaceClasses';
import { ToolbarRefreshButton } from './ToolbarRefreshButton';
import { ToolbarSearchInput } from './ToolbarSearchInput';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { UiSelect } from './HeroFieldControls';
import {
  createRecordSubjectHistoryGridColumns,
  recordSubjectHistoryRowActions,
} from './recordEventHistoryGridColumns';

const HISTORY_KIND_ALL = 'ALL';
const HISTORY_EVENT_KINDS = recordEventKindSchema.options;

const SORT_OPTIONS = [
  { value: 'occurredAt', label: 'Time' },
  { value: 'eventKind', label: 'Kind' },
  { value: 'field', label: 'Field' },
] as const;

type HistorySortField = (typeof SORT_OPTIONS)[number]['value'];

export type RecordEventHistoryDialogProps = {
  open: boolean;
  title?: string;
  subjectKind: string;
  subjectId?: string | number | null;
  field?: string | null;
  fieldMap?: Record<string, string>;
  contained?: boolean;
  onClose: () => void;
  onRestore?: (item: RecordEventPublicRow) => void | Promise<void>;
};

const compareHistoryRows = (
  left: RecordEventPublicRow,
  right: RecordEventPublicRow,
  sortBy: HistorySortField,
  direction: 'asc' | 'desc',
): number => {
  const dir = direction === 'asc' ? 1 : -1;
  if (sortBy === 'occurredAt') {
    return (new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()) * dir;
  }
  const leftValue = String(left[sortBy] ?? '');
  const rightValue = String(right[sortBy] ?? '');
  return leftValue.localeCompare(rightValue) * dir;
};

export const RecordEventHistoryDialog: React.FC<RecordEventHistoryDialogProps> = ({
  open,
  title = 'History',
  subjectKind,
  subjectId,
  field,
  fieldMap,
  contained = false,
  onClose,
  onRestore,
}) => {
  const subjectKey = subjectId == null || subjectId === '' ? '' : String(subjectId);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [eventKind, setEventKind] = useState(HISTORY_KIND_ALL);
  const [items, setItems] = useState<RecordEventPublicRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<HistorySortField>('occurredAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.recordEventHistory,
    defaultPageSize: DEFAULT_GRID_PAGE_SIZE,
  });
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    if (!open) return;
    setFromDate('');
    setToDate('');
    setFieldFilter(field?.trim() ?? '');
    setEventKind(HISTORY_KIND_ALL);
  }, [open, field, subjectKind, subjectKey]);

  useEffect(() => {
    setPage(1);
    setVisibleCount(pageSize);
  }, [eventKind, fieldFilter, fromDate, toDate, listMode, pageSize, subjectKind, subjectKey]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!open || !subjectKind || !subjectKey) {
      setItems([]);
      setTotalCount(0);
      setLoadError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, response } = await fetchRecordEvents({
        subjectKind,
        subjectId: subjectKey,
        field: resolveRecordEventFieldQuery({
          subjectKind,
          field: fieldFilter,
          fieldMap,
        }),
        eventKind: eventKind === HISTORY_KIND_ALL ? undefined : eventKind,
        from: recordEventDateBound(fromDate, 'start'),
        to: recordEventDateBound(toDate, 'end'),
        includeAuth: subjectKind === 'base_users' ? '1' : undefined,
        limit: listMode === 'infinite' ? visibleCount : pageSize,
        offset: listMode === 'infinite' ? 0 : (page - 1) * pageSize,
      }, signal);
      if (signal?.aborted) return;
      if (!response.ok) {
        setItems([]);
        setTotalCount(0);
        setLoadError(`Unable to load history (HTTP ${response.status}).`);
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalCount(Number(data.totalCount) || 0);
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        return;
      }
      setItems([]);
      setTotalCount(0);
      setLoadError('Unable to load history.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    eventKind,
    fieldFilter,
    fieldMap,
    fromDate,
    listMode,
    open,
    page,
    pageSize,
    subjectKind,
    subjectKey,
    toDate,
    visibleCount,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const restoreRow = useCallback(async (item: RecordEventPublicRow) => {
    await onRestore?.(item);
    await load();
  }, [load, onRestore]);

  const gridHandlers = useMemo(() => ({
    onRestore: onRestore ? (item: RecordEventPublicRow) => void restoreRow(item) : undefined,
  }), [onRestore, restoreRow]);

  const gridColumns = useMemo(
    () => createRecordSubjectHistoryGridColumns(gridHandlers),
    [gridHandlers],
  );
  const { layout: columnLayout, setLayout: handleColumnLayoutChange } = useGridColumnLayout({
    columns: gridColumns,
    gridId: APP_GRID_IDS.recordEventHistory,
  });

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => compareHistoryRows(left, right, sortBy, sortDirection)),
    [items, sortBy, sortDirection],
  );
  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    const pages: number[] = [];
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      pages.push(pageNumber);
    }
    return pages;
  }, [safePage, totalPages]);
  const visibleInfiniteCount = Math.min(visibleCount, totalCount);
  const hasMore = listMode === 'infinite' && visibleInfiniteCount < totalCount;
  const handleScrollEnd = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (listMode !== 'infinite' || !hasMore) return;
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= 48) {
      setVisibleCount((current) => current + pageSize);
    }
  }, [hasMore, listMode, pageSize]);

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="maximized"
      title={title}
      contained={contained}
      gradient={false}
      shellClassName="flex min-h-0 flex-col overflow-hidden"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden -mb-[15px]"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0 !p-0"
      onClose={onClose}
    >
      <div className="flex h-full min-h-0 w-full flex-col bg-white">
        <div className={`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between`}>
          <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
            <div className="w-full min-w-0 sm:w-44 sm:shrink-0">
              <UiSelect
                size="sm"
                className="w-full"
                ariaLabel="Event kind"
                value={eventKind}
                onChange={(event) => setEventKind(String(event.target.value))}
              >
                <option value={HISTORY_KIND_ALL}>All kinds</option>
                {HISTORY_EVENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </UiSelect>
            </div>
            <ToolbarSearchInput
              value={fieldFilter}
              onChange={setFieldFilter}
              placeholder="Field"
              ariaLabel="Filter by field"
            />
            <div className="w-[9.75rem] shrink-0">
              <UiInput
                size="sm"
                type="date"
                aiAssist={false}
                ariaLabel="From date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="w-[9.75rem] shrink-0">
              <UiInput
                size="sm"
                type="date"
                aiAssist={false}
                ariaLabel="To date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          </div>
          <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
            <ToolbarRefreshButton
              onClick={() => void load()}
              isRefreshing={isLoading}
              separatorBefore={false}
            />
          </div>
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <AppTableGrid
            chrome="hero"
            presentation="auto"
            size="sm"
            tableClassName="text-slate-700"
            theadClassName="text-xs font-bold text-slate-500 uppercase tracking-wider"
            columns={gridColumns}
            enableColumnLayout
            persistListKey={APP_LIST_PREFERENCE_KEYS.recordEventHistory}
            columnLayout={columnLayout}
            onColumnLayoutChange={handleColumnLayoutChange}
            rows={sortedItems}
            getRowKey={(item) => item.id}
            gridQueryMode="server"
            query={EMPTY_GRID_QUERY}
            onScroll={handleScrollEnd}
            footer={(
              <GridPagingFooter
                chrome="hero"
                totalCount={totalCount}
                safePage={safePage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                sortBy={sortBy}
                sortOptions={[...SORT_OPTIONS]}
                onSortByChange={(value) => setSortBy(value as HistorySortField)}
                sortDirection={sortDirection}
                onToggleSortDirection={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
                showSortControls
                totalPages={totalPages}
                pageNumbers={pageNumbers}
                onPageChange={setPage}
                listMode={listMode}
                onListModeChange={setListMode}
                visibleInfiniteCount={visibleInfiniteCount}
              />
            )}
            isLoading={isLoading}
            loadingMessage="Loading history..."
            errorContent={
              loadError ? (
                <QueryErrorPanel
                  message="Failed to load history."
                  detail={loadError}
                  onRetry={() => void load()}
                  isRetrying={isLoading}
                  className="h-32"
                />
              ) : undefined
            }
            isEmpty={!isLoading && !loadError && items.length === 0}
            emptyMessage="No history yet."
            emptyContent={<div className="flex h-32 items-center justify-center text-sm text-slate-500">No history yet.</div>}
            getCardRowActions={(row) => recordSubjectHistoryRowActions(row as RecordEventPublicRow, gridHandlers)}
          />
        </div>
      </div>
    </CreateEditModalShell>
  );
};
