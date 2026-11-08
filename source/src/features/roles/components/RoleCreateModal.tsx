import React from 'react';
import { Plus, X } from 'lucide-react';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  FormSection,
  UiInput,
  resolveFormFieldPairGridClass,
} from '../../../shared/ui';
import type { RoleFormState } from '../types';

export type RoleCreateModalProps = {
  open: boolean;
  form: RoleFormState;
  onFormChange: (form: RoleFormState) => void;
  formError: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export const RoleCreateModal: React.FC<RoleCreateModalProps> = ({
  open,
  form,
  onFormChange,
  formError,
  isSaving,
  onClose,
  onSubmit,
}) => {
  if (!open) return null;

  const nameRequiredMsg = 'Role name is required.';
  const isNameFieldError = formError === nameRequiredMsg;
  const isNameInvalid = isNameFieldError || (Boolean(formError) && !form.name.trim());
  const modalError = formError && !isNameFieldError ? formError : null;

  return (
    <CreateEditModalShell
      size="lg"
      title="Create Role"
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving}>
            <Plus className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Create'}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-1">
        {modalError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {modalError}
          </div>
        ) : null}

        <FormSection
          title="Role"
          hint="Canonical role identity. The name cannot be changed after create; the note is operator-only."
          ink="accent"
        >
          <div className={resolveFormFieldPairGridClass(true)}>
            <FormField
              label="Name"
              required
              invalid={isNameInvalid}
              error={isNameFieldError ? nameRequiredMsg : undefined}
              hint="Canonical role key used in access checks."
            >
              <UiInput
                size="sm"
                autoDir={false}
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="Moderator"
                className="font-mono"
                isInvalid={isNameInvalid}
                errorMessage={isNameFieldError ? nameRequiredMsg : undefined}
              />
            </FormField>
            <FormField label="Note" hint="Optional operator note shown in the roles list. It does not change permissions.">
              <UiInput
                size="sm"
                autoDir
                value={form.note}
                onChange={(e) => onFormChange({ ...form, note: e.target.value })}
                placeholder="Add a note for this role..."
              />
            </FormField>
          </div>
        </FormSection>
      </div>
    </CreateEditModalShell>
  );
};
