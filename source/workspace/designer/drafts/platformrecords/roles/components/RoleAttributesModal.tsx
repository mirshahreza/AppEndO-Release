import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { AttributeValuesForm } from '@/src/features/attributes/components/AttributeValuesForm';
import {
  attributeValuesToFormState,
  useRoleAttributesQuery,
} from '@/src/shared/api/queries/attributeValues';
import { AppButton, CreateEditModalShell, FormSection } from '@/src/shared/ui';
import type { RoleRecord } from '../types';

export type RoleAttributesModalProps = {
  open: boolean;
  role: RoleRecord | null;
  editError: string | null;
  isSaving: boolean;
  valuesBySettingsAttributeId: Record<number, unknown>;
  onValuesChange: (values: Record<number, unknown>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const RoleAttributesModal: React.FC<RoleAttributesModalProps> = ({
  open,
  role,
  editError,
  isSaving,
  valuesBySettingsAttributeId,
  onValuesChange,
  onClose,
  onSubmit,
}) => {
  const roleId = role?.id ?? null;
  const attributesQuery = useRoleAttributesQuery(roleId, open);
  const [initializedForRoleId, setInitializedForRoleId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !role || !attributesQuery.data?.items) return;
    if (initializedForRoleId === role.id) return;
    onValuesChange(attributeValuesToFormState(attributesQuery.data.items));
    setInitializedForRoleId(role.id);
  }, [open, role, attributesQuery.data?.items, initializedForRoleId, onValuesChange]);

  useEffect(() => {
    if (!open) {
      setInitializedForRoleId(null);
    }
  }, [open]);

  if (!open || !role) return null;

  const loadError = attributesQuery.isError
    ? (attributesQuery.error instanceof Error ? attributesQuery.error.message : 'Failed to load attributes.')
    : null;

  const handleValueChange = (settingsAttributeId: number, value: unknown) => {
    onValuesChange({ ...valuesBySettingsAttributeId, [settingsAttributeId]: value });
  };

  return (
    <CreateEditModalShell
      size="2xl"
      title={`Edit Attributes — ${role.name}`}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>Cancel</AppButton>
          <AppButton
            intent="primary"
            onClick={onSubmit}
            disabled={isSaving || attributesQuery.isLoading || Boolean(loadError)}
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </AppButton>
        </>
      )}
    >
      {editError ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {editError}
        </div>
      ) : null}

      {attributesQuery.isLoading ? (
        <p className="text-xs text-slate-400 ps-[4px]">Loading attributes...</p>
      ) : loadError ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {loadError}
        </div>
      ) : (
        <FormSection title="Attributes" tone="violet">
          <AttributeValuesForm
            items={attributesQuery.data?.items ?? []}
            valuesBySettingsAttributeId={valuesBySettingsAttributeId}
            onValueChange={handleValueChange}
            disabled={isSaving}
          />
        </FormSection>
      )}
    </CreateEditModalShell>
  );
};

