import React from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';

export type NavigationDeleteModalProps = {
  targetId: string | null;
  deleteError: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  backdropClassName?: string;
  closeOnEscape?: boolean;
  /** When deleting the portal's primary navigation manifest. */
  isPrimaryNavigation?: boolean;
  /** Shell/portal ref after delete when primary; null when none remain. */
  replacementNavigationId?: string | null;
};

export const NavigationDeleteModal: React.FC<NavigationDeleteModalProps> = ({
  targetId,
  deleteError,
  isDeleting,
  onCancel,
  onConfirm,
  backdropClassName,
  closeOnEscape = true,
  isPrimaryNavigation = false,
  replacementNavigationId,
}) => {
  if (!targetId) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete navigation manifest"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      closeOnEscape={closeOnEscape}
      backdropClassName={backdropClassName}
      error={deleteError}
      footer={(
        <div
          className="contents"
          onKeyDownCapture={(event) => {
            if (event.key !== 'Enter') {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <AppButton intent="cancel" size="sm" onClick={onCancel} disabled={isDeleting}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => { void onConfirm(); }}
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
        </div>
      )}
    >
      <DestructiveConfirmBody
        question="Are you sure you want to delete this navigation manifest?"
        entityName={targetId}
        extra={isPrimaryNavigation ? (
          <p className="text-start text-xs leading-relaxed text-amber-800">
            {replacementNavigationId ? (
              <>
                This is the portal primary menu. Shell references will switch to{' '}
                <span className="font-mono font-semibold">{replacementNavigationId}</span>.
              </>
            ) : (
              'This is the portal primary menu. Shell navigation will be cleared until you create or assign another manifest.'
            )}
          </p>
        ) : null}
      />
    </ConfirmDialogShell>
  );
};
