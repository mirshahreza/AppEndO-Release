import React from 'react';
import { Check } from 'lucide-react';
import { AppButton, CreateEditModalShell, FormField, FormSection, UiInput } from '@/src/shared/ui';
import type { RoleFormState, RoleRecord } from '../types';

export type RoleEditModalProps = {
  role: RoleRecord | null;
  form: RoleFormState;
  onFormChange: (form: RoleFormState) => void;
  editError: string | null;
  isUpdating: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export const RoleEditModal: React.FC<RoleEditModalProps> = ({
  role,
  form,
  onFormChange,
  editError,
  isUpdating,
  onClose,
  onSubmit,
}) => {
  if (!role) return null;

  return (
    <CreateEditModalShell
      size="lg"
      title={`Edit Role ${role.name}`}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>Cancel</AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isUpdating}>
            <Check className="w-3.5 h-3.5" />{isUpdating ? 'Saving...' : 'Save'}
          </AppButton>
        </>
      )}
    >
      {editError ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {editError}
        </div>
      ) : null}

      <FormSection title="Role Details" tone="violet">
        <div className="grid grid-cols-1 gap-3">
          <FormField label="Role Name">
            <UiInput
              size="sm"
              value={form.name}
              readOnly
              className="font-mono uppercase"
            />
          </FormField>
          <FormField label="Note">
            <UiInput
              size="sm"
              value={form.note}
              onChange={(e) => onFormChange({ ...form, note: e.target.value })}
              placeholder="Add a note for this role..."
            />
          </FormField>
        </div>
      </FormSection>
    </CreateEditModalShell>
  );
};

