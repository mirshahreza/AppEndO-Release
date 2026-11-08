import React from 'react';
import { cn } from '../../lib/utils';
import {
  UiScrollArea,
  UI_SCROLL_AREA_POINTER_NUDGE_PROPS,
  type UiScrollAreaDirection,
} from './UiScrollArea';

type SidebarMenuScrollAreaProps = {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  dir?: UiScrollAreaDirection;
  'aria-label'?: string;
};

/** Main-menu overflow — nudge carets only. Drag-to-scroll is off so empty space stays a default cursor. */
export const SidebarMenuScrollArea: React.FC<SidebarMenuScrollAreaProps> = ({
  children,
  className,
  viewportClassName,
  dir,
  'aria-label': ariaLabel = 'Navigation',
}) => (
  <UiScrollArea
    {...UI_SCROLL_AREA_POINTER_NUDGE_PROPS}
    drag={false}
    className={cn('h-full min-h-0', className)}
    viewportClassName={cn('cursor-default', viewportClassName)}
    dir={dir}
    aria-label={ariaLabel}
  >
    {children}
  </UiScrollArea>
);
