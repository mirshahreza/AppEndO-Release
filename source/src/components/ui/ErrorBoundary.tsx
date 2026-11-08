import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../../core/logging/Logger';
import { CULTURE_PUBLIC_FALLBACK_LABELS } from '../../core/culture/cultureFallbackLabels';
import { NativeButton } from '../../shared/ui/NativeButton';

export type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Logging context label, e.g. AdminOutlet */
  context?: string;
  /** Optional class applied to the fallback container */
  fallbackClassName?: string;
  /** Optional custom title for the fallback alert */
  title?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  correlationId: string | null;
  resetKey: number;
};

type ErrorBoundaryInstance = {
  props: Readonly<ErrorBoundaryProps>;
  state: ErrorBoundaryState;
  setState: (
    updater: Partial<ErrorBoundaryState> | ((state: ErrorBoundaryState) => Partial<ErrorBoundaryState>),
  ) => void;
};

function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `err-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getErrorMessage(error: Error | null): string {
  if (!error?.message?.trim()) {
    return CULTURE_PUBLIC_FALLBACK_LABELS['errors.renderMessage'];
  }
  const message = error.message.trim();
  return message.length > 240 ? `${message.slice(0, 237)}...` : message;
}

class AppErrorBoundaryInner extends (React.Component as unknown as new (
  props: ErrorBoundaryProps,
) => ErrorBoundaryInstance) {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    correlationId: null,
    resetKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      correlationId: createCorrelationId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string | null }): void {
    const boundary = this as unknown as ErrorBoundaryInstance;
    const context = boundary.props.context ?? 'ErrorBoundary';
    logger.error(context, 'Uncaught React render error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
      correlationId: boundary.state.correlationId,
    });
  }

  handleReset = (): void => {
    const boundary = this as unknown as ErrorBoundaryInstance;
    boundary.setState((previous) => ({
      hasError: false,
      error: null,
      correlationId: null,
      resetKey: previous.resetKey + 1,
    }));
  };

  render(): React.ReactNode {
    const boundary = this as unknown as ErrorBoundaryInstance;

    if (!boundary.state.hasError) {
      return <React.Fragment key={boundary.state.resetKey}>{boundary.props.children}</React.Fragment>;
    }

    const { fallbackClassName, title } = boundary.props;
    const resolvedTitle = title ?? CULTURE_PUBLIC_FALLBACK_LABELS['errors.renderTitle'];
    const message = getErrorMessage(boundary.state.error);
    const referenceLabel = CULTURE_PUBLIC_FALLBACK_LABELS['errors.renderReference']
      .replace('{id}', boundary.state.correlationId ?? '');

    return (
      <div
        role="alert"
        className={fallbackClassName ?? 'flex min-h-[200px] w-full items-center justify-center p-6'}
      >
        <div className="mx-auto max-w-md rounded-xl border border-rose-200/80 bg-rose-50/60 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-800">{resolvedTitle}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{message}</p>
              {boundary.state.correlationId ? (
                <p className="mt-2 font-mono text-[10px] text-slate-400">
                  {referenceLabel}
                </p>
              ) : null}
              <NativeButton
                type="button"
                onClick={this.handleReset}
                className="mt-4 inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {CULTURE_PUBLIC_FALLBACK_LABELS['errors.tryAgain']}
              </NativeButton>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export function ErrorBoundary(props: ErrorBoundaryProps): React.ReactElement {
  return React.createElement(AppErrorBoundaryInner, props);
}
