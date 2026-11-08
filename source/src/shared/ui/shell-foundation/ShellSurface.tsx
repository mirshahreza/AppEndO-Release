import * as React from 'react';
import { cn } from '../../../lib/utils';
import { type ShellElementProps } from './shellFoundation';

export type ShellSurfaceProps = ShellElementProps<HTMLDivElement> & {
  tone?: 'background' | 'content1' | 'content2' | 'content3' | 'inverse';
  shape?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  depth?: 'flat' | 'bordered' | 'raised' | 'overlay';
  backdrop?: 'solid' | 'translucent' | 'glass';
};

const tones = {
  background: 'bg-background text-foreground',
  content1: 'bg-content1 text-foreground',
  content2: 'bg-content2 text-foreground',
  content3: 'bg-content3 text-foreground',
  inverse: 'bg-foreground text-background',
};
const shapes = { none: 'rounded-none', sm: 'rounded-small', md: 'rounded-medium', lg: 'rounded-large', full: 'rounded-full' };
const depths = {
  flat: '',
  bordered: 'border border-divider',
  raised: 'border border-divider shadow-medium',
  overlay: 'border border-divider shadow-large',
};

export const ShellSurface = React.forwardRef<HTMLDivElement, ShellSurfaceProps>(function ShellSurface({
  tone = 'content1',
  shape = 'md',
  depth = 'flat',
  backdrop = 'solid',
  children,
  className,
  ...props
}, ref) {
  return (
    <div
      ref={ref}
      data-shell-surface=""
      className={cn(
        tones[tone],
        shapes[shape],
        depths[depth],
        backdrop === 'translucent' && 'bg-opacity-85',
        backdrop === 'glass' && 'bg-opacity-70 backdrop-blur-md motion-reduce:backdrop-blur-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
