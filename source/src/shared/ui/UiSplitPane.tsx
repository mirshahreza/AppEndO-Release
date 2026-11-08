import * as React from 'react';
import { cn } from '../../lib/utils';
import { beginWorkspaceSplitPointerDrag } from './workspaceSplitDragSession';

export const UI_SPLIT_PANE_MIN_PERCENT = 8;

export type UiSplitPaneDirection = 'horizontal' | 'vertical';

export type UiSplitPaneProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  direction?: UiSplitPaneDirection;
  defaultSplit?: number;
  children?: React.ReactNode;
};

const clampPercent = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const buildUiSplitPaneSizes = (
  paneCount: number,
  defaultSplit = 50,
  minPercent = UI_SPLIT_PANE_MIN_PERCENT,
): number[] => {
  const count = Math.max(1, Math.floor(paneCount));
  if (count === 1) {
    return [100];
  }
  if (count === 2) {
    const first = clampPercent(Number(defaultSplit) || 50, minPercent, 100 - minPercent);
    return [first, 100 - first];
  }
  const even = 100 / count;
  return Array.from({ length: count }, () => even);
};

export const applyUiSplitPaneDrag = (
  sizes: number[],
  dividerIndex: number,
  deltaPercent: number,
  minPercent = UI_SPLIT_PANE_MIN_PERCENT,
): number[] => {
  const left = dividerIndex;
  const right = dividerIndex + 1;
  if (left < 0 || right >= sizes.length) {
    return sizes;
  }
  const pair = sizes[left] + sizes[right];
  const nextLeft = clampPercent(sizes[left] + deltaPercent, minPercent, pair - minPercent);
  const next = [...sizes];
  next[left] = nextLeft;
  next[right] = pair - nextLeft;
  return next;
};

const paneStyle = (
  index: number,
  sizes: number[],
  isVertical: boolean,
): React.CSSProperties | undefined => {
  if (sizes.length === 2) {
    if (index !== 0) {
      return undefined;
    }
    const value = `${sizes[0]}%`;
    return isVertical ? { height: value } : { width: value };
  }
  return {
    flexBasis: `${sizes[index]}%`,
    flexGrow: 0,
    flexShrink: 0,
  };
};

export const UiSplitPane: React.FC<UiSplitPaneProps> = ({
  direction = 'horizontal',
  defaultSplit = 50,
  className,
  children,
  ...rest
}) => {
  const isVertical = direction === 'vertical';
  const panes = React.Children.toArray(children);
  const paneCount = Math.max(panes.length, 0);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const sizesRef = React.useRef<number[]>([]);
  const [sizes, setSizes] = React.useState(() => buildUiSplitPaneSizes(paneCount || 2, defaultSplit));
  const [resizingIndex, setResizingIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    setSizes(buildUiSplitPaneSizes(paneCount || 2, defaultSplit));
  }, [paneCount, defaultSplit, direction]);

  sizesRef.current = sizes;

  const handleSplitterPointerDown = React.useCallback((
    dividerIndex: number,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const axisSize = isVertical ? rect.height : rect.width;
    if (axisSize <= 0) {
      return;
    }
    const start = isVertical ? event.clientY : event.clientX;
    const startSizes = sizesRef.current;
    setResizingIndex(dividerIndex);
    beginWorkspaceSplitPointerDrag({
      pointerId: event.pointerId,
      captureElement: event.currentTarget,
      onMove: (clientX, clientY) => {
        const pos = isVertical ? clientY : clientX;
        const deltaPercent = ((pos - start) / axisSize) * 100;
        setSizes(applyUiSplitPaneDrag(startSizes, dividerIndex, deltaPercent));
      },
      onFinish: () => setResizingIndex(null),
    });
  }, [isVertical]);

  const displayPanes = paneCount > 0 ? panes : [
    <div key="split-placeholder-a" className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/80 p-3 text-xs text-slate-500">
      Pane
    </div>,
    <div key="split-placeholder-b" className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-3 text-xs text-slate-500">
      Pane
    </div>,
  ];
  const displayCount = displayPanes.length;
  const displaySizes = sizes.length === displayCount
    ? sizes
    : buildUiSplitPaneSizes(displayCount, defaultSplit);

  return (
    <div
      {...rest}
      ref={containerRef}
      className={cn(
        'flex min-h-[240px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white',
        isVertical ? 'flex-col' : 'flex-row',
        resizingIndex !== null && 'select-none',
        className,
      )}
      data-split-direction={direction}
    >
      {displayPanes.map((child, index) => (
        <React.Fragment key={(child as React.ReactElement).key ?? index}>
          {index > 0 ? (
            <div
              role="separator"
              aria-orientation={isVertical ? 'horizontal' : 'vertical'}
              aria-label="Drag to resize"
              aria-valuenow={Math.round(displaySizes[index - 1] ?? 0)}
              aria-valuemin={UI_SPLIT_PANE_MIN_PERCENT}
              aria-valuemax={100 - UI_SPLIT_PANE_MIN_PERCENT}
              data-testid="ui-split-pane-splitter"
              data-split-index={String(index - 1)}
              className={cn(
                'relative z-10 shrink-0 touch-none bg-slate-300 hover:bg-primary-500/55',
                isVertical ? 'h-1.5 w-full cursor-row-resize' : 'w-1.5 self-stretch cursor-col-resize',
                resizingIndex === index - 1 && 'bg-primary-500/70',
              )}
              onPointerDown={(event) => handleSplitterPointerDown(index - 1, event)}
            />
          ) : null}
          <div
            className={cn(
              'min-h-0 min-w-0 overflow-auto',
              displayCount === 2 && index === 0 ? 'shrink-0' : undefined,
              displayCount === 2 && index !== 0 ? 'flex-1' : undefined,
            )}
            style={paneStyle(index, displaySizes, isVertical)}
            data-split-pane-index={String(index)}
          >
            {child}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
