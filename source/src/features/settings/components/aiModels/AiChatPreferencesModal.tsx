import React from 'react';
import { Save, X } from 'lucide-react';
import { UiInput } from '../../../../shared/ui';
import { AppButton } from '../../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';
import type { AiGlobalSettings } from '../../../../shared/api/contracts/ai/types';
import {
  SETTINGS_FORM_GROUP_BODY_STACK_CLASS,
  SETTINGS_CONTROL_CLASS,
  SettingsDisabledFieldset,
  SettingsField,
  SettingsToggleField,
} from '../form/SettingsFormPrimitives';

export type AiChatPreferencesModalProps = {
  open: boolean;
  draft: AiGlobalSettings;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: (next: AiGlobalSettings) => void;
};

export const AiChatPreferencesModal: React.FC<AiChatPreferencesModalProps> = ({
  open,
  draft,
  isSaving,
  onClose,
  onSubmit,
  onDraftChange,
}) => {
  if (!open) return null;

  return (
    <CreateEditModalShell
      size="lg"
      title="AI Models Preferences"
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving}>
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </AppButton>
        </>
      )}
    >
      <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>
        <SettingsToggleField
          id="ai-chat-enabled"
          checked={draft.enabled}
          onChange={(checked) => onDraftChange({
            ...draft,
            enabled: checked,
          })}
          title="Enable AI system-wide"
          description="When off, chat and agent APIs are blocked and AppEndoo has no models — independent of each model's Enabled flag."
        />

        <SettingsDisabledFieldset disabled={!draft.enabled}>
          <SettingsField label="Chat rate limit / minute">
            <UiInput
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              type="number"
              min={1}
              value={draft.chatRateLimitPerMinute}
              onChange={(event) => onDraftChange({
                ...draft,
                chatRateLimitPerMinute: Number(event.target.value) || 1,
              })}
            />
          </SettingsField>
        </SettingsDisabledFieldset>
      </div>
    </CreateEditModalShell>
  );
};
