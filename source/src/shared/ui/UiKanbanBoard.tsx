import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import type { AppSurfaceBoxTone } from './surfaceClasses';

export type UiKanbanCardAccent = 'default' | 'warning' | 'danger';

export type UiKanbanCardBadge = {
  label: string;
  tone?: UiKanbanCardAccent | 'info';
};

export type UiKanbanCard = {
  id: string;
  title: string;
  description?: string;
  /** Compact label chips under the title (e.g. "3 days in stage"). */
  badges?: UiKanbanCardBadge[];
  /** Small identity chip (e.g. customer initials) rendered beside the title. */
  avatar?: { label: string; tone?: UiKanbanTone };
  /** Secondary meta line under the title/badges (e.g. amount, close date). */
  meta?: string;
  /** Left accent bar tone — e.g. `danger` for an overdue close date. Default: no accent. */
  accent?: UiKanbanCardAccent;
};

export type UiKanbanTone = AppSurfaceBoxTone;

export type UiKanbanHeight = 'auto' | 'full';

export type UiKanbanColumnWidth = 'sm' | 'md' | 'lg';

export type UiKanbanColumnLayout = 'scroll' | 'fill';

export type UiKanbanDensity = 'compact' | 'comfortable';

export type UiKanbanColumn = {
  id: string;
  title: string;
  cards: UiKanbanCard[];
  /** Optional chrome tone for this column (falls back to board `tone`). */
  tone?: UiKanbanTone;
};

export type UiKanbanBoardProps = {
  columns: UiKanbanColumn[];
  /** Called after a drag completes (cross-column move or in-column reorder). */
  onColumnsChange?: (columns: UiKanbanColumn[]) => void;
  /** Called when a card moves to a different column. */
  onCardMove?: (payload: {
    card: UiKanbanCard;
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    fromIndex: number;
    toIndex: number;
    columns: UiKanbanColumn[];
  }) => void;
  /** When false, renders a static read-only board — no `@dnd-kit` context, no drag handlers. Default true. */
  interactive?: boolean;
  /** Enables keyboard dragging independently from pointer dragging. Default true. */
  enableKeyboardMove?: boolean;
  /** Rejects a proposed cross-column move before the board mutates. */
  canMoveCard?: (payload: {
    card: UiKanbanCard;
    fromColumnId: string;
    toColumnId: string;
    columns: UiKanbanColumn[];
  }) => boolean;
  /**
   * Bump to force the board back to `columns` after an optimistic drop
   * (confirm overlay cancel / failed save). Identity-stable `columns` alone will not revert.
   */
  revertSignal?: unknown;
  className?: string;
  /** `full` fills the host height (100%); `auto` sizes to content. */
  height?: UiKanbanHeight;
  /** Default column chrome tone (overridden by `column.tone`). */
  tone?: UiKanbanTone;
  columnWidth?: UiKanbanColumnWidth;
  /** `scroll` uses fixed column widths; `fill` stretches columns across the board width. */
  columnLayout?: UiKanbanColumnLayout;
  density?: UiKanbanDensity;
  showCardCount?: boolean;
  showDescriptions?: boolean;
  /** When true, each column's header/accent uses `column.tone` (falls back to `tone`); when false (default), every column renders neutral `slate` regardless of `column.tone`. */
  coloredColumns?: boolean;
  /** Fires on pointer click when the card was not dragged. */
  onCardClick?: (payload: { card: UiKanbanCard; columnId: string }) => void;
};

type KanbanAppearance = {
  height: UiKanbanHeight;
  tone: UiKanbanTone;
  columnWidth: UiKanbanColumnWidth;
  columnLayout: UiKanbanColumnLayout;
  density: UiKanbanDensity;
  showCardCount: boolean;
  showDescriptions: boolean;
  coloredColumns: boolean;
};

const COLUMN_WIDTH_CLASS: Record<UiKanbanColumnWidth, string> = {
  sm: 'w-[180px] min-w-[180px]',
  md: 'w-[220px] min-w-[220px]',
  lg: 'w-[280px] min-w-[280px]',
};

const COLUMN_WIDTH_FILL_CLASS: Record<UiKanbanColumnWidth, string> = {
  sm: 'min-w-[180px] flex-1',
  md: 'min-w-[220px] flex-1',
  lg: 'min-w-[280px] flex-1',
};

const TONE_CHROME: Record<UiKanbanTone, { column: string; title: string; accent: string; count: string }> = {
  slate: {
    column: 'border-slate-200 bg-slate-50',
    title: 'text-slate-600',
    accent: 'bg-slate-400',
    count: 'bg-slate-200/80 text-slate-600',
  },
  violet: {
    column: 'border-violet-200 bg-violet-50/70',
    title: 'text-violet-800',
    accent: 'bg-violet-400',
    count: 'bg-violet-100 text-violet-700',
  },
  cyan: {
    column: 'border-cyan-200 bg-cyan-50/70',
    title: 'text-cyan-800',
    accent: 'bg-cyan-400',
    count: 'bg-cyan-100 text-cyan-700',
  },
  indigo: {
    column: 'border-indigo-200 bg-indigo-50/70',
    title: 'text-indigo-800',
    accent: 'bg-indigo-400',
    count: 'bg-indigo-100 text-indigo-700',
  },
  emerald: {
    column: 'border-emerald-200 bg-emerald-50/70',
    title: 'text-emerald-800',
    accent: 'bg-emerald-400',
    count: 'bg-emerald-100 text-emerald-700',
  },
  amber: {
    column: 'border-amber-200 bg-amber-50/70',
    title: 'text-amber-800',
    accent: 'bg-amber-400',
    count: 'bg-amber-100 text-amber-800',
  },
  rose: {
    column: 'border-rose-200 bg-rose-50/70',
    title: 'text-rose-800',
    accent: 'bg-rose-400',
    count: 'bg-rose-100 text-rose-700',
  },
};

const KanbanAppearanceContext = React.createContext<KanbanAppearance>({
  height: 'auto',
  tone: 'slate',
  columnWidth: 'md',
  columnLayout: 'fill',
  density: 'comfortable',
  showCardCount: true,
  showDescriptions: true,
  coloredColumns: false,
});

/** Skip layout animation while an item is mid-drag so cross-column moves don't offset the source. */
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

const KanbanCardInteractionContext = React.createContext<{
  onCardClick?: (payload: { card: UiKanbanCard; columnId: string }) => void;
  suppressClickRef: React.MutableRefObject<boolean>;
}>({
  suppressClickRef: { current: false },
});

const CARD_ACCENT_BAR_CLASS: Record<UiKanbanCardAccent, string> = {
  default: 'bg-transparent',
  warning: 'bg-amber-400',
  danger: 'bg-rose-500',
};

const CARD_BADGE_CLASS: Record<NonNullable<UiKanbanCardBadge['tone']>, string> = {
  default: 'bg-slate-100 text-slate-600',
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-700',
};

const AVATAR_TONE_CLASS: Record<UiKanbanTone, string> = {
  slate: 'bg-slate-200 text-slate-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  violet: 'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
};

const UiKanbanCardView: React.FC<{ card: UiKanbanCard; dragging?: boolean; clickable?: boolean }> = ({
  card,
  dragging,
  clickable,
}) => {
  const { density, showDescriptions } = React.useContext(KanbanAppearanceContext);
  const accent = card.accent ?? 'default';
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm',
        density === 'compact' ? 'p-1.5 ps-2.5' : 'p-2 ps-3',
        clickable && !dragging && 'cursor-pointer hover:border-indigo-200 hover:shadow-md',
        dragging && 'shadow-lg ring-1 ring-slate-200',
      )}
    >
      {accent !== 'default' ? (
        <div className={cn('absolute inset-y-0 start-0 w-1', CARD_ACCENT_BAR_CLASS[accent])} aria-hidden />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className={cn('min-w-0 flex-1 font-medium text-slate-800', density === 'compact' ? 'text-xs' : 'text-sm')}>
          {card.title}
        </div>
        {card.avatar ? (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full font-semibold',
              density === 'compact' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]',
              AVATAR_TONE_CLASS[card.avatar.tone ?? 'slate'],
            )}
            title={card.avatar.label}
          >
            {card.avatar.label.slice(0, 2).toUpperCase()}
          </span>
        ) : null}
      </div>
      {showDescriptions && card.description ? (
        <p className={cn('text-slate-600', density === 'compact' ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs')}>
          {card.description}
        </p>
      ) : null}
      {card.meta ? (
        <p className={cn('mt-1 text-slate-500', density === 'compact' ? 'text-[10px]' : 'text-[11px]')}>
          {card.meta}
        </p>
      ) : null}
      {card.badges?.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {card.badges.map((badge, index) => (
            <span
              key={`${badge.label}-${index}`}
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                CARD_BADGE_CLASS[badge.tone ?? 'default'],
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const KanbanCardShell: React.FC<{
  card: UiKanbanCard;
  columnId: string;
  sortable?: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown> | undefined;
    isDragging: boolean;
  };
}> = ({ card, columnId, sortable }) => {
  const { onCardClick, suppressClickRef } = React.useContext(KanbanCardInteractionContext);
  const clickable = Boolean(onCardClick);
  const handleClick = () => {
    if (!onCardClick) {
      return;
    }
    if (suppressClickRef.current) {
      return;
    }
    onCardClick({ card, columnId });
  };
  return (
    <div
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className="touch-none"
      {...(sortable?.attributes ?? {})}
      {...(sortable?.listeners ?? {})}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={clickable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <UiKanbanCardView card={card} dragging={sortable?.isDragging} clickable={clickable} />
    </div>
  );
};

const SortableKanbanCard: React.FC<{ card: UiKanbanCard; columnId: string }> = ({ card, columnId }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    animateLayoutChanges,
  });
  // With DragOverlay, keep the source as a static placeholder — applying the
  // pointer transform after a cross-column remount paints the card in the wrong spot.
  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <KanbanCardShell
      card={card}
      columnId={columnId}
      sortable={{
        setNodeRef,
        style,
        attributes,
        listeners,
        isDragging,
      }}
    />
  );
};

const KanbanColumnShell: React.FC<{
  title: string;
  cardCount: number;
  tone: UiKanbanTone;
  children: React.ReactNode;
  droppableRef?: (node: HTMLElement | null) => void;
}> = ({ title, cardCount, tone, children, droppableRef }) => {
  const { height, columnWidth, columnLayout, density, showCardCount } = React.useContext(KanbanAppearanceContext);
  const chrome = TONE_CHROME[tone];
  const widthClass = columnLayout === 'fill'
    ? COLUMN_WIDTH_FILL_CLASS[columnWidth]
    : COLUMN_WIDTH_CLASS[columnWidth];
  return (
    <div
      ref={droppableRef}
      className={cn(
        'relative overflow-hidden rounded-lg border',
        columnLayout === 'fill' ? 'min-w-0' : 'shrink-0',
        widthClass,
        chrome.column,
        density === 'compact' ? 'p-1.5' : 'p-2',
        height === 'full' && 'flex h-full min-h-0 flex-col',
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-0.5', chrome.accent)} aria-hidden />
      <div
        className={cn(
          'mb-2 flex items-center justify-between gap-2 px-1',
          density === 'compact' ? 'mb-1.5' : 'mb-2',
        )}
      >
        <div
          className={cn(
            'font-semibold uppercase tracking-wide',
            chrome.title,
            density === 'compact' ? 'text-[10px]' : 'text-xs',
          )}
        >
          {title}
        </div>
        {showCardCount ? (
          <span
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
              chrome.count,
            )}
          >
            {cardCount}
          </span>
        ) : null}
      </div>
      {/* Prefer space-y over flex gap — CSS gap skews @dnd-kit sortable measurements. */}
      <div
        className={cn(
          'flex flex-col',
          density === 'compact' ? 'min-h-6 space-y-1.5' : 'min-h-8 space-y-2',
          height === 'full' && 'min-h-0 flex-1 overflow-y-auto',
        )}
      >
        {children}
      </div>
    </div>
  );
};

const SortableKanbanColumn: React.FC<{ column: UiKanbanColumn }> = ({ column }) => {
  const { tone: boardTone, coloredColumns } = React.useContext(KanbanAppearanceContext);
  const { setNodeRef } = useDroppable({ id: column.id });
  return (
    <KanbanColumnShell
      title={column.title}
      cardCount={column.cards.length}
      tone={coloredColumns ? (column.tone ?? boardTone) : 'slate'}
      droppableRef={setNodeRef}
    >
      <SortableContext items={column.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        {column.cards.map((card) => (
          <SortableKanbanCard key={card.id} card={card} columnId={column.id} />
        ))}
      </SortableContext>
    </KanbanColumnShell>
  );
};

const findContainerId = (columns: UiKanbanColumn[], id: string): string | undefined => {
  if (columns.some((column) => column.id === id)) {
    return id;
  }
  return columns.find((column) => column.cards.some((card) => card.id === id))?.id;
};

/**
 * Multi-column drag-and-drop Kanban board over `@dnd-kit` (`core` + `sortable`) —
 * `closestCorners` collision detection; DragOverlay portaled to `document.body`
 * so shell/scroll transforms cannot offset the drag preview.
 */
export const UiKanbanBoard: React.FC<UiKanbanBoardProps> = ({
  columns,
  onColumnsChange,
  onCardMove,
  interactive = true,
  enableKeyboardMove = true,
  canMoveCard,
  className,
  height = 'auto',
  tone = 'slate',
  columnWidth = 'md',
  columnLayout = 'fill',
  density = 'comfortable',
  showCardCount = true,
  showDescriptions = true,
  coloredColumns = false,
  onCardClick,
  revertSignal,
}) => {
  const [board, setBoard] = React.useState(columns);
  const [activeCard, setActiveCard] = React.useState<UiKanbanCard | null>(null);
  const boardRef = React.useRef(columns);
  const suppressClickRef = React.useRef(false);
  const cardInteraction = React.useMemo(
    () => ({ onCardClick, suppressClickRef }),
    [onCardClick],
  );
  const dragOriginRef = React.useRef<{
    columnId: string;
    cardId: string;
    fromIndex: number;
  } | null>(null);

  React.useEffect(() => {
    boardRef.current = columns;
    setBoard(columns);
  }, [columns, revertSignal]);

  const appearance = React.useMemo<KanbanAppearance>(
    () => ({ height, tone, columnWidth, columnLayout, density, showCardCount, showDescriptions, coloredColumns }),
    [height, tone, columnWidth, columnLayout, density, showCardCount, showDescriptions, coloredColumns],
  );

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 4 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(...(enableKeyboardMove ? [pointerSensor, keyboardSensor] : [pointerSensor]));

  const boardClassName = cn(
    'flex gap-3',
    columnLayout === 'fill' ? 'w-full min-w-0' : 'overflow-x-auto',
    height === 'full' ? 'h-full min-h-0 items-stretch pb-0' : 'pb-2',
    className,
  );

  const renderColumns = (interactiveMode: boolean) =>
    board.map((column) =>
      interactiveMode ? (
        <SortableKanbanColumn key={column.id} column={column} />
      ) : (
        <KanbanColumnShell
          key={column.id}
          title={column.title}
          cardCount={column.cards.length}
          tone={coloredColumns ? (column.tone ?? tone) : 'slate'}
        >
          {column.cards.map((card) => (
            <KanbanCardShell key={card.id} card={card} columnId={column.id} />
          ))}
        </KanbanColumnShell>
      ),
    );

  if (!interactive) {
    return (
      <KanbanAppearanceContext.Provider value={appearance}>
        <KanbanCardInteractionContext.Provider value={cardInteraction}>
          <div className={boardClassName}>{renderColumns(false)}</div>
        </KanbanCardInteractionContext.Provider>
      </KanbanAppearanceContext.Provider>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    suppressClickRef.current = true;
    const currentBoard = boardRef.current;
    const containerId = findContainerId(currentBoard, String(event.active.id));
    const card = currentBoard.find((column) => column.id === containerId)?.cards.find((c) => c.id === event.active.id);
    const fromIndex = containerId
      ? (currentBoard.find((column) => column.id === containerId)?.cards.findIndex((c) => c.id === event.active.id) ?? -1)
      : -1;
    dragOriginRef.current = containerId && fromIndex >= 0
      ? { columnId: containerId, cardId: String(event.active.id), fromIndex }
      : null;
    setActiveCard(card ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const currentBoard = boardRef.current;
    const activeContainer = findContainerId(currentBoard, String(active.id));
    const overContainer = findContainerId(currentBoard, String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    const activeColumn = currentBoard.find((column) => column.id === activeContainer);
    const overColumn = currentBoard.find((column) => column.id === overContainer);
    const activeCardItem = activeColumn?.cards.find((c) => c.id === active.id);
    if (!activeColumn || !overColumn || !activeCardItem) {
      return;
    }
    if (canMoveCard && !canMoveCard({
      card: activeCardItem,
      fromColumnId: activeContainer,
      toColumnId: overContainer,
      columns: currentBoard,
    })) {
      return;
    }

    const overIndex = overColumn.cards.findIndex((c) => c.id === over.id);
    const insertIndex = overIndex >= 0 ? overIndex : overColumn.cards.length;
    const nextBoard = currentBoard.map((column) => {
      if (column.id === activeContainer) {
        return { ...column, cards: column.cards.filter((c) => c.id !== active.id) };
      }
      if (column.id === overContainer) {
        const nextCards = [...column.cards];
        nextCards.splice(insertIndex, 0, activeCardItem);
        return { ...column, cards: nextCards };
      }
      return column;
    });
    boardRef.current = nextBoard;
    setBoard(nextBoard);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    const currentBoard = boardRef.current;
    let nextBoard = currentBoard;
    if (over) {
      const activeContainer = findContainerId(currentBoard, String(active.id));
      const overContainer = findContainerId(currentBoard, String(over.id));
      if (activeContainer && overContainer && activeContainer === overContainer && active.id !== over.id) {
        nextBoard = currentBoard.map((column) => {
          if (column.id !== activeContainer) return column;
          const oldIndex = column.cards.findIndex((c) => c.id === active.id);
          const newIndex = column.cards.findIndex((c) => c.id === over.id);
          return { ...column, cards: arrayMove(column.cards, oldIndex, newIndex) };
        });
        boardRef.current = nextBoard;
        setBoard(nextBoard);
      }
    }

    const dragOrigin = dragOriginRef.current;
    let cardMovePayload: Parameters<NonNullable<UiKanbanBoardProps['onCardMove']>>[0] | null = null;
    if (dragOrigin) {
      const destinationColumn = nextBoard.find((column) => column.cards.some((card) => card.id === dragOrigin.cardId));
      const movedCard = destinationColumn?.cards.find((card) => card.id === dragOrigin.cardId);
      const toIndex = destinationColumn?.cards.findIndex((card) => card.id === dragOrigin.cardId) ?? -1;
      if (
        movedCard
        && destinationColumn
        && destinationColumn.id !== dragOrigin.columnId
        && toIndex >= 0
      ) {
        cardMovePayload = {
          card: movedCard,
          cardId: dragOrigin.cardId,
          fromColumnId: dragOrigin.columnId,
          toColumnId: destinationColumn.id,
          fromIndex: dragOrigin.fromIndex,
          toIndex,
          columns: nextBoard,
        };
      }
    }
    dragOriginRef.current = null;
    onColumnsChange?.(nextBoard);
    if (cardMovePayload) {
      onCardMove?.(cardMovePayload);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleDragCancel = () => {
    setActiveCard(null);
    dragOriginRef.current = null;
    suppressClickRef.current = false;
    boardRef.current = columns;
    setBoard(columns);
  };

  return (
    <KanbanAppearanceContext.Provider value={appearance}>
      <KanbanCardInteractionContext.Provider value={cardInteraction}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={boardClassName}>{renderColumns(true)}</div>
        {typeof document !== 'undefined'
          ? createPortal(
              <KanbanAppearanceContext.Provider value={appearance}>
                <DragOverlay dropAnimation={null}>
                  {activeCard ? <UiKanbanCardView card={activeCard} dragging /> : null}
                </DragOverlay>
              </KanbanAppearanceContext.Provider>,
              document.body,
            )
          : null}
      </DndContext>
      </KanbanCardInteractionContext.Provider>
    </KanbanAppearanceContext.Provider>
  );
};
