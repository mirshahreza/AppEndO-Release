import React from 'react';
import { Trash2, X } from 'lucide-react';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';

export type ServerFunctionDeleteModalProps = {
  target: ServerFunctionItem | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ServerFunctionDeleteModal: React.FC<ServerFunctionDeleteModalProps> = ({
  target,
  onCancel,
  onConfirm,
}) => {
  if (!target) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete Server Function"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="destructive" size="sm" onClick={() => void onConfirm()}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this server function?"
        entityName={target.name}
        entityDetail={target.path}
      />
    </ConfirmDialogShell>
  );
};
