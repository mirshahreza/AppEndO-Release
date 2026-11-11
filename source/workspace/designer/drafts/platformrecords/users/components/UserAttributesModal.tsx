import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useCultureT } from '@/src/core/culture/CultureContext';
import { profileKey } from '@/src/core/culture/translations/cultureKeyHelpers';
import { AttributeValuesForm } from '@/src/features/attributes/components/AttributeValuesForm';
import type { UserRecord } from '@/src/shared/api/queries/users';
import {
  attributeValuesToFormState,
  useUserAttributesQuery,
  useUserSessionPreviewQuery,
} from '@/src/shared/api/queries/attributeValues';
import { AppButton, CreateEditModalShell } from '@/src/shared/ui';
import { USER_FORM_FIELD_LABEL_CLASS, UserFormSection } from './userFormLayout';

export type UserAttributesModalProps = {
  open: boolean;
  editingUser: UserRecord | null;
  editError: string | null;
  isSaving: boolean;
  valuesBySettingsAttributeId: Record<number, unknown>;
  onValuesChange: (values: Record<number, unknown>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const UserAttributesModal: React.FC<UserAttributesModalProps> = ({
  open,
  editingUser,
  editError,
  isSaving,
  valuesBySettingsAttributeId,
  onValuesChange,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();
  const userId = editingUser?.id ?? null;
  const attributesQuery = useUserAttributesQuery(userId, open);
  const sessionPreviewQuery = useUserSessionPreviewQuery(userId, open);
  const [initializedForUserId, setInitializedForUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !editingUser || !attributesQuery.data?.items) return;
    if (initializedForUserId === editingUser.id) return;
    onValuesChange(attributeValuesToFormState(attributesQuery.data.items));
    setInitializedForUserId(editingUser.id);
  }, [open, editingUser, attributesQuery.data?.items, initializedForUserId, onValuesChange]);

  useEffect(() => {
    if (!open) {
      setInitializedForUserId(null);
    }
  }, [open]);

  if (!open || !editingUser) return null;

  const loadError = attributesQuery.isError
    ? (attributesQuery.error instanceof Error ? attributesQuery.error.message : t('users.attributes.loadFailed'))
    : null;

  const handleValueChange = (settingsAttributeId: number, value: unknown) => {
    onValuesChange({ ...valuesBySettingsAttributeId, [settingsAttributeId]: value });
  };

  return (
    <CreateEditModalShell
      size="2xl"
      title={t('users.modal.editAttributes', { id: String(editingUser.id) })}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>{t('actions.cancel')}</AppButton>
          <AppButton
            intent="primary"
            onClick={onSubmit}
            disabled={isSaving || attributesQuery.isLoading || Boolean(loadError)}
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? t('actions.saving') : t('actions.save')}
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
        <p className="text-xs text-slate-400 ps-[4px]">{t('users.attributes.loading')}</p>
      ) : loadError ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {loadError}
        </div>
      ) : (
        <>
          <UserFormSection title={t(profileKey('sections.attributes'))} tone="emerald">
            <AttributeValuesForm
              items={attributesQuery.data?.items ?? []}
              valuesBySettingsAttributeId={valuesBySettingsAttributeId}
              onValueChange={handleValueChange}
              disabled={isSaving}
            />
          </UserFormSection>

          <UserFormSection title={t('users.modal.sessionPreview')} tone="indigo" divided>
            {sessionPreviewQuery.isLoading ? (
              <p className="text-xs text-slate-400 ps-[4px]">{t('users.attributes.sessionResolving')}</p>
            ) : sessionPreviewQuery.isError ? (
              <p className="text-xs text-rose-600 ps-[4px]">{t('users.attributes.sessionLoadFailed')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-[2px]">
                  <p className={USER_FORM_FIELD_LABEL_CLASS}>{t('users.attributes.clientContext')}</p>
                  <pre className="max-h-28 overflow-auto rounded-md border border-slate-200 bg-slate-50/80 p-2.5 font-mono text-[11px] text-slate-700">
                    {JSON.stringify(sessionPreviewQuery.data?.clientContext ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="flex flex-col gap-[2px]">
                  <p className={USER_FORM_FIELD_LABEL_CLASS}>{t('users.attributes.serverContext')}</p>
                  <pre className="max-h-28 overflow-auto rounded-md border border-slate-200 bg-slate-50/80 p-2.5 font-mono text-[11px] text-slate-700">
                    {JSON.stringify(sessionPreviewQuery.data?.serverContext ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </UserFormSection>
        </>
      )}
    </CreateEditModalShell>
  );
};
