import * as React from 'react';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { PAGE_GUIDE_ATTR } from './shell/pageGuide/pageGuide.attrs';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import { getButtonIntentClassName, type ButtonIntent, type ButtonSize } from './buttonSemantics';
import { NativeButton, type NativeButtonProps } from './NativeButton';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
} from './surfaceClasses';

export type AppButtonProps = Omit<NativeButtonProps, 'disabled'> & {
  intent?: ButtonIntent;
  size?: ButtonSize;
  /** HeroUI-style alias — mapped to native `disabled` (not forwarded to the DOM). */
  isDisabled?: boolean;
  disabled?: boolean;
  /** Icon-only close/dismiss control for modal headers. */
  closeIcon?: boolean;
  /**
   * `skip` removes this control from sequential Tab order (form accessory chrome
   * grouped with a field: generate, copy, browse, clear, row delete). Click still works.
   */
  tabStop?: 'auto' | 'skip';
};

const resolveCreateGuideTitle = (
  ariaLabel: NativeButtonProps['aria-label'],
  title: NativeButtonProps['title'],
  children: React.ReactNode,
): string => {
  if (typeof ariaLabel === 'string' && ariaLabel.trim()) return ariaLabel.trim();
  if (typeof title === 'string' && title.trim()) return title.trim();
  const texts: string[] = [];
  React.Children.forEach(children, (child) => {
    if (typeof child === 'string' && child.trim()) texts.push(child.trim());
  });
  return texts[0] || PAGE_GUIDE_EN['pageGuide.page.create.title'] || 'Create';
};

export const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  {
    intent,
    size = 'sm',
    closeIcon = false,
    className,
    type = 'button',
    children,
    tabStop = 'auto',
    tabIndex,
    isDisabled,
    disabled,
    ...props
  },
  ref,
) {
  const resolvedClassName = closeIcon
    ? cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS, 'rounded p-1', className)
    : intent
      ? getButtonIntentClassName(intent, className, size)
      : className;

  const alreadyTagged = typeof (props as Record<string, unknown>)[PAGE_GUIDE_ATTR] === 'string';
  const createGuide = intent === 'create' && !alreadyTagged
    ? pageGuideLocalProps(
      resolveCreateGuideTitle(props['aria-label'], props.title, children),
      PAGE_GUIDE_EN['pageGuide.page.create.hint'] || 'Opens a form to add a new item to this list.',
      16,
    )
    : {};
  const resolvedTabIndex = tabStop === 'skip' && tabIndex === undefined ? -1 : tabIndex;

  return (
    <NativeButton
      ref={ref}
      type={type}
      className={resolvedClassName}
      tabIndex={resolvedTabIndex}
      disabled={disabled ?? isDisabled}
      {...props}
      {...createGuide}
    >
      {children}
    </NativeButton>
  );
});
