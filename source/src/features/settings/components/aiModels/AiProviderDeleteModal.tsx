import React from 'react';
import { Trash2 } from 'lucide-react';
import { getAiProviderLabel } from '../../../../shared/api/contracts/ai/constants';
import type { AiProviderKind } from '../../../../shared/api/contracts/ai/types';
import { ConfirmDialogShell, DestructiveConfirmBody } from '../../../../shared/ui';

export type AiProviderDeleteTarget = {
  provider: AiProviderKind;
  providerLabel?: string;
  modelCount: number;
};

export type AiProviderDeleteModalProps = {
  target: AiProviderDeleteTarget | null;
  deleteError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const AiProviderDeleteModal: React.FC<AiProviderDeleteModalProps> = ({
  target,
  deleteError,
  onCancel,
  onConfirm,
}) => {
  if (!target) return null;

  const providerName = getAiProviderLabel(target.provider, target.providerLabel);
  const modelNote = target.modelCount === 1
    ? '1 model under this provider will also be removed.'
    : `${target.modelCount} models under this provider will also be removed.`;

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete AI Provider"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Delete"
      error={deleteError}
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this AI provider?"
        entityName={providerName}
        entityDetail={target.modelCount > 0 ? modelNote : undefined}
      />
    </ConfirmDialogShell>
  );
};
