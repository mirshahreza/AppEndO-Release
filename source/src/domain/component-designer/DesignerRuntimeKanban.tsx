import * as React from 'react';
import { UiKanbanBoard } from '../../shared/ui/UiKanbanBoard';
import { parseDesignerKanbanBoard, type DesignerKanbanBoard } from './visualizationDataModel';
import { MOCK_KANBAN_BOARD_JSON } from './visualizationMockFixtures';
import { readString } from './runtimeShared';
import type { DesignerNode } from './types';
import type { VizWidgetResolveOptions } from './designerVizRuntimeResolve';
import { resolveBoundVizDataValue } from './designerVizRuntimeResolve';
import { renderDesignerVizDataState } from './designerVizDataState';

const isBoardAheadOfResolved = (
  current: DesignerKanbanBoard,
  resolved: DesignerKanbanBoard,
): boolean => {
  for (const column of current.columns) {
    for (const card of column.cards) {
      const resolvedColumn = resolved.columns.find((entry) =>
        entry.cards.some((entryCard) => entryCard.id === card.id),
      );
      if (resolvedColumn && resolvedColumn.id !== column.id) {
        return true;
      }
    }
  }
  return false;
};

export const DesignerVizKanban: React.FC<{
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
  interactive?: boolean;
  onCardMove?: (event: Event) => void;
  /**
   * Change this (any type — a boolean toggle via a `showHide`/`toggle` dynamic action is the
   * simplest wiring) when a drop's follow-up confirm is Cancelled — forces the board back to
   * `resolvedBoard`, bypassing `isBoardAheadOfResolved` (which otherwise treats the optimistic
   * post-drop state as "ahead" of a resolved board that never actually changed server-side, and
   * so never reverts on its own). Any change to this value triggers a revert.
   */
  revertSignal?: unknown;
  showCardCount?: boolean;
  density?: 'compact' | 'comfortable';
  tone?: React.ComponentProps<typeof UiKanbanBoard>['tone'];
  columnWidth?: React.ComponentProps<typeof UiKanbanBoard>['columnWidth'];
  columnLayout?: React.ComponentProps<typeof UiKanbanBoard>['columnLayout'];
  showDescriptions?: boolean;
  height?: React.ComponentProps<typeof UiKanbanBoard>['height'];
  coloredColumns?: boolean;
}> = ({
  title = 'Kanban',
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
  interactive: interactiveProp,
  onCardMove,
  revertSignal,
  showCardCount,
  density,
  tone,
  columnWidth,
  columnLayout,
  showDescriptions,
  height,
  coloredColumns,
}) => {
  const interactive = interactiveProp ?? Boolean(onCardMove);
  const resolvedBoard = React.useMemo(() => parseDesignerKanbanBoard(
    data && (typeof data === 'string' ? data.length > 0 : true)
      ? data
      : (vizListBound ? { columns: [] } : MOCK_KANBAN_BOARD_JSON),
  ), [data, vizListBound]);
  const [board, setBoard] = React.useState(resolvedBoard);

  React.useEffect(() => {
    setBoard((current) => (
      isBoardAheadOfResolved(current, resolvedBoard) ? current : resolvedBoard
    ));
  }, [resolvedBoard]);

  const revertSignalRef = React.useRef(revertSignal);
  React.useEffect(() => {
    if (revertSignal === undefined || revertSignal === revertSignalRef.current) {
      return;
    }
    revertSignalRef.current = revertSignal;
    setBoard(resolvedBoard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revertSignal]);

  const handleCardMove = React.useCallback((payload: {
    card: { id: string; title: string; description?: string };
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    fromIndex: number;
    toIndex: number;
    columns: DesignerKanbanBoard['columns'];
  }) => {
    setBoard({ columns: payload.columns });
    const destinationColumn = payload.columns.find((column) => column.id === payload.toColumnId);
    onCardMove?.({
      target: {
        value: {
          ...payload,
          toColumnTitle: destinationColumn?.title ?? payload.toColumnId,
        },
      },
    } as unknown as Event);
  }, [onCardMove]);

  return (
    <div className={className} style={style} data-designer-component="viz.kanban">
      {title ? <h3 className="mb-3 ps-[4px] text-sm font-semibold text-slate-800">{title}</h3> : null}
      {toolbar}
      {renderDesignerVizDataState({
        isLoading: vizListLoading || isLoading,
        loadingMessage: 'Loading board…',
        hasError: vizListError,
        errorContent,
        isEmpty: vizListBound && board.columns.length === 0,
        emptyContent,
        children: (
        <UiKanbanBoard
          columns={board.columns}
          interactive={interactive}
          onColumnsChange={(columns) => {
            setBoard({ columns });
          }}
          onCardMove={handleCardMove}
          showCardCount={showCardCount}
          density={density}
          tone={tone}
          columnWidth={columnWidth}
          columnLayout={columnLayout}
          showDescriptions={showDescriptions}
          height={height}
          coloredColumns={coloredColumns}
        />
        ),
      })}
    </div>
  );
};

export const resolveKanbanPropsFromNode = (
  node: DesignerNode,
  options: VizWidgetResolveOptions = {},
) => ({
  title: readString(node.props.title, 'Kanban'),
  data: resolveBoundVizDataValue(node, MOCK_KANBAN_BOARD_JSON, options),
  className: readString(node.props.className, 'w-full'),
  vizListBound: options.vizListBound,
  vizListLoading: options.vizListLoading,
  vizListError: options.vizListError,
  isLoading: node.props.isLoading === true,
  emptyContent: readString(node.props.emptyContent),
  showCardCount: node.props.showCardCount === undefined ? undefined : node.props.showCardCount === true,
  density: node.props.density === 'compact' || node.props.density === 'comfortable' ? node.props.density : undefined,
  tone: readString(node.props.tone) || undefined,
  columnWidth: node.props.columnWidth === 'sm' || node.props.columnWidth === 'md' || node.props.columnWidth === 'lg' ? node.props.columnWidth : undefined,
  columnLayout: node.props.columnLayout === 'scroll' || node.props.columnLayout === 'fill' ? node.props.columnLayout : undefined,
  showDescriptions: node.props.showDescriptions === undefined ? undefined : node.props.showDescriptions === true,
  height: node.props.height === 'auto' || node.props.height === 'full' ? node.props.height : undefined,
  coloredColumns: node.props.coloredColumns === true,
  errorContent: readString(node.props.errorContent),
  toolbar: options.toolbar,
  interactive: options.interactive,
  onCardMove: options.onCardMove,
});
