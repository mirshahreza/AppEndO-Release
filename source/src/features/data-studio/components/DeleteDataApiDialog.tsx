import React from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import {
  AppButton,
  ConfirmDialogShell,
  DestructiveConfirmBody,
} from '../../../shared/ui';

export type DeleteDataApiDialogProps = {
  target: EdgeApiDefinition | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DeleteDataApiDialog: React.FC<DeleteDataApiDialogProps> = ({
  target,
  isSubmitting,
  onCancel,
  onConfirm,
}) => {
  if (!target) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="sm"
      title="Delete Data API"
      icon={<Trash2 className="h-4 w-4" />}
      confirmIntent="destructive"
      closeOnEscape={!isSubmitting}
      onClose={isSubmitting ? () => undefined : onCancel}
      onBackdropClick={isSubmitting ? () => undefined : onCancel}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" disabled={isSubmitting} onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            disabled={isSubmitting}
            onClick={() => { void onConfirm(); }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete API
              </>
            )}
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question="Permanently delete this Data API?"
        warning="The published route and managed function (if any) are removed. This action cannot be undone."
        entityName={target.label}
        entityDetail={`${target.key} · ${target.basePath}`}
      />
    </ConfirmDialogShell>
  );
};
