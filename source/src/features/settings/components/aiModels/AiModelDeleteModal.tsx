import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../../shared/ui';
import type { AiModelPublicEntry } from '../../../../shared/api/contracts/ai/types';

export type AiModelDeleteModalProps = {
  model: AiModelPublicEntry | null;
  deleteError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const AiModelDeleteModal: React.FC<AiModelDeleteModalProps> = ({
  model,
  deleteError,
  onCancel,
  onConfirm,
}) => {
  if (!model) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete AI Model"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Delete"
      error={deleteError}
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this AI model?"
        entityName={model.modelId}
      />
    </ConfirmDialogShell>
  );
};
