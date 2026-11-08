import React from 'react';
import { Trash2, X } from 'lucide-react';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { FileHubPageState } from '../hooks/useFileHubPage';

export const FileHubDeleteModal: React.FC<{ page: FileHubPageState }> = ({ page }) => {
  const t = useCultureT();
  const target = page.deleteTarget;
  if (!target) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title={t('fileHub.delete.title')}
      icon={<Trash2 className="h-4 w-4" />}
      onClose={() => page.setDeleteTarget(null)}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={() => page.setDeleteTarget(null)}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="destructive" size="sm" onClick={() => void page.confirmDelete()} disabled={page.isDeleting}>
            <Trash2 className="h-3.5 w-3.5" />
            {t('actions.delete')}
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question={t('fileHub.delete.question')}
        entityName={target.name}
        entityDetail={`${target.protocol.toUpperCase()} · ${target.username}@${target.host}:${target.port}`}
      />
    </ConfirmDialogShell>
  );
};
