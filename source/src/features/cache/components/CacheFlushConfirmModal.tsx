import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';

type CacheFlushConfirmModalProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export const CacheFlushConfirmModal: React.FC<CacheFlushConfirmModalProps> = ({
  onCancel,
  onConfirm,
}) => {
  const t = useCultureT();

  return (
    <ConfirmDialogShell
      size="md"
      title={t(operationsKey('cache.flushTitle'))}
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel={t(operationsKey('cache.flush'))}
    >
      <DestructiveConfirmBody
        question={t(operationsKey('cache.flushConfirm'))}
      />
    </ConfirmDialogShell>
  );
};
