import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '@/src/shared/ui';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';

type BaseInfoDeleteModalProps = {
  page: BaseInfoPageModel;
};

export const BaseInfoDeleteModal: React.FC<BaseInfoDeleteModalProps> = ({ page }) => {
  if (!page.deleteTarget) {
    return null;
  }

  const entityLabel = page.deleteTarget.label || page.deleteTarget.title || '-';

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete Base Info Node"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={page.closeDeleteModal}
      closeOnEscape={!page.isDeleting}
      error={page.saveError}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeDeleteModal} disabled={page.isDeleting}>
            Cancel
          </AppButton>
          <AppButton intent="destructive" size="sm" onClick={page.submitDelete} disabled={page.isDeleting}>
            {page.isDeleting ? (
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
        question="Are you sure you want to delete this node?"
        entityName={`${page.deleteTarget.id} - ${entityLabel}`}
      />
    </ConfirmDialogShell>
  );
};
