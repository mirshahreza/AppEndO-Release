import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { useCultureT } from '../../core/culture/CultureContext';
import { resolveAppTableGridHeaderFlexJustify } from '../../shared/lib/appTableGridColumnAlign';
import { APP_TABLE_GRID_HEADER_CELL_CLASS } from '../../shared/ui/surfaceClasses';

const HEADER_RESIZE_HANDLE_CLASS =
  'w-1 shrink-0 self-stretch cursor-col-resize touch-none select-none bg-indigo-200/50 group-hover/th:bg-indigo-200/80 hover:bg-indigo-300/90';

const HEADER_END_HOVER_REVEAL_CLASS =
  'opacity-0 transition-opacity duration-150 pointer-events-none group-hover/th:opacity-100 group-hover/th:pointer-events-auto group-focus-within/th:opacity-100 group-focus-within/th:pointer-events-auto';

type BaseTreeGridHeaderCellProps = {
  columnId: string;
  className?: string;
  dir?: 'ltr' | 'rtl';
  style?: React.CSSProperties;
  resizable?: boolean;
  onResizeStart?: (columnId: string, event: React.PointerEvent<HTMLSpanElement>) => void;
  onResizeAutoFit?: (columnId: string) => void;
  children: React.ReactNode;
};

export const BaseTreeGridHeaderCell: React.FC<BaseTreeGridHeaderCellProps> = ({
  columnId,
  className,
  dir,
  style,
  resizable = false,
  onResizeStart,
  onResizeAutoFit,
  children,
}) => {
  const t = useCultureT();
  const [resizePinned, setResizePinned] = useState(false);

  useEffect(() => {
    if (!resizePinned) {
      return;
    }
    const handlePointerUp = () => setResizePinned(false);
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [resizePinned]);

  return (
    <th
      className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'group/th relative', className)}
      dir={dir}
      style={style}
      data-column-id={columnId}
    >
      <div className={cn(
        'flex min-h-full min-w-0 items-stretch gap-1',
        resolveAppTableGridHeaderFlexJustify(className),
      )}>
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {resizable && onResizeStart ? (
          <span
            role="separator"
            aria-orientation="vertical"
            aria-hidden="true"
            title={[
              t('grid.hint.resizeColumn').replace('{column}', columnId),
              t('grid.hint.autoFitColumn').replace('{column}', columnId),
            ].join(' ')}
            className={cn(
              'z-10',
              HEADER_RESIZE_HANDLE_CLASS,
              HEADER_END_HOVER_REVEAL_CLASS,
              resizePinned && 'pointer-events-auto bg-indigo-200/80 opacity-100',
            )}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onResizeAutoFit?.(columnId);
            }}
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse' && event.button === 0 && event.detail >= 2) {
                return;
              }
              setResizePinned(true);
              onResizeStart(columnId, event);
            }}
          />
        ) : null}
      </div>
    </th>
  );
};
