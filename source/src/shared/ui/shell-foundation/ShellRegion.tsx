import * as React from 'react';
import { cn } from '../../../lib/utils';
import {
  gapClass,
  placementClass,
  safeAreaClass,
  separatorClass,
  spacingClass,
  visibilityClass,
  widthClass,
  type ShellElementProps,
  type ShellRegionPlacement,
  type ShellRegionWidth,
  type ShellSafeArea,
  type ShellSeparator,
  type ShellSpacing,
  type ShellVisibility,
} from './shellFoundation';

export type ShellRegionProps = ShellElementProps<HTMLElement> & {
  regionId: string;
  as?: 'div' | 'section' | 'nav';
  presence?: 'visible' | 'hidden';
  width?: ShellRegionWidth;
  placement?: ShellRegionPlacement;
  padding?: ShellSpacing;
  gap?: ShellSpacing;
  separator?: ShellSeparator;
  visibility?: ShellVisibility;
  safeArea?: ShellSafeArea;
};

export const ShellRegion = React.forwardRef<HTMLElement, ShellRegionProps>(function ShellRegion({
  regionId,
  as: Element = 'section',
  presence = 'visible',
  width = 'full',
  placement = 'start',
  padding = 'none',
  gap = 'none',
  separator = 'none',
  visibility,
  safeArea = 'none',
  children,
  className,
  ...props
}, ref) {
  if (presence === 'hidden') return null;
  return (
    <Element
      ref={ref as never}
      data-shell-region={regionId}
      className={cn(
        'flex min-w-0',
        widthClass[width],
        placementClass[placement],
        spacingClass[padding],
        gapClass[gap],
        separatorClass[separator],
        safeAreaClass[safeArea],
        visibilityClass(visibility),
        className,
      )}
      {...props}
    >
      {children}
    </Element>
  );
});
