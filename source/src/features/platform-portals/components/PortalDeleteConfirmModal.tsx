import React from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import {
  isBuiltInComponentAlonePortal,
  isBuiltInHomePortal,
  isBuiltInStudioPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';

export type PortalDeleteConfirmModalProps = {
  segment: string | null;
  deleteError: string | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const PortalDeleteConfirmModal: React.FC<PortalDeleteConfirmModalProps> = ({
  segment,
  deleteError,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  if (!segment) {
    return null;
  }

  const isBuiltIn = isBuiltInHomePortal({ segment })
    || isBuiltInStudioPortal({ segment })
    || isBuiltInComponentAlonePortal({ segment });

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete application"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onClose}
      closeOnEscape={!isDeleting}
      error={deleteError}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose} disabled={isDeleting}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            disabled={isDeleting || isBuiltIn}
            onClick={() => void onConfirm()}
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
        question={isBuiltIn
          ? 'Built-in portals cannot be removed.'
          : 'Are you sure you want to delete this application?'}
        warning={isBuiltIn ? null : 'This action cannot be undone.'}
        entityName={segment}
      />
    </ConfirmDialogShell>
  );
};
