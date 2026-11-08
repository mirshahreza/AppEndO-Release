import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AttributeValuesForm } from '../../features/attributes/components/AttributeValuesForm';
import type { AttributeValueItem } from '../../shared/api/contracts/attributes/types';
import {
  attributeValuesToFormState,
  buildAttributeValuesPayload,
} from '../../shared/api/queries/attributeValues';
import { useUpdateMyEditableAttributesMutation } from '../../shared/api/queries/profile';
import { AppButton, AppToast, CreateEditModalShell } from '../../shared/ui';
import { useCultureT } from '../../core/culture/CultureContext';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';
import { useAuth } from '../../contexts/AuthContext';

export type ProfilePreferencesModalProps = {
  open: boolean;
  items: AttributeValueItem[];
  onClose: () => void;
};

export const ProfilePreferencesModal: React.FC<ProfilePreferencesModalProps> = ({
  open,
  items,
  onClose,
}) => {
  const t = useCultureT();
  const { refreshSession } = useAuth();
  const updateMutation = useUpdateMyEditableAttributesMutation();
  const [valuesBySettingsAttributeId, setValuesByDefinitionId] = useState<Record<number, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setValuesByDefinitionId(attributeValuesToFormState(items));
    setSaveError(null);
  }, [open, items]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!open) return null;

  const handleSave = async () => {
    setSaveError(null);
    const payload = buildAttributeValuesPayload(items, valuesBySettingsAttributeId);
    const { data, response } = await updateMutation.mutateAsync(payload);

    if (!response.ok || !data.success) {
      const message = typeof data.error === 'string' && data.error.trim()
        ? data.error
        : t(profileKey('errors.savePreferences'));
      setSaveError(message);
      setToast({ type: 'error', text: message });
      return;
    }

    await refreshSession();
    setToast({ type: 'success', text: t(profileKey('success.preferencesSaved')) });
    onClose();
  };

  return (
    <>
      {toast ? <AppToast type={toast.type} text={toast.text} /> : null}
      <CreateEditModalShell
        size="lg"
        backdropClassName="z-[170]"
        title={t(profileKey('modals.editPreferences'))}
        onClose={onClose}
        footer={(
          <>
            <AppButton intent="cancel" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              {t(profileKey('actions.cancel'))}
            </AppButton>
            <AppButton intent="primary" onClick={() => void handleSave()} disabled={updateMutation.isPending}>
              <Check className="w-3.5 h-3.5" />
              {updateMutation.isPending ? t(profileKey('actions.saving')) : t(profileKey('actions.savePreferences'))}
            </AppButton>
          </>
        )}
      >
        <p className="text-xs text-slate-600 mb-3">{t(profileKey('modals.editPreferencesIntro'))}</p>
        <AttributeValuesForm
          items={items}
          valuesBySettingsAttributeId={valuesBySettingsAttributeId}
          onValueChange={(settingsAttributeId, value) => {
            setValuesByDefinitionId((current) => ({ ...current, [settingsAttributeId]: value }));
          }}
          disabled={updateMutation.isPending}
        />
        {saveError ? <p className="mt-3 text-xs text-rose-600 font-semibold">{saveError}</p> : null}
      </CreateEditModalShell>
    </>
  );
};
