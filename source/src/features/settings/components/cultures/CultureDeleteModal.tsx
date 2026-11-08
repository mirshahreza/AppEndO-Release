import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../../shared/ui';
import type { PlatformCulturePackSummary } from '../../../../shared/api/contracts/platform/cultures';
import { formatCalendarLabel, resolveCultureDisplayLabel } from './constants';

type Props = {
  target: PlatformCulturePackSummary | null;
  onClose: () => void;
  onConfirm: () => void;
};

export const CultureDeleteModal: React.FC<Props> = ({ target, onClose, onConfirm }) => {
  if (!target) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete Culture Combination"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmLabel="Delete"
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this culture combination?"
        warning="This action cannot be undone."
        entityName={resolveCultureDisplayLabel(target)}
        entityDetail={formatCalendarLabel(target.calendar)}
      />
    </ConfirmDialogShell>
  );
};
