import React from 'react';
import { cn } from '../../../lib/utils';
import {
  UiScrollArea,
  UI_SCROLL_AREA_POINTER_NUDGE_PROPS,
  type UiScrollAreaProps,
} from '../../../shared/ui';

/** Public Scroll Area config for Base Components page chrome (nav, preview, options). */
export const BASE_COMPONENTS_PAGE_SCROLL_AREA_PROPS = {
  ...UI_SCROLL_AREA_POINTER_NUDGE_PROPS,
  dir: 'ltr',
} as const satisfies Pick<
  UiScrollAreaProps,
  | 'variant'
  | 'axis'
  | 'dir'
  | 'drag'
  | 'stepPx'
  | 'nudgeReveal'
  | 'nudgePlacement'
  | 'nudgeSlot'
  | 'nudgeIconSize'
  | 'nudgeMark'
  | 'nudgeMarkShape'
  | 'nudgeOpacity'
>;

type BaseComponentsPageScrollAreaProps = {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  'aria-label': string;
};

export const BaseComponentsPageScrollArea: React.FC<BaseComponentsPageScrollAreaProps> = ({
  children,
  className,
  viewportClassName,
  'aria-label': ariaLabel,
}) => (
  <UiScrollArea
    {...BASE_COMPONENTS_PAGE_SCROLL_AREA_PROPS}
    className={cn('h-full', className)}
    viewportClassName={viewportClassName}
    aria-label={ariaLabel}
  >
    {children}
  </UiScrollArea>
);
