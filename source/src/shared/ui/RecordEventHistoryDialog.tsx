import React, { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import { recordEventKindSchema, type RecordEventPublicRow } from '../api/contracts/record-events';
import { fetchRecordEvents } from '../api/queries/recordEvents';
import { isAbortError } from '../api/client';
import { recordEventDateBound } from '../lib/formatRecordEventValue';
import { resolveRecordEventFieldQuery } from '../lib/recordEventHistoryFields';
import { APP_LIST_PREFERENCE_KEYS } from '../lib/listPreferenceKeys';
import { DEFAULT_GRID_PAGE_SIZE } from '../lib/gridPagingConstants';
import { usePersistedListPaging } from '../lib/usePersistedListPreferences';
import { CreateEditModalShell } from './CreateEditModalShell';
import { QueryErrorPanel } from './QueryErrorPanel';
import { LoadingSpinner } from './LoadingSpinner';
import { SectionEmptyState } from './SectionEmptyState';
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
  RecordSubjectTimelineEventDetailDialog,
  RecordSubjectTimelineRecordEventCard,
  RecordSubjectTimelineSortToggle,
  RecordSubjectTimelineSpine,
  RECORD_SUBJECT_TIMELINE_SPINE_DOT_CLASS,
  resolveRecordSubjectTimelineEventTone,
  type RecordSubjectTimelineDirection,
  useRecordSubjectTimelineCopy,
} from './recordSubjectTimeline';

const HISTORY_KIND_ALL = 'ALL';
const HISTORY_EVENT_KINDS = recordEventKindSchema.options;

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

export const RecordEventHistoryDialog: React.FC<RecordEventHistoryDialogProps> = ({
  open,
  title,
  subjectKind,
  subjectId,
  field,
  fieldMap,
  contained = false,
  onClose,
  onRestore,
}) => {
  const copy = useRecordSubjectTimelineCopy();
  const dialogTitle = title ?? copy.title;
  const subjectKey = subjectId == null || subjectId === '' ? '' : String(subjectId);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [eventKind, setEventKind] = useState(HISTORY_KIND_ALL);
  const [items, setItems] = useState<RecordEventPublicRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timelineDirection, setTimelineDirection] = useState<RecordSubjectTimelineDirection>('newestFirst');
  const [selected, setSelected] = useState<RecordEventPublicRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { pageSize } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.recordEventHistory,
    defaultPageSize: DEFAULT_GRID_PAGE_SIZE,
  });
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    if (!open) return;
    setFromDate('');
    setToDate('');
    setFieldFilter(field?.trim() ?? '');
    setEventKind(HISTORY_KIND_ALL);
    setDetailOpen(false);
    setSelected(null);
  }, [open, field, subjectKind, subjectKey]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [eventKind, fieldFilter, fromDate, toDate, pageSize, subjectKind, subjectKey]);

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
        limit: visibleCount,
        offset: 0,
      }, signal);
      if (signal?.aborted) return;
      if (!response.ok) {
        setItems([]);
        setTotalCount(0);
        setLoadError(`${copy.loadFailedDetail} (HTTP ${response.status}).`);
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
      setLoadError(copy.loadFailedDetail);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    copy.loadFailedDetail,
    eventKind,
    fieldFilter,
    fieldMap,
    open,
    subjectKind,
    subjectKey,
    fromDate,
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
    setDetailOpen(false);
  }, [load, onRestore]);

  const hasMore = visibleCount < totalCount;
  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (!hasMore || isLoading) return;
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= 96) {
      setVisibleCount((current) => current + pageSize);
    }
  }, [hasMore, isLoading, pageSize]);

  const renderEventCard = useCallback(
    (item: RecordEventPublicRow, onSelect: () => void) => (
      <RecordSubjectTimelineRecordEventCard item={item} onSelect={onSelect} />
    ),
    [],
  );

  const resolveSpineDotClassName = useCallback((item: RecordEventPublicRow) => {
    const tone = resolveRecordSubjectTimelineEventTone(item);
    return RECORD_SUBJECT_TIMELINE_SPINE_DOT_CLASS[tone];
  }, []);

  const onEventSelect = useCallback((item: RecordEventPublicRow) => {
    setSelected(item);
    setDetailOpen(true);
  }, []);

  const sortedItems = useMemo(() => items, [items]);

  if (!open) {
    return null;
  }

  return (
    <>
      <CreateEditModalShell
        size="maximized"
        title={dialogTitle}
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
              <RecordSubjectTimelineSortToggle
                direction={timelineDirection}
                onToggle={() => setTimelineDirection((current) => (
                  current === 'newestFirst' ? 'oldestFirst' : 'newestFirst'
                ))}
              />
              <ToolbarRefreshButton
                onClick={() => void load()}
                isRefreshing={isLoading}
                separatorBefore={false}
              />
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            onScroll={handleScroll}
          >
            {isLoading && items.length === 0 ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                <LoadingSpinner className="h-4 w-4" />
                {copy.loading}
              </div>
            ) : null}
            {loadError ? (
              <QueryErrorPanel
                message={copy.loadFailed}
                detail={loadError}
                onRetry={() => void load()}
                isRetrying={isLoading}
                className="m-4"
              />
            ) : null}
            {!isLoading && !loadError && sortedItems.length === 0 ? (
              <SectionEmptyState className="m-4">{copy.empty}</SectionEmptyState>
            ) : null}
            {sortedItems.length > 0 ? (
              <RecordSubjectTimelineSpine
                events={sortedItems}
                direction={timelineDirection}
                resolveSpineDotClassName={resolveSpineDotClassName}
                renderEventCard={renderEventCard}
                onEventSelect={onEventSelect}
              />
            ) : null}
            {isLoading && items.length > 0 ? (
              <p className="pb-6 text-center text-xs text-slate-500">{copy.loading}</p>
            ) : null}
          </div>
        </div>
      </CreateEditModalShell>
      <RecordSubjectTimelineEventDetailDialog
        open={detailOpen}
        item={selected}
        onClose={() => setDetailOpen(false)}
        onRestore={onRestore ? restoreRow : undefined}
      />
    </>
  );
};
