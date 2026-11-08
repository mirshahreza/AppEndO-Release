import React from 'react';
import { Plus, X } from 'lucide-react';
import { AppButton, CreateEditModalShell, FormField, UiInput } from '../../../shared/ui';
import { isNpmPackageName } from '../../../core/packages/developerLibraries';

export type LibraryInstallModalProps = {
  open: boolean;
  name: string;
  versionRange: string;
  error: string | null;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onVersionRangeChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const LibraryInstallModal: React.FC<LibraryInstallModalProps> = ({
  open,
  name,
  versionRange,
  error,
  isSaving,
  onNameChange,
  onVersionRangeChange,
  onClose,
  onSubmit,
}) => {
  if (!open) return null;

  const trimmedName = name.trim();
  const nameInvalid = Boolean(trimmedName) && !isNpmPackageName(trimmedName);

  return (
    <CreateEditModalShell
      size="sm"
      title="Install library"
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="create"
            onClick={onSubmit}
            disabled={isSaving || !trimmedName || nameInvalid}
          >
            <Plus className="h-3.5 w-3.5" />
            {isSaving ? 'Installing...' : 'Install'}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <FormField label="npm name" required invalid={nameInvalid} hint="Scoped names such as @org/pkg are allowed.">
          <UiInput
            size="sm"
            autoDir={false}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="xlsx"
            ariaLabel="Library npm package name"
            isRequired
            isInvalid={nameInvalid}
          />
        </FormField>
        <FormField label="Version range" hint="Optional. Empty installs the latest compatible version.">
          <UiInput
            size="sm"
            autoDir={false}
            value={versionRange}
            onChange={(event) => onVersionRangeChange(event.target.value)}
            placeholder="^0.18.5"
            ariaLabel="Library version range"
          />
        </FormField>
        {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};
