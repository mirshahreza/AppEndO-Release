import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCultureT, useOptionalCulture } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import { NativeButton } from '../../../shared/ui/NativeButton';
import { DASHBOARD_WIDGET_MAX_SPAN } from '../../../shared/lib/userDashboardLayout';
import { snapDashboardWidgetSpan } from '../dashboardWidgetResize';

type DashboardWidgetResizeHandlesProps = {
  span: number;
  start?: number;
  onResize: (next: { span: number }) => void;
};

type ResizeSession = {
  startX: number;
  startWidth: number;
  startSpan: number;
  maxSpan: number;
  rtl: boolean;
};

const HANDLE_CLASS =
  'absolute inset-y-3 end-0 z-20 w-2 touch-none rounded-full border-0 bg-transparent p-0 opacity-0 transition-opacity group-hover/sortable:opacity-100 hover:bg-primary-500/25 focus-visible:opacity-100';

export const DashboardWidgetResizeHandles: React.FC<DashboardWidgetResizeHandlesProps> = ({
  span,
  start,
  onResize,
}) => {
  const t = useCultureT();
  const culture = useOptionalCulture();
  const isRtl = culture?.direction === 'rtl';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<ResizeSession | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const beginResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const host = hostRef.current?.parentElement;
    if (!host) {
      return;
    }

    const rect = host.getBoundingClientRect();
    sessionRef.current = {
      startX: event.clientX,
      startWidth: rect.width,
      startSpan: span,
      maxSpan: start == null
        ? DASHBOARD_WIDGET_MAX_SPAN
        : DASHBOARD_WIDGET_MAX_SPAN - start,
      rtl: isRtl,
    };
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [isRtl, span, start]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session) {
        return;
      }

      const widthDelta = session.rtl
        ? session.startX - event.clientX
        : event.clientX - session.startX;
      onResize({
        span: snapDashboardWidgetSpan(
          session.startWidth,
          session.startSpan,
          widthDelta,
          16,
          session.maxSpan,
        ),
      });
    };

    const handleUp = () => {
      sessionRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [isResizing, onResize]);

  return (
    <div ref={hostRef} className="contents">
      <NativeButton
        type="button"
        className={cn(HANDLE_CLASS, 'cursor-ew-resize', isResizing && 'bg-primary-500/35 opacity-100')}
        aria-label={t('dashboard.layout.resizeWidgetWidth')}
        title={t('dashboard.layout.resizeWidgetWidth')}
        onPointerDown={beginResize}
      />
    </div>
  );
};
