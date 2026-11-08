import React from 'react';
import { Save, X } from 'lucide-react';
import { AppButton } from '../../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../../shared/ui/CreateEditModalShell';
import type { AiAgentSettingsUpdate } from '../../../../shared/api/queries/aiAgentSettings';
import {
  SETTINGS_FORM_GROUP_BODY_STACK_CLASS,
  SettingsToggleField,
} from '../form/SettingsFormPrimitives';

export type AiAgentPreferencesModalProps = {
  open: boolean;
  draft: AiAgentSettingsUpdate;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: (next: AiAgentSettingsUpdate) => void;
};

export const AiAgentPreferencesModal: React.FC<AiAgentPreferencesModalProps> = ({
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
      title="Agent context preferences"
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
          id="ai-agent-context-summarize-with-llm"
          checked={draft.contextSummarizeWithLlm ?? true}
          onChange={(checked) => onDraftChange({
            ...draft,
            contextSummarizeWithLlm: checked,
          })}
          title="LLM segment history summaries"
          description="When on, long chat segments are summarized with a cheap model before assembly (TOK-15). When off, only heuristic summaries are used — faster and cheaper, but less nuanced."
        />
      </div>
    </CreateEditModalShell>
  );
};
