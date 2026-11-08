import React, { useEffect, useState } from 'react';
import { ConfirmDialogShell, FormField, UiInput } from '../../../shared/ui';

export type RecordPolicyNameDialogProps = {
  open: boolean;
  isSaving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export const RecordPolicyNameDialog: React.FC<RecordPolicyNameDialogProps> = ({
  open,
  isSaving = false,
  error,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
    }
  }, [open]);

  return (
    <ConfirmDialogShell
      open={open}
      title="New policy"
      size="md"
      onClose={onClose}
      onConfirm={() => onSubmit(name.trim())}
      confirmIntent="primary"
      confirmLabel="Create"
      cancelLabel="Cancel"
      isConfirming={isSaving}
      confirmingLabel="Creating…"
      confirmDisabled={!name.trim()}
      error={error}
      bodyClassName="w-full min-w-0"
    >
      <FormField label="Policy name" className="w-full min-w-0" required>
        <UiInput
          className="block w-full min-w-0"
          autoFocus
          value={name}
          placeholder="e.g. Tenant scope"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim()) {
              event.preventDefault();
              onSubmit(name.trim());
            }
          }}
        />
      </FormField>
    </ConfirmDialogShell>
  );
};
