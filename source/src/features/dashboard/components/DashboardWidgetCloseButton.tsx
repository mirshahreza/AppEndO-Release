import React from 'react';
import { CircleX } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import { NativeButton } from '../../../shared/ui/NativeButton';
import { useOptionalDashboardSortableWidget } from './DashboardSortableWidgetContext';

type DashboardWidgetCloseButtonProps = {
  className?: string;
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
};

export const DashboardWidgetCloseButton: React.FC<DashboardWidgetCloseButtonProps> = ({
  className,
  onClick,
  onPointerDown,
}) => {
  const t = useCultureT();
  const sortable = useOptionalDashboardSortableWidget();

  const handleClick = onClick ?? sortable?.onClose;
  if (!handleClick) {
    return null;
  }

  return (
    <NativeButton
      type="button"
      className={cn(
        'inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-rose-600',
        className,
      )}
      aria-label={t('dashboard.layout.closeWidget')}
      onClick={handleClick}
      onPointerDown={onPointerDown}
    >
      <CircleX className="h-4 w-4" strokeWidth={1.75} />
    </NativeButton>
  );
};
