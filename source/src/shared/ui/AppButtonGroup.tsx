import * as React from 'react';
import { cn } from '../../lib/utils';

export type AppButtonGroupOrientation = 'horizontal' | 'vertical';

export type AppButtonGroupProps = {
  children: React.ReactNode;
  orientation?: AppButtonGroupOrientation;
  ariaLabel: string;
  className?: string;
};

export const APP_BUTTON_GROUP_CLASS: Record<AppButtonGroupOrientation, string> = {
  horizontal:
    'inline-flex isolate [&>button]:relative [&>button]:rounded-none [&>button:first-child]:rounded-s-md [&>button:last-child]:rounded-e-md [&>button:not(:first-child)]:-ms-px [&>button:hover]:z-10 [&>button:focus-visible]:z-10',
  vertical:
    'inline-flex isolate flex-col [&>button]:relative [&>button]:rounded-none [&>button:first-child]:rounded-t-md [&>button:last-child]:rounded-b-md [&>button:not(:first-child)]:-mt-px [&>button:hover]:z-10 [&>button:focus-visible]:z-10',
};

export function resolveAppButtonGroupClass(
  orientation: AppButtonGroupOrientation = 'horizontal',
  className?: string,
): string {
  return cn(APP_BUTTON_GROUP_CLASS[orientation], className);
}

/**
 * Joined cluster of related AppButtons. Independent actions share one chrome.
 * Exclusive mode picks use UiSegmentedControl. Toolbar overflow uses ToolbarActionGroup.
 */
export const AppButtonGroup = React.forwardRef<HTMLDivElement, AppButtonGroupProps>(
  function AppButtonGroup(
    { children, orientation = 'horizontal', ariaLabel, className },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        data-orientation={orientation}
        className={resolveAppButtonGroupClass(orientation, className)}
      >
        {children}
      </div>
    );
  },
);
