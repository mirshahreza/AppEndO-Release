import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';

export type ChatHistoryDeleteModalProps = {
  deleteId: number | null;
  deleteError: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ChatHistoryDeleteModal: React.FC<ChatHistoryDeleteModalProps> = ({
  deleteId,
  deleteError,
  isDeleting,
  onCancel,
  onConfirm,
}) => {
  if (deleteId === null) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete Chat Session"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Delete"
      isConfirming={isDeleting}
      confirmingLabel="Deleting…"
      cancelDisabled={isDeleting}
      confirmDisabled={isDeleting}
      error={deleteError}
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this chat session?"
        entityName={`#${deleteId}`}
      />
    </ConfirmDialogShell>
  );
};
