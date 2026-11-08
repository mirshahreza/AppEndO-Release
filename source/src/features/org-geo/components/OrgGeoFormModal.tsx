import React from 'react';
import { Plus, Save, X } from 'lucide-react';
import { AppButton, CreateEditModalShell, RECORD_FORM_DOCKED_DIALOG_CHROME } from '../../../shared/ui';
import { BaseInfoFormFields } from '../../../shared/ui/BaseInfoFormFields';
import type { ScopedBaseInfoTreeModel } from '../hooks/useScopedBaseInfoTree';

type OrgGeoFormModalProps = {
  page: ScopedBaseInfoTreeModel;
  entityLabel: string;
};

export const OrgGeoFormModal: React.FC<OrgGeoFormModalProps> = ({ page, entityLabel }) => {
  if (!page.isModalOpen) return null;

  return (
    <CreateEditModalShell
      size="5xl"
      title={page.isCreateMode ? `Create ${entityLabel}` : `Edit ${entityLabel} #${page.editingId}`}
      onClose={page.closeModal}
      {...RECORD_FORM_DOCKED_DIALOG_CHROME}
      footer={(
        <>
          <AppButton intent="cancel" onClick={page.closeModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            onClick={page.isCreateMode ? page.submitCreate : page.submitEdit}
            disabled={page.isSaving}
          >
            {page.isCreateMode ? <Plus className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {page.isSaving ? 'Saving...' : page.isCreateMode ? 'Create' : 'Save'}
          </AppButton>
        </>
      )}
    >
      <BaseInfoFormFields
        form={page.editForm}
        onFormChange={page.setEditForm}
        isCreateMode={page.isCreateMode}
        parentDisplayValue={page.parentDisplayValue}
      />
      {page.saveError ? <p className="mt-2 text-xs font-semibold text-red-600">{page.saveError}</p> : null}
    </CreateEditModalShell>
  );
};
