import React from 'react';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  AppToastXIcon,
  CheckCircle2Icon,
  InfoIcon,
  LockIcon,
  LockOpenIcon,
  type AppToastIconComponent,
} from './appToastIcons';
import { cn } from '../../lib/utils';
import { NativeButton } from './NativeButton';

export const APP_TOAST_TYPES = ['success', 'error', 'warning', 'info'] as const;
export type AppToastType = (typeof APP_TOAST_TYPES)[number];

export type AppToastProps = {
  type: AppToastType;
  text: string;
  className?: string;
  onDismiss?: () => void;
  /** Auto-dismiss delay. `0` or omitted keeps the toast until dismiss. */
  durationMs?: number;
};

const TOAST_STYLE: Record<AppToastType, { shell: string; icon: string }> = {
  success: {
    shell: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: 'text-emerald-600',
  },
  error: {
    shell: 'bg-rose-50 border-rose-200 text-rose-800',
    icon: 'text-rose-600',
  },
  warning: {
    shell: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: 'text-amber-600',
  },
  info: {
    shell: 'bg-cyan-50 border-cyan-200 text-cyan-800',
    icon: 'text-cyan-600',
  },
};

const resolveToastIcon = (type: AppToastType, text: string): AppToastIconComponent => {
  const normalized = text.toLowerCase();
  if (normalized.includes('unlocked')) return LockOpenIcon;
  if (normalized.includes('locked')) return LockIcon;
  if (type === 'success') return CheckCircle2Icon;
  if (type === 'warning') return AlertTriangleIcon;
  if (type === 'info') return InfoIcon;
  return AlertCircleIcon;
};

export const AppToast: React.FC<AppToastProps> = ({ type, text, className, onDismiss, durationMs = 0 }) => {
  const Icon = resolveToastIcon(type, text);
  const style = TOAST_STYLE[type];
  const isError = type === 'error';
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  React.useEffect(() => {
    if (durationMs <= 0 || !onDismissRef.current) {
      return;
    }
    const handle = window.setTimeout(() => {
      onDismissRef.current?.();
    }, durationMs);
    return () => {
      window.clearTimeout(handle);
    };
  }, [durationMs, text, type]);

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'fixed z-[200] top-4 left-1/2 -translate-x-1/2',
        'flex items-start gap-2.5 min-w-[280px] max-w-lg px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl border',
        style.shell,
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.icon)} aria-hidden="true" />
      <span className="min-w-0 flex-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words">{text}</span>
      {onDismiss ? (
        <NativeButton
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-current/70 transition-colors hover:bg-black/5 hover:text-current"
        >
          <AppToastXIcon className="h-3.5 w-3.5" />
        </NativeButton>
      ) : null}
    </div>
  );
};
