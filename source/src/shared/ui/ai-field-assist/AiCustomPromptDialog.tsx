import React, { useState } from 'react';
import { ConfirmDialogShell } from '../ConfirmDialogShell';
import { FormField } from '../FormSection';
import { UiTextareaCore } from '../HeroFieldControls';

export type AiCustomPromptDialogProps = {
  open: boolean;
  isRunning?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
};

export const AiCustomPromptDialog: React.FC<AiCustomPromptDialogProps> = ({
  open,
  isRunning = false,
  error,
  onClose,
  onSubmit,
}) => {
  const [prompt, setPrompt] = useState('');

  React.useEffect(() => {
    if (open) {
      setPrompt('');
    }
  }, [open]);

  return (
    <ConfirmDialogShell
      open={open}
      title="Edit with AI prompt"
      size="md"
      onClose={onClose}
      onConfirm={() => onSubmit(prompt.trim())}
      confirmIntent="primary"
      confirmLabel="Run"
      cancelLabel="Cancel"
      isConfirming={isRunning}
      confirmingLabel="Running…"
      confirmDisabled={!prompt.trim()}
      error={error}
      bodyClassName="w-full min-w-0"
    >
      <FormField label="Describe how to edit the text" className="w-full min-w-0">
        <UiTextareaCore
          id="eua-custom-prompt"
          className="block w-full min-w-0"
          rows={5}
          autoFocus
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. Make it shorter and friendlier"
        />
      </FormField>
    </ConfirmDialogShell>
  );
};
