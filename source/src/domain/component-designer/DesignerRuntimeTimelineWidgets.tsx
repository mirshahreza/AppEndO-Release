import * as React from 'react';
import {
  parseDesignerGanttDependencies,
  parseDesignerGanttMilestones,
  parseDesignerTimelineEvents,
  type DesignerGanttDependency,
  type DesignerGanttMilestone,
  type DesignerGanttViewMode,
  type DesignerTimelineEvent,
} from './visualizationDataModel';
import { MOCK_PROJECT_TIMELINE_JSON } from './visualizationMockFixtures';
import { mergeClassNames, readString } from './runtimeShared';
import type { DesignerNode } from './types';
import type { VizWidgetResolveOptions } from './designerVizRuntimeResolve';
import { resolveBoundVizDataValue } from './designerVizRuntimeResolve';
import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { DEFAULT_TREE_EMPTY_MESSAGE, renderDesignerVizDataState } from './designerVizDataState';

const resolveTimelineData = (raw: unknown, vizListBound?: boolean): DesignerTimelineEvent[] => {
  const parsed = parseDesignerTimelineEvents(raw);
  if (parsed.length > 0) {
    return parsed;
  }
  if (vizListBound) {
    return [];
  }
  return parseDesignerTimelineEvents(MOCK_PROJECT_TIMELINE_JSON);
};

const parseDate = (value: string): number => {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const formatIsoDate = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

const clampProgress = (progress: number | undefined): number | null =>
  typeof progress === 'number' ? Math.min(Math.max(progress, 0), 100) : null;

const FILL_WIDTH_UTILITY = /(?:^|\s)(?:[a-z0-9-]+:)?!?w-(?:full|\[100%\])(?:\s|$)/;
const FILL_HEIGHT_UTILITY = /(?:^|\s)(?:[a-z0-9-]+:)?!?h-(?:full|\[100%\])(?:\s|$)/;

const resolveGanttShellClassName = (className: string | undefined): string => {
  const tokens = className ?? '';
  return mergeClassNames(
    'flex min-h-0 min-w-0 flex-col',
    FILL_WIDTH_UTILITY.test(tokens) && 'w-full self-stretch',
    FILL_HEIGHT_UTILITY.test(tokens) && 'h-full flex-1 self-stretch',
    tokens,
  );
};

const normalizeGanttViewMode = (value: unknown): DesignerGanttViewMode =>
  value === 'day' || value === 'week' || value === 'month' ? value : 'week';

const getUtcDateParts = (ts: number): [number, number, number] => {
  const date = new Date(ts);
  return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
};

const startOfUtcDay = (ts: number): number => {
  const [year, month, day] = getUtcDateParts(ts);
  return Date.UTC(year, month, day);
};

const addUtcDays = (ts: number, days: number): number => {
  const [year, month, day] = getUtcDateParts(ts);
  return Date.UTC(year, month, day + days);
};

const alignDomainStart = (ts: number, viewMode: DesignerGanttViewMode): number => {
  const [year, month, day] = getUtcDateParts(ts);
  if (viewMode === 'month') {
    return Date.UTC(year, month, 1);
  }
  if (viewMode === 'week') {
    const weekday = new Date(ts).getUTCDay();
    const delta = weekday === 0 ? -6 : 1 - weekday;
    return Date.UTC(year, month, day + delta);
  }
  return Date.UTC(year, month, day);
};

const alignDomainEnd = (ts: number, viewMode: DesignerGanttViewMode): number => {
  const [year, month, day] = getUtcDateParts(ts);
  if (viewMode === 'month') {
    return Date.UTC(year, month + 1, 1);
  }
  if (viewMode === 'week') {
    const weekday = new Date(ts).getUTCDay();
    const delta = weekday === 0 ? 1 : 8 - weekday;
    return Date.UTC(year, month, day + delta);
  }
  return Date.UTC(year, month, day + 1);
};

const advanceTick = (ts: number, viewMode: DesignerGanttViewMode): number => {
  if (viewMode === 'month') {
    const [year, month] = getUtcDateParts(ts);
    return Date.UTC(year, month + 1, 1);
  }
  return addUtcDays(ts, viewMode === 'week' ? 7 : 1);
};

const buildGanttTicks = (min: number, max: number, viewMode: DesignerGanttViewMode): number[] => {
  const start = alignDomainStart(min, viewMode);
  const end = Math.max(alignDomainEnd(max, viewMode), start + DAY_MS);
  const ticks: number[] = [];
  for (let cursor = start; cursor <= end; cursor = advanceTick(cursor, viewMode)) {
    ticks.push(cursor);
    if (ticks.length > 64) {
      break;
    }
  }
  if (ticks.length < 2 || ticks[ticks.length - 1] < end) {
    ticks.push(end);
  }
  if (ticks.length <= 12) {
    return ticks;
  }
  const stride = Math.ceil(ticks.length / 12);
  return ticks.filter((_, index) => index % stride === 0 || index === ticks.length - 1);
};

/** Mirrors DesignerRuntimeTreeWidgets.tsx's TreeEmptyState — shown when bound but zero rows resolved. */
const VizEmptyState: React.FC<{ message?: string }> = ({
  message = DEFAULT_TREE_EMPTY_MESSAGE,
}) => (
  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
    {message}
  </div>
);

export const DesignerVizTimeline: React.FC<{
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
  onSelectionChange?: (event: Event) => void;
}> = ({ title = 'Timeline', data, className, style, vizListBound, vizListLoading, vizListError, isLoading, emptyContent = DEFAULT_TREE_EMPTY_MESSAGE, errorContent, toolbar, onSelectionChange }) => {
  const events = resolveTimelineData(data, vizListBound).sort((a, b) => parseDate(a.start) - parseDate(b.start));

  return (
    <div className={className} style={style} data-designer-component="viz.timeline">
      {title ? <h3 className="mb-3 ps-[4px] text-sm font-semibold text-slate-800">{title}</h3> : null}
      {toolbar}
      {renderDesignerVizDataState({
        isLoading: vizListLoading || isLoading,
        loadingMessage: 'Loading timeline…',
        hasError: vizListError,
        errorContent,
        isEmpty: events.length === 0 && vizListBound,
        emptyContent,
        loadingClassName: 'flex h-20 items-center justify-center text-xs text-slate-500',
        children: (
        <ol className="relative border-s border-slate-200 ps-4 ms-2">
        {events.map((event, index) => {
          const eventId = event.id ?? `evt-${index}`;
          return (
            <li key={eventId} className="mb-4 ms-2">
              <span className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-sky-500" />
              <button
                type="button"
                className="block w-full rounded text-left hover:bg-slate-50"
                onClick={() => onSelectionChange?.({ target: { value: eventId } } as unknown as Event)}
              >
                <time className="text-[10px] font-medium text-slate-500">{event.start}{event.end && event.end !== event.start ? ` → ${event.end}` : ''}</time>
                <h4 className="text-sm font-semibold text-slate-800">{event.title}</h4>
                {event.description ? <p className="text-xs text-slate-600">{event.description}</p> : null}
              </button>
            </li>
          );
        })}
      </ol>
        ),
      })}
    </div>
  );
};

const formatGanttTick = (ts: number, _viewMode: DesignerGanttViewMode): string => (
  formatDisplayDateYmd(new Date(ts).toISOString())
);

type GanttDragPayload = {
  taskId: string;
  title: string;
  start: string;
  end: string;
  daysDelta: number;
  viewMode: DesignerGanttViewMode;
};

export const DesignerVizGantt: React.FC<{
  title?: string;
  data?: unknown;
  viewMode?: DesignerGanttViewMode;
  dependencies?: unknown;
  milestones?: unknown;
  allowTaskDrag?: boolean;
  className?: string;
  style?: React.CSSProperties;
  vizListBound?: boolean;
  vizListLoading?: boolean;
  vizListError?: boolean;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
  toolbar?: React.ReactNode;
  onSelectionChange?: (event: Event) => void;
  onTaskDrag?: (event: Event) => void;
}> = ({
  title = 'Gantt',
  data,
  viewMode: rawViewMode,
  dependencies: rawDependencies,
  milestones: rawMilestones,
  allowTaskDrag = false,
  className,
  style,
  vizListBound,
  vizListLoading,
  vizListError,
  isLoading,
  emptyContent = DEFAULT_TREE_EMPTY_MESSAGE,
  errorContent,
  toolbar,
  onSelectionChange,
  onTaskDrag,
}) => {
  const viewMode = normalizeGanttViewMode(rawViewMode);
  const resolvedEvents = React.useMemo(() => resolveTimelineData(data, vizListBound), [data, vizListBound]);
  const dependencies = React.useMemo(() => parseDesignerGanttDependencies(rawDependencies), [rawDependencies]);
  const milestones = React.useMemo(() => parseDesignerGanttMilestones(rawMilestones), [rawMilestones]);
  const [events, setEvents] = React.useState<DesignerTimelineEvent[]>(resolvedEvents);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{
    taskId: string;
    startX: number;
    span: number;
    originalStartTs: number;
    originalEndTs: number;
    lastDelta: number;
  } | null>(null);

  React.useEffect(() => {
    setEvents(resolvedEvents);
  }, [resolvedEvents]);

  const shellClassName = resolveGanttShellClassName(className);

  if (vizListLoading || isLoading || vizListError || events.length === 0) {
    return (
      <div className={shellClassName} style={style} data-designer-component="viz.gantt">
        {title ? <h3 className="mb-3 ps-[4px] text-sm font-semibold text-slate-800">{title}</h3> : null}
        {toolbar}
        {renderDesignerVizDataState({
          isLoading: vizListLoading || isLoading,
          loadingMessage: 'Loading schedule…',
          hasError: vizListError,
          errorContent,
          isEmpty: events.length === 0,
          emptyContent: vizListBound ? emptyContent : 'No events',
          children: <div className="text-xs text-slate-500">No events</div>,
        })}
      </div>
    );
  }

  const starts = events.map((e) => parseDate(e.start));
  const ends = events.map((e) => parseDate(e.end ?? e.start));
  const minEventTs = Math.min(...starts);
  const maxEventTs = Math.max(...ends);
  const min = alignDomainStart(minEventTs, viewMode);
  const max = Math.max(alignDomainEnd(maxEventTs, viewMode), min + DAY_MS);
  const span = Math.max(max - min, DAY_MS);
  const now = Date.now();
  const todayLeft = now >= min && now <= max ? ((now - min) / span) * 100 : null;
  const ticks = buildGanttTicks(min, max, viewMode);
  const rowMinHeight = 34;
  const rowCount = Math.max(events.length, 1);
  const rowPercent = 100 / rowCount;

  const eventLayout = events.map((event, index) => {
    const startTs = parseDate(event.start);
    const endTs = parseDate(event.end ?? event.start);
    const normalizedEnd = Math.max(endTs, startTs + DAY_MS);
    const left = ((startTs - min) / span) * 100;
    const width = Math.max(((normalizedEnd - startTs) / span) * 100, 4);
    return {
      event,
      eventId: event.id ?? `gantt-${index}`,
      startTs,
      endTs: normalizedEnd,
      left,
      width,
      progress: clampProgress(event.progress),
      top: index * rowPercent,
      height: rowPercent,
      centerY: (index + 0.5) * rowPercent,
    };
  });

  const eventPositionById = new Map(
    eventLayout.map((layout) => [layout.eventId, layout]),
  );

  const emitTaskDrag = React.useCallback((payload: GanttDragPayload) => {
    onTaskDrag?.({ target: { value: payload } } as unknown as Event);
  }, [onTaskDrag]);

  React.useEffect(() => {
    return () => {
      dragRef.current = null;
    };
  }, []);

  const startTaskDrag = (eventId: string, clientX: number) => {
    if (!allowTaskDrag || !trackRef.current) {
      return;
    }
    const layout = eventPositionById.get(eventId);
    if (!layout) {
      return;
    }
    dragRef.current = {
      taskId: eventId,
      startX: clientX,
      span,
      originalStartTs: layout.startTs,
      originalEndTs: layout.endTs,
      lastDelta: 0,
    };
  };

  React.useEffect(() => {
    if (!allowTaskDrag) {
      return undefined;
    }
    const handleMouseMove = (mouseEvent: MouseEvent) => {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track) {
        return;
      }
      const daysDelta = Math.round((((mouseEvent.clientX - drag.startX) / Math.max(track.clientWidth, 1)) * drag.span) / DAY_MS);
      if (daysDelta === drag.lastDelta) {
        return;
      }
      drag.lastDelta = daysDelta;
      setEvents((current) => current.map((task) => {
        const taskId = task.id ?? '';
        if (taskId !== drag.taskId) {
          return task;
        }
        const nextStart = formatIsoDate(addUtcDays(drag.originalStartTs, daysDelta));
        const nextEnd = formatIsoDate(addUtcDays(drag.originalEndTs, daysDelta));
        return {
          ...task,
          start: nextStart,
          end: nextEnd,
        };
      }));
    };
    const handleMouseUp = () => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      if (drag.lastDelta !== 0) {
        const finalTask = events.find((task) => (task.id ?? '') === drag.taskId);
        if (finalTask) {
          emitTaskDrag({
            taskId: drag.taskId,
            title: finalTask.title,
            start: finalTask.start,
            end: finalTask.end ?? finalTask.start,
            daysDelta: drag.lastDelta,
            viewMode,
          });
        }
      }
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [allowTaskDrag, emitTaskDrag, events, viewMode]);

  return (
    <div className={shellClassName} style={style} data-designer-component="viz.gantt">
      {title ? <h3 className="mb-3 shrink-0 ps-[4px] text-sm font-semibold text-slate-800">{title}</h3> : null}
      {toolbar}
      <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-[120px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-2">
        <div />
        <div className="flex min-w-0 justify-between text-[10px] text-slate-400">
          {ticks.map((tick, index) => (
            <span key={index} data-gantt-tick={viewMode}>{formatGanttTick(tick, viewMode)}</span>
          ))}
        </div>
        <div className="flex h-full min-h-0 flex-col">
          {eventLayout.map(({ eventId, event }) => (
            <div key={`label-${eventId}`} className="flex min-h-[34px] flex-1 items-center">
              <span className="truncate text-xs text-slate-700">{event.title}</span>
            </div>
          ))}
        </div>
        <div
          ref={trackRef}
          data-gantt-track="true"
          className="relative h-full min-h-0"
          style={{ minHeight: `${eventLayout.length * rowMinHeight}px` }}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <marker id="designer-gantt-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
              </marker>
            </defs>
            {dependencies.map((dependency: DesignerGanttDependency, index) => {
              const from = eventPositionById.get(dependency.fromTaskId);
              const to = eventPositionById.get(dependency.toTaskId);
              if (!from || !to) {
                return null;
              }
              const startX = from.left + from.width;
              const endX = to.left;
              const midX = Math.max(startX + 2, Math.min(((startX + endX) / 2), endX - 2));
              return (
                <path
                  key={`dep-${dependency.fromTaskId}-${dependency.toTaskId}-${index}`}
                  data-gantt-dependency={`${dependency.fromTaskId}:${dependency.toTaskId}`}
                  d={`M ${startX} ${from.centerY} L ${midX} ${from.centerY} L ${midX} ${to.centerY} L ${endX} ${to.centerY}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  markerEnd="url(#designer-gantt-arrow)"
                />
              );
            })}
          </svg>
          {eventLayout.map(({ event, eventId, left, width, progress, top, height }) => {
            const milestoneEntries = milestones.filter((entry: DesignerGanttMilestone) => entry.taskId === eventId);
            return (
              <div key={eventId} className="absolute left-0 right-0" style={{ top: `${top}%`, height: `${height}%` }}>
                <div className="relative h-full rounded bg-slate-100">
                  {todayLeft !== null ? (
                    <div className="absolute top-0 h-full w-px bg-rose-400" style={{ left: `${todayLeft}%` }} />
                  ) : null}
                  <button
                    type="button"
                    className={`absolute top-1/2 h-[18px] -translate-y-1/2 overflow-hidden rounded border border-sky-300 bg-sky-200 text-left ${allowTaskDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${event.start} – ${event.end ?? event.start}${progress !== null ? ` · ${progress}%` : ''}`}
                    onClick={() => onSelectionChange?.({ target: { value: eventId } } as unknown as Event)}
                    onMouseDown={(mouseEvent) => startTaskDrag(eventId, mouseEvent.clientX)}
                  >
                    <div className="h-full bg-sky-500" style={{ width: progress !== null ? `${progress}%` : '100%' }} />
                  </button>
                  {milestoneEntries.map((milestone, index) => (
                    <div
                      key={`${eventId}-milestone-${index}`}
                      data-gantt-milestone={milestone.label}
                      className="absolute top-[4px] flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${left + width}%` }}
                    >
                      <div className="h-3 w-3 rotate-45 border border-amber-500 bg-amber-300" />
                      <span className="mt-1 whitespace-nowrap text-[10px] text-amber-700">{milestone.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const resolveTimelinePropsFromNode = (
  node: DesignerNode,
  options: VizWidgetResolveOptions = {},
) => ({
  title: readString(node.props.title, 'Timeline'),
  data: resolveBoundVizDataValue(node, MOCK_PROJECT_TIMELINE_JSON, options),
  className: readString(node.props.className, 'w-full rounded-lg border border-slate-200 bg-white p-4'),
  vizListBound: options.vizListBound,
  vizListLoading: options.vizListLoading,
  vizListError: options.vizListError,
  isLoading: node.props.isLoading === true,
  emptyContent: readString(node.props.emptyContent, DEFAULT_TREE_EMPTY_MESSAGE),
  errorContent: readString(node.props.errorContent),
  toolbar: options.toolbar,
});

export const resolveGanttPropsFromNode = (
  node: DesignerNode,
  options: VizWidgetResolveOptions = {},
) => ({
  ...resolveTimelinePropsFromNode(node, options),
  viewMode: normalizeGanttViewMode(node.props.viewMode),
  dependencies: node.props.dependencies,
  milestones: node.props.milestones,
  allowTaskDrag: node.props.allowTaskDrag === true,
});

const resolveTimelineWidgetEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

type BoundTimelineWidgetProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  vizOptions: VizWidgetResolveOptions;
  style?: React.CSSProperties;
};

/** Preview wrapper — adds real onSelectionChange wiring (click a timeline entry / Gantt bar) on top of the presentational component. */
export const DesignerRuntimeVizTimeline: React.FC<BoundTimelineWidgetProps> = ({ node, options, vizOptions, style }) => {
  const base = resolveTimelinePropsFromNode(node, vizOptions);
  const eventProps = resolveTimelineWidgetEventProps(node, options);
  return <DesignerVizTimeline {...base} style={style} onSelectionChange={eventProps.onSelectionChange} />;
};

export const DesignerRuntimeVizGantt: React.FC<BoundTimelineWidgetProps> = ({ node, options, vizOptions, style }) => {
  const base = resolveGanttPropsFromNode(node, vizOptions);
  const eventProps = resolveTimelineWidgetEventProps(node, options);
  return (
    <DesignerVizGantt
      {...base}
      style={style}
      onSelectionChange={eventProps.onSelectionChange}
      onTaskDrag={eventProps.onTaskDrag}
    />
  );
};
