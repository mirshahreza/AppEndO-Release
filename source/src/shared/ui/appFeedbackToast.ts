import type { AppToastType } from './AppToast';

export type AppFeedbackToastMessage = {
  id: number;
  type: AppToastType;
  text: string;
};

type AppFeedbackToastListener = (toast: AppFeedbackToastMessage | null) => void;

let listener: AppFeedbackToastListener | null = null;
let sequence = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

/** Map HeroUI / designer toast variants onto AppToast tones. */
export const mapFeedbackToastVariantToType = (variant?: string | null): AppToastType => {
  switch (variant) {
    case 'danger':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    default:
      return 'info';
  }
};

/**
 * Imperative page-level feedback — renders via {@link AppToastHost} (top-center AppToast).
 * Prefer this over HeroUI `toast()` for Studio / Designer Dynamic Actions.
 */
export const showAppFeedbackToast = (
  text: string,
  options?: { type?: AppToastType; variant?: string | null; durationMs?: number },
): void => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  sequence += 1;
  const type = options?.type ?? mapFeedbackToastVariantToType(options?.variant);
  const next: AppFeedbackToastMessage = {
    id: sequence,
    type,
    text: trimmed,
  };
  listener?.(next);

  if (dismissTimer != null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  const durationMs = options?.durationMs ?? (type === 'error' ? 0 : 4000);
  if (durationMs > 0) {
    dismissTimer = setTimeout(() => {
      listener?.(null);
      dismissTimer = null;
    }, durationMs);
  }
};

export const dismissAppFeedbackToast = (): void => {
  if (dismissTimer != null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  listener?.(null);
};

export const subscribeAppFeedbackToast = (next: AppFeedbackToastListener): (() => void) => {
  listener = next;
  return () => {
    if (listener === next) {
      listener = null;
    }
  };
};
