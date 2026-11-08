import * as React from 'react';
import { cn } from '../../../lib/utils';
import { UiBreadcrumbs, type UiBreadcrumbItem } from '../UiBreadcrumbs';
import { type ShellElementProps } from './shellFoundation';

export type ShellHeaderContextProps = ShellElementProps<HTMLDivElement> & {
  title?: React.ReactNode;
  context?: React.ReactNode;
  breadcrumbs?: UiBreadcrumbItem[];
  titleId?: string;
  align?: 'start' | 'center';
};

export const ShellHeaderContext = React.forwardRef<HTMLDivElement, ShellHeaderContextProps>(function ShellHeaderContext({
  title,
  context,
  breadcrumbs,
  titleId,
  align = 'start',
  children,
  className,
  ...props
}, ref) {
  return (
    <div
      ref={ref}
      data-shell-header-context=""
      className={cn('flex min-w-0 flex-col gap-0.5', align === 'center' && 'items-center text-center', className)}
      {...props}
    >
      {breadcrumbs?.length ? <UiBreadcrumbs items={breadcrumbs} className="text-xs text-foreground-500" /> : null}
      {title ? <h1 id={titleId} className="truncate text-lg font-bold text-foreground">{title}</h1> : null}
      {context ? <div className="truncate text-sm text-foreground-500">{context}</div> : null}
      {children}
    </div>
  );
});
