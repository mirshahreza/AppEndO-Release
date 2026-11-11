import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '@/shared/ui';
import { useCultureT } from '@/core/culture/CultureContext';
import { operationsKey } from '@/core/culture/translations/cultureKeyHelpers';
import type { LogsPageModel } from '../hooks/useLogsPage';

type LogsClearConfirmModalProps = {
  page: LogsPageModel;
};

export const LogsClearConfirmModal: React.FC<LogsClearConfirmModalProps> = ({ page }) => {
  const t = useCultureT();

  if (!page.showClearConfirm) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title={t(operationsKey('logs.clearTitle'))}
      icon={<Trash2 className="h-4 w-4" />}
      onClose={() => page.setShowClearConfirm(false)}
      onConfirm={() => void page.clearLogs()}
      confirmLabel={t(operationsKey('common.clear'))}
    >
      <DestructiveConfirmBody
        question={t(operationsKey('logs.clearConfirm'))}
      />
    </ConfirmDialogShell>
  );
};
