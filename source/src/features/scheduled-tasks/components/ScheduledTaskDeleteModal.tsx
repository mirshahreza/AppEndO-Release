import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import type { ScheduledTaskGridRow } from '../../../shared/api/contracts/scheduler/types';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';

export type ScheduledTaskDeleteModalProps = {
  task: ScheduledTaskGridRow | null;
  deleteError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ScheduledTaskDeleteModal: React.FC<ScheduledTaskDeleteModalProps> = ({
  task,
  deleteError,
  onCancel,
  onConfirm,
}) => {
  const t = useCultureT();

  if (!task) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title={t(operationsKey('scheduler.deleteTitle'))}
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel={t('actions.delete')}
      error={deleteError}
    >
      <DestructiveConfirmBody
        question={t(operationsKey('scheduler.deleteConfirm'))}
        entityName={task.name}
      />
    </ConfirmDialogShell>
  );
};
