import React from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { AppButton, ConfirmDialogShell, DestructiveConfirmBody } from '../../../shared/ui';
import { useCulture, useCultureT } from '../../../core/culture/CultureContext';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';
import { resolveBaseInfoNodeDisplayLabel } from '../lib/resolveBaseInfoNodeDisplayLabel';

type BaseInfoDeleteModalProps = {
  page: BaseInfoPageModel;
};

export const BaseInfoDeleteModal: React.FC<BaseInfoDeleteModalProps> = ({ page }) => {
  const t = useCultureT();
  const { cultureId } = useCulture();

  if (!page.deleteTarget) {
    return null;
  }

  const entityLabel = resolveBaseInfoNodeDisplayLabel(t, page.deleteTarget, cultureId);

  return (
    <ConfirmDialogShell
      size="md"
      title={t('baseInfo.modal.deleteTitle')}
      icon={<Trash2 className="h-4 w-4" />}
      onClose={page.closeDeleteModal}
      closeOnEscape={!page.isDeleting}
      error={page.saveError}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeDeleteModal} disabled={page.isDeleting}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="destructive" size="sm" onClick={page.submitDelete} disabled={page.isDeleting}>
            {page.isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('baseInfo.modal.deleting')}
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                {t('actions.delete')}
              </>
            )}
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question={t('baseInfo.modal.deleteQuestion')}
        entityName={`${page.deleteTarget.id} - ${entityLabel}`}
      />
    </ConfirmDialogShell>
  );
};
