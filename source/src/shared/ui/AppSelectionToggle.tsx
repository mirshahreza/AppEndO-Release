import * as React from 'react';
import { Check, X } from 'lucide-react';
import { AppButton, type AppButtonProps } from './AppButton';

/** Wrap host for include/exclude selection toggles. */
export const APP_SELECTION_TOGGLE_WRAP_CLASS = 'flex flex-wrap gap-2';

export const APP_SELECTION_TOGGLE_ICON_CLASS = 'h-3.5 w-3.5';

export type AppSelectionToggleProps = Omit<AppButtonProps, 'intent' | 'aria-pressed' | 'closeIcon'> & {
  selected: boolean;
};

/**
 * Include/exclude wrap chip: selected = mild emerald + Check; unselected = slate + X.
 * Not for exclusive mode picks (UiSegmentedControl) or pressed tools (toggle-on/toggle-off).
 */
export const AppSelectionToggle = React.forwardRef<HTMLButtonElement, AppSelectionToggleProps>(
  function AppSelectionToggle(
    { selected, children, size = 'sm', type = 'button', ...props },
    ref,
  ) {
    return (
      <AppButton
        ref={ref}
        type={type}
        size={size}
        {...props}
        intent={selected ? 'confirm' : 'cancel'}
        aria-pressed={selected}
      >
        {selected
          ? <Check className={APP_SELECTION_TOGGLE_ICON_CLASS} aria-hidden />
          : <X className={APP_SELECTION_TOGGLE_ICON_CLASS} aria-hidden />}
        {children}
      </AppButton>
    );
  },
);
