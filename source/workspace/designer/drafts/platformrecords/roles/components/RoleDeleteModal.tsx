import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '@/src/shared/ui';
import type { RoleRecord } from '../types';

export type RoleDeleteModalProps = {
  role: RoleRecord | null;
  deleteError: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const RoleDeleteModal: React.FC<RoleDeleteModalProps> = ({
  role,
  deleteError,
  isDeleting,
  onCancel,
  onConfirm,
}) => {
  if (!role) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete Role"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      closeOnEscape={!isDeleting}
      error={deleteError}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            onClick={() => void onConfirm()}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </>
            )}
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this role?"
        entityName={role.name}
        entityDetail={`#${role.id}${role.note?.trim() ? ` · ${role.note.trim()}` : ''}`}
      />
    </ConfirmDialogShell>
  );
};
