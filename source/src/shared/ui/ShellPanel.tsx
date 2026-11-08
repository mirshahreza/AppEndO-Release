import * as React from 'react';

export type ShellPanelProps = {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  headerRightActions?: React.ReactNode;
  headerActionsSide?: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
  borderless?: boolean;
  headerBorderless?: boolean;
  showHeader?: boolean;
  headerHeight?: string;
};

export const ShellPanel: React.FC<ShellPanelProps> = ({
  title,
  icon,
  headerActions,
  headerRightActions,
  headerActionsSide = 'right',
  children,
  className,
  borderless = false,
  headerBorderless = false,
  showHeader = true,
  headerHeight = 'h-8',
}) => {
  const headerActionsOnLeft = headerActionsSide === 'left';
  const hasTitle = typeof title === 'string'
    ? title.trim().length > 0
    : title !== null && title !== undefined;
  const hasIcon = Boolean(icon);

  return (
    <section className={`flex min-h-0 flex-col rounded-none bg-white ${borderless ? 'shadow-none' : 'shadow-sm'} ${borderless ? '' : 'border border-slate-200'} ${className || ''}`}>
      {showHeader ? (
        <header className={`relative z-20 flex min-h-8 min-w-0 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden px-3 py-1 text-xs font-semibold text-slate-700 sm:flex-nowrap sm:py-0 ${headerHeight} ${headerActionsOnLeft ? 'justify-start' : ''} ${headerBorderless ? '' : 'border-b border-slate-200'}`}>
          <span className="flex h-8 min-w-0 flex-[1_1_0%] items-center gap-2 overflow-hidden">
            {hasIcon ? <span className="shrink-0 text-slate-500">{icon}</span> : null}
            {hasTitle ? <span className="min-w-0 flex-1 overflow-hidden">{title}</span> : null}
          </span>
          {headerActionsOnLeft && headerActions ? <span className="flex h-8 shrink-0 items-center gap-1">{headerActions}</span> : null}
          {!headerActionsOnLeft && headerActions ? <span className="flex h-8 shrink-0 items-center gap-1">{headerActions}</span> : null}
          {headerRightActions ? (
            <span className="flex h-8 min-w-0 flex-[0_1_auto] items-center gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {headerRightActions}
            </span>
          ) : null}
        </header>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
};
