import React from 'react';
import { Plus, Save, X } from 'lucide-react';
import { AppButton, CreateEditModalShell, RECORD_FORM_DOCKED_DIALOG_CHROME } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';
import { BaseInfoFormFields } from '../../../shared/ui/BaseInfoFormFields';

type BaseInfoFormModalProps = {
  page: BaseInfoPageModel;
};

export const BaseInfoFormModal: React.FC<BaseInfoFormModalProps> = ({ page }) => {
  const t = useCultureT();

  if (!page.isModalOpen) {
    return null;
  }

  const pathSubtitle = !page.isCreateMode && page.titlePathDisplayValue?.trim()
    ? page.titlePathDisplayValue.trim()
    : null;

  const titleRequiredMessage = t('baseInfo.validation.titleRequired');
  const titleFieldError = page.saveError === titleRequiredMessage ? page.saveError : null;

  const modalTitle = page.isCreateMode
    ? t('baseInfo.modal.createTitle')
    : t('baseInfo.modal.editTitle').replace('{id}', page.editingId ?? '');

  return (
    <CreateEditModalShell
      size="5xl"
      title={modalTitle}
      subtitle={pathSubtitle}
      subtitleTone="muted"
      onClose={page.closeModal}
      {...RECORD_FORM_DOCKED_DIALOG_CHROME}
      footer={(
        <>
          <AppButton intent="cancel" onClick={page.closeModal}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="primary" onClick={page.isCreateMode ? page.submitCreate : page.submitEdit} disabled={page.isSaving}>
            {page.isCreateMode ? (
              <Plus className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {page.isSaving ? t('actions.saving') : page.isCreateMode ? t('actions.create') : t('actions.save')}
          </AppButton>
        </>
      )}
    >
      {page.saveError && page.saveError !== titleRequiredMessage ? (
        <div className="border-b border-rose-200 bg-rose-50 px-[15px] py-2 text-xs text-rose-700">
          {page.saveError}
        </div>
      ) : null}
      <BaseInfoFormFields
        form={page.editForm}
        onFormChange={page.setEditForm}
        isCreateMode={page.isCreateMode}
        parentDisplayValue={page.parentDisplayValue}
        titleFieldError={titleFieldError}
      />
    </CreateEditModalShell>
  );
};
