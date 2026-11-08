import React from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import type { ScopedBaseInfoTreeModel } from '../hooks/useScopedBaseInfoTree';

type OrgGeoDeleteModalProps = {
  page: ScopedBaseInfoTreeModel;
};

export const OrgGeoDeleteModal: React.FC<OrgGeoDeleteModalProps> = ({ page }) => {
  if (!page.deleteTarget) return null;

  const entityLabel = page.deleteTarget.label || page.deleteTarget.title || page.deleteTarget.title_en || '-';

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete node"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={page.closeDeleteModal}
      closeOnEscape={!page.isDeleting}
      error={page.saveError}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeDeleteModal} disabled={page.isDeleting}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="destructive" size="sm" onClick={() => void page.submitDelete()} disabled={page.isDeleting}>
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
