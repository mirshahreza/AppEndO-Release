import { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { AppButton } from '../../../shared/ui';
import type { ClassifiedConnectionError } from '../../../shared/lib/appendoo/classifyConnectionError';
import { ConnectionErrorDetailModal } from './ConnectionErrorDetailModal';

type ConnectionErrorBannerProps = {
  error: ClassifiedConnectionError;
};

export const ConnectionErrorBanner: React.FC<ConnectionErrorBannerProps> = ({ error }) => {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[12px] text-rose-900">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
      <div className="min-w-0 flex-1">{error.friendlyMessage}</div>
      <AppButton
        size="icon-sm"
        onClick={() => setDetailOpen(true)}
        title="Show technical detail"
        className="shrink-0"
      >
        <Info className="h-3.5 w-3.5" />
      </AppButton>
      {detailOpen ? (
        <ConnectionErrorDetailModal error={error} onClose={() => setDetailOpen(false)} />
      ) : null}
    </div>
  );
};
