import React, { useEffect, useState } from 'react';
import { useOptionalCulture, useOptionalCultureT } from '../../../core/culture/CultureContext';
import { AppToast } from '../../../shared/ui/AppToast';
import { HeaderHintTooltip } from '../../../shared/ui/SideHintTooltip';
import { useFeedbackPolicy } from '../hooks/useFeedbackPolicy';
import { cn } from '../../../lib/utils';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideChromeProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS } from '../../../shared/ui/surfaceClasses';
import { MessageSquarePlusIcon } from './feedbackEntryIcon';
import type { FeedbackSubmitDialogProps } from './FeedbackSubmitDialogForm';

export type { FeedbackSubmitDialogProps } from './FeedbackSubmitDialogForm';

type FeedbackEntryButtonProps = {
  pageKey?: string | null;
  variant: 'fab' | 'header';
};

// Lazy: the actual dialog form (shared/ui + lucide-react heavy) only loads once a user opens it.
// See FeedbackSubmitDialogForm.tsx for why this file was split.
const FeedbackSubmitDialog = React.lazy(
  () => import('./FeedbackSubmitDialogForm').then((m) => ({ default: m.FeedbackSubmitDialog })),
) as React.FC<FeedbackSubmitDialogProps>;

export const FeedbackEntryButton: React.FC<FeedbackEntryButtonProps> = ({ pageKey, variant }) => {
  const culture = useOptionalCulture();
  const t = useOptionalCultureT();
  const { showFab, showHeaderButton } = useFeedbackPolicy(pageKey);
  const [open, setOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!successToast) return undefined;
    const timer = window.setTimeout(() => setSuccessToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  if (!culture) {
    return null;
  }

  const visible = variant === 'fab' ? showFab : showHeaderButton;
  const title = t('pageGuide.chrome.feedback.title') || t('feedback.entry.tooltip');
  const hint = t('pageGuide.chrome.feedback.hint');

  if (!visible) {
    return null;
  }

  const triggerButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={title}
      {...pageGuideChromeProps((key) => t(key) || PAGE_GUIDE_EN[key] || key, 'feedback', 22)}
      className={cn(
        variant === 'fab'
          ? 'fixed bottom-6 end-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 max-md:bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] max-md:end-[max(1.5rem,calc(env(safe-area-inset-right)+0.75rem))]'
          : ADMIN_SHELL_HEADER_ICON_BUTTON_CLASS,
      )}
    >
      <MessageSquarePlusIcon className="h-5 w-5" />
    </button>
  );

  return (
    <>
      {variant === 'header' ? (
        <HeaderHintTooltip title={title} hint={hint} tone="cyan">
          {triggerButton}
        </HeaderHintTooltip>
      ) : (
        triggerButton
      )}
      {open ? (
        <React.Suspense fallback={null}>
          <FeedbackSubmitDialog
            open={open}
            onClose={() => setOpen(false)}
            pageKey={pageKey}
            onSubmitted={() => setSuccessToast(t('feedback.submit.success'))}
          />
        </React.Suspense>
      ) : null}
      {successToast ? <AppToast type="success" text={successToast} /> : null}
    </>
  );
};
