import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../shell/pageGuide/pageGuideChrome';
import { AppButton } from '../AppButton';
import { useSurfaceChrome } from '../SurfaceChromeContext';
import { WindowChromeFeedbackButton } from '../shell/registeredWindowChromeFeedback';
import { WindowChromeStudioToolsMenu } from '../shell/registeredStudioToolsMenu';
import {
  DIALOG_PRIMARY_HEADER_ACTIONS_CLASS,
  DIALOG_PRIMARY_HEADER_DANGER_CLASS,
  DIALOG_PRIMARY_HEADER_DANGER_SEPARATOR_CLASS,
  DIALOG_PRIMARY_HEADER_DANGER_TITLE_CLASS,
  DIALOG_PRIMARY_HEADER_LAYOUT_CLASS,
  DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS,
  DIALOG_PRIMARY_HEADER_TITLE_CLASS,
  type DialogPrimaryHeaderTone,
} from '../surfaceClasses';

export type DialogPrimaryHeaderProps = {
  title: React.ReactNode;
  onClose: () => void;
  /** When false, hides the header close control so the operator must use footer actions. Default true. */
  showCloseButton?: boolean;
  /** `danger` = rose header band for delete/destructive confirmations. */
  tone?: DialogPrimaryHeaderTone;
  /** Icon-only controls rendered before close; use AppButton size="icon-sm" only. */
  headerExtra?: React.ReactNode;
  /** When true (default), shows Studio tools menu before other header actions when registered. */
  showStudioToolsMenu?: boolean;
  /** When true (default), shows feedback entry before other header actions when registered. */
  showFeedbackButton?: boolean;
  className?: string;
  titleClassName?: string;
  closeTitle?: string;
  /** When set, fixes title/close order on RTL document roots (inherits if omitted). */
  dir?: 'ltr' | 'rtl';
};

export const DialogPrimaryHeader: React.FC<DialogPrimaryHeaderProps> = ({
  title,
  onClose,
  showCloseButton = true,
  tone = 'default',
  headerExtra,
  showStudioToolsMenu = true,
  showFeedbackButton = true,
  className,
  titleClassName,
  closeTitle = 'Close',
  dir,
}) => {
  const chrome = useSurfaceChrome();
  const isDanger = tone === 'danger';
  const headerClassName = isDanger ? DIALOG_PRIMARY_HEADER_DANGER_CLASS : DIALOG_PRIMARY_HEADER_LAYOUT_CLASS;
  const resolvedTitleClassName = isDanger ? DIALOG_PRIMARY_HEADER_DANGER_TITLE_CLASS : DIALOG_PRIMARY_HEADER_TITLE_CLASS;
  const separatorClassName = isDanger
    ? DIALOG_PRIMARY_HEADER_DANGER_SEPARATOR_CLASS
    : DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS;
  const titleText = typeof title === 'string' ? title.trim() : '';

  return (
  <div
    dir={dir}
    className={cn(headerClassName, !isDanger && chrome.header, className)}
    style={!isDanger ? chrome.headerStyle : undefined}
    {...(titleText
      ? pageGuideLocalProps(titleText, PAGE_GUIDE_EN['pageGuide.page.dialog.hint'], 12)
      : {})}
  >
    <div className={cn(resolvedTitleClassName, !isDanger && chrome.title, titleClassName)}>{title}</div>
    {showStudioToolsMenu || showFeedbackButton || headerExtra || showCloseButton ? (
      <div className={DIALOG_PRIMARY_HEADER_ACTIONS_CLASS}>
        {showStudioToolsMenu ? <WindowChromeStudioToolsMenu /> : null}
        {showStudioToolsMenu && showFeedbackButton ? (
          <span className={separatorClassName} aria-hidden="true" />
        ) : null}
        {showFeedbackButton ? <WindowChromeFeedbackButton /> : null}
        {(showStudioToolsMenu || showFeedbackButton) && (headerExtra || showCloseButton) ? (
          <span className={separatorClassName} aria-hidden="true" />
        ) : null}
        {headerExtra}
        {headerExtra && showCloseButton ? (
          <span className={separatorClassName} aria-hidden="true" />
        ) : null}
        {showCloseButton ? (
          <AppButton closeIcon onClick={onClose} title={closeTitle} size="icon-sm">
            <X className="h-4 w-4" />
          </AppButton>
        ) : null}
      </div>
    ) : null}
  </div>
  );
};
