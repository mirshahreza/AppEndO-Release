import * as React from 'react';
import { cn } from '../../../lib/utils';
import { type ShellElementProps } from './shellFoundation';

export type ShellContentHostProps = ShellElementProps<HTMLDivElement> & {
  variant?: 'plain' | 'card' | 'inset';
  width?: 'fluid' | 'boxed-sm' | 'boxed-md' | 'boxed-lg';
  density?: 'compact' | 'default' | 'comfortable' | 'spacious';
  scrollOwner?: 'page' | 'content-host';
  scrollShadow?: boolean;
};

const widths = {
  fluid: 'w-full',
  'boxed-sm': 'mx-auto w-full max-w-3xl',
  'boxed-md': 'mx-auto w-full max-w-5xl',
  'boxed-lg': 'mx-auto w-full max-w-7xl',
};
const densities = { compact: 'p-2', default: 'p-4', comfortable: 'p-6', spacious: 'p-8' };

export const ShellContentHost = React.forwardRef<HTMLDivElement, ShellContentHostProps>(function ShellContentHost({
  variant = 'plain',
  width = 'fluid',
  density = 'default',
  scrollOwner = 'page',
  scrollShadow = false,
  children,
  className,
  ...props
}, ref) {
  return (
    <div
      ref={ref}
      data-shell-content-host=""
      data-scroll-owner={scrollOwner}
      tabIndex={scrollOwner === 'content-host' ? 0 : undefined}
      className={cn(
        'min-h-0 min-w-0 flex-1 bg-background text-foreground',
        widths[width],
        densities[density],
        variant === 'card' && 'rounded-large border border-divider bg-content1 shadow-small',
        variant === 'inset' && 'm-3 rounded-medium bg-content2',
        scrollOwner === 'content-host' && 'overflow-y-auto overscroll-contain',
        scrollShadow && 'shadow-[inset_0_8px_8px_-10px_hsl(var(--heroui-foreground))]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
