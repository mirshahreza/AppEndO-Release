import * as React from 'react';
import { cn } from '../../../lib/utils';
import { type ShellElementProps } from './shellFoundation';

export type ShellHeroProps = ShellElementProps<HTMLElement> & {
  mode?: 'compact' | 'full-bleed';
  contentWidth?: 'contained' | 'full';
  background?: React.ReactNode;
};

export const ShellHero = React.forwardRef<HTMLElement, ShellHeroProps>(function ShellHero({
  mode = 'compact',
  contentWidth = 'contained',
  background,
  children,
  className,
  ...props
}, ref) {
  return (
    <section
      ref={ref}
      data-shell-hero=""
      className={cn(
        'relative isolate overflow-hidden bg-content1 text-foreground',
        mode === 'compact' ? 'min-h-32' : 'min-h-[50dvh]',
        className,
      )}
      {...props}
    >
      {background && <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">{background}</div>}
      <div className={cn('flex min-h-inherit items-center p-6', contentWidth === 'contained' && 'mx-auto max-w-7xl')}>
        {children}
      </div>
    </section>
  );
});
