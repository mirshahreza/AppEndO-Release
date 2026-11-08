import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';

export type QueryErrorPanelProps = {
  message: string;
  detail?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
};

export const QueryErrorPanel: React.FC<QueryErrorPanelProps> = ({
  message,
  detail,
  onRetry,
  isRetrying = false,
  className,
}) => {
  const t = useOptionalCultureT();

  return (
    <div className={cn('flex flex-col items-center justify-center h-40 gap-3 px-6 text-center', className)}>
      <AlertCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
      <p className="text-sm text-rose-600 max-w-lg">{detail ?? message}</p>
      {onRetry ? (
        <AppButton type="button" intent="utility" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} aria-hidden="true" />
          {isRetrying ? t('errors.retrying') : t('errors.retry')}
        </AppButton>
      ) : null}
    </div>
  );
};
