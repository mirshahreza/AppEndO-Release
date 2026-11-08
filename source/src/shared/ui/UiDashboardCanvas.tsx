import * as React from 'react';
import {
  GridLayout,
  horizontalCompactor,
  noCompactor,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { cn } from '../../lib/utils';

export type UiDashboardCanvasItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
};

export type UiDashboardCanvasProps = {
  className?: string;
  cols?: number;
  rowHeight?: number;
  margin?: [number, number];
  layout: UiDashboardCanvasItem[];
  isDraggable?: boolean;
  isResizable?: boolean;
  compactType?: 'vertical' | 'horizontal' | null;
  onLayoutChange?: (layout: UiDashboardCanvasItem[]) => void;
  children: React.ReactNode;
};

const compactors = {
  vertical: verticalCompactor,
  horizontal: horizontalCompactor,
} as const;

const asCanvasItems = (value: unknown): UiDashboardCanvasItem[] => (
  Array.isArray(value) ? value as UiDashboardCanvasItem[] : []
);

export const UiDashboardCanvas: React.FC<UiDashboardCanvasProps> = ({
  className,
  cols = 12,
  rowHeight = 48,
  margin = [12, 12],
  layout,
  isDraggable = true,
  isResizable = true,
  compactType = 'vertical',
  onLayoutChange,
  children,
}) => {
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1280 });
  const compactor = compactType === null
    ? noCompactor
    : compactors[compactType];

  return (
    <div
      ref={containerRef}
      className={cn('min-h-[12rem] w-full', className)}
      data-base-component="dashboard-canvas"
    >
      {mounted ? (
        <GridLayout
          className="layout"
          width={width}
          layout={layout}
          gridConfig={{ cols, rowHeight, margin }}
          dragConfig={{ enabled: isDraggable, handle: '.dashboard-canvas-drag-handle' }}
          resizeConfig={{ enabled: isResizable }}
          compactor={compactor}
          onLayoutChange={(next) => onLayoutChange?.(asCanvasItems(next))}
        >
          {children}
        </GridLayout>
      ) : null}
    </div>
  );
};
