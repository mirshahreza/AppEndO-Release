import React, { useState } from 'react';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  FormSection,
  UiInput,
} from '../../../shared/ui';

type WorkbookCreateModalProps = {
  open: boolean;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: { name: string }) => void;
};

export const WorkbookCreateModal: React.FC<WorkbookCreateModalProps> = ({
  open,
  isSaving,
  error,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('Untitled workbook');

  if (!open) {
    return null;
  }

  const valid = name.trim().length > 0;

  return (
    <CreateEditModalShell
      size="md"
      title="New workbook"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>Cancel</AppButton>
          <AppButton
            intent="create"
            disabled={!valid || isSaving}
            onClick={() => onCreate({ name: name.trim() })}
          >
            {isSaving ? 'Creating…' : 'Create'}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-1">
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        ) : null}
        <FormSection title="Workbook" hint="A private spreadsheet. Only you can open it." ink="accent">
          <FormField label="Name" required invalid={!valid}>
            <UiInput
              size="sm"
              value={name}
              onChange={(event) => setName(event.target.value)}
              ariaLabel="Workbook name"
            />
          </FormField>
        </FormSection>
      </div>
    </CreateEditModalShell>
  );
};
