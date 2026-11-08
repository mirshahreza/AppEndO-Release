import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../../shared/ui';

export type SettingsAttributeDeleteModalProps = {
  deleteId: number | null;
  deleteError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const SettingsAttributeDeleteModal: React.FC<SettingsAttributeDeleteModalProps> = ({
  deleteId,
  deleteError,
  onCancel,
  onConfirm,
}) => {
  if (deleteId === null) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete Attribute Definition"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Delete"
      error={deleteError}
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this settings attribute?"
        entityName={`#${deleteId}`}
      />
    </ConfirmDialogShell>
  );
};
