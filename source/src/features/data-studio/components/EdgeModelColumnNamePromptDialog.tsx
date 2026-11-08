import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  UiInput,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import {
  EDGE_COLUMN_NAME_HELPER_TEXT,
  sanitizeEdgeColumnNameInput,
  validateEdgeColumnName,
} from '../lib/edgeModelColumnUtils';

export type EdgeModelColumnNamePromptDialogProps = {
  open: boolean;
  title: string;
  subtitle: string;
  fieldLabel: string;
  placeholder: string;
  /** Sample base name used for the column preview before the user types. */
  exampleName: string;
  confirmLabel: string;
  buildPreviewNames: (name: string) => readonly string[];
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export const EdgeModelColumnNamePromptDialog: React.FC<EdgeModelColumnNamePromptDialogProps> = ({
  open,
  title,
  subtitle,
  fieldLabel,
  placeholder,
  exampleName,
  confirmLabel,
  buildPreviewNames,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setName('');
  }, [open]);

  const trimmedName = name.trim();
  const validationMessage = useMemo(
    () => (trimmedName
      ? validateEdgeColumnName(trimmedName, { fieldLabel })
      : null),
    [fieldLabel, trimmedName],
  );
  const nameInvalid = Boolean(trimmedName) && Boolean(validationMessage);
  const hasLivePreviewName = Boolean(trimmedName) && !nameInvalid;
  const previewBaseName = hasLivePreviewName ? trimmedName : exampleName;
  const previewNames = useMemo(
    () => [...buildPreviewNames(previewBaseName)],
    [buildPreviewNames, previewBaseName],
  );

  if (!open) {
    return null;
  }

  const canSubmit = Boolean(trimmedName) && !nameInvalid;

  const handleSubmit = () => {
    if (!canSubmit || validateEdgeColumnName(trimmedName, { fieldLabel })) {
      return;
    }

    onSubmit(trimmedName);
  };

  return (
    <CreateEditModalShell
      size="lg"
      title={title}
      subtitle={subtitle}
      shellClassName="min-h-[420px] !border-4 !border-[color:var(--app-accent-500)]/50"
      bodyClassName={cn(
        'flex min-h-[300px] w-full min-w-0 flex-col gap-3 !pb-[45px]',
        '[&_[data-slot=input]]:!w-full [&_[data-slot=input-wrapper]]:!w-full',
      )}
      // Above Edge Model designer floating panels (base z-index 120+).
      backdropClassName="!z-[1000]"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <div className="flex w-full justify-end gap-2">
          <AppButton intent="cancel" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="create" size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            <Plus className="h-3.5 w-3.5" />
            {confirmLabel}
          </AppButton>
        </div>
      )}
    >
      <p
        className={cn(
          'min-h-8 w-full ps-[4px] text-[10px] leading-4',
          !trimmedName
            ? 'text-slate-400'
            : nameInvalid
              ? 'text-rose-500'
              : 'text-emerald-600',
        )}
        aria-live="polite"
      >
        {EDGE_COLUMN_NAME_HELPER_TEXT}
      </p>
      <FormField
        label={fieldLabel}
        required
        className="w-full min-w-0"
        invalid={nameInvalid}
        error={validationMessage}
      >
        <UiInput
          id="edge-model-column-name-prompt"
          size="sm"
          aiAssist={false}
          autoDir={false}
          className="block w-full min-w-0"
          value={name}
          autoFocus
          placeholder={placeholder}
          onChange={(event) => setName(sanitizeEdgeColumnNameInput(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSubmit) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
      </FormField>
      <div className="w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2">
        <p className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Columns to add
        </p>
        <ul
          className={cn(
            'mt-[2px] min-h-[5.5rem] space-y-0.5 ps-[4px] font-mono text-[11px]',
            hasLivePreviewName ? 'text-slate-700' : 'text-slate-400',
          )}
        >
          {previewNames.map((previewName) => (
            <li key={previewName}>{previewName}</li>
          ))}
        </ul>
      </div>
    </CreateEditModalShell>
  );
};
