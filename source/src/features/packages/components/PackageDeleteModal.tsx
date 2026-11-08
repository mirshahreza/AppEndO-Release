import React from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import type { PackageRow } from '../types';

export type PluginDeleteModalProps = {
  target: PackageRow | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const PackageDeleteModal: React.FC<PluginDeleteModalProps> = ({
  target,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  if (!target) return null;

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete Package"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onClose}
      closeOnEscape={!isDeleting}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose} disabled={isDeleting}>
            <X className="h-3.5 w-3.5" />
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
        question="Are you sure you want to delete this package?"
        entityName={target.displayName}
        entityDetail={`v${target.version}`}
      />
    </ConfirmDialogShell>
  );
};
