import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { AppButton, CreateEditModalShell, FormField, UiInput } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import {
  getSchemaObjectNameFieldState,
  SCHEMA_OBJECT_NAME_HELPER_TEXT,
  sanitizeSchemaObjectNameInput,
  schemaObjectNameFieldProps,
  validateSchemaObjectName,
} from '../../../shared/lib/schemaObjectName';
import type { DataStudioExplorerObjectKind } from '../types';
import { getDataStudioExplorerObjectKindLabel } from '../lib/explorerObjectKinds';
import { usesSqlEditorForCreate } from '../lib/schemaObjectSqlTemplates';

type CreateSchemaObjectDialogProps = {
  open: boolean;
  objectKind: DataStudioExplorerObjectKind;
  dataSourceName: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (objectName: string) => void;
};

export const CreateSchemaObjectDialog: React.FC<CreateSchemaObjectDialogProps> = ({
  open,
  objectKind,
  dataSourceName,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [objectName, setObjectName] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setObjectName('');
  }, [open, objectKind]);

  const nameFieldState = useMemo(
    () => getSchemaObjectNameFieldState(objectName, { fieldLabel: 'Object name' }),
    [objectName],
  );

  if (!open) {
    return null;
  }

  const objectKindLabel = getDataStudioExplorerObjectKindLabel(objectKind);
  const opensSqlEditor = usesSqlEditorForCreate(objectKind);
  const trimmedName = objectName.trim();
  const canSubmit = !nameFieldState.invalid && Boolean(trimmedName) && !isSubmitting;
  const hintToneClass = !trimmedName
    ? 'text-slate-400'
    : nameFieldState.invalid
      ? 'text-rose-500'
      : 'text-emerald-600';

  const handleSubmit = () => {
    const validationMessage = validateSchemaObjectName(objectName, { fieldLabel: 'Object name' });
    if (validationMessage) {
      return;
    }

    onSubmit(trimmedName);
  };

  return (
    <CreateEditModalShell
      size="md"
      title="Create object"
      subtitle={dataSourceName ? `${objectKindLabel} · ${dataSourceName}` : objectKindLabel}
      bodyClassName="flex flex-col gap-3 !pb-[45px]"
      showCloseButton={!isSubmitting}
      closeOnEscape={!isSubmitting}
      onClose={isSubmitting ? () => undefined : onClose}
      onBackdropClick={isSubmitting ? () => undefined : onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <AppButton intent="cancel" size="sm" disabled={isSubmitting} onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="create" size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                {opensSqlEditor ? 'Continue' : 'Create'}
              </>
            )}
          </AppButton>
        </div>
      )}
    >
      <p
        className={cn('ps-[4px] text-[10px] leading-4 h-8 line-clamp-2', hintToneClass)}
        aria-live="polite"
      >
        {opensSqlEditor
          ? 'A starter CREATE script will open next — edit it, then run it from the SQL panel header.'
          : SCHEMA_OBJECT_NAME_HELPER_TEXT}
      </p>
      <FormField
        label="Object name"
        required
        {...schemaObjectNameFieldProps(nameFieldState)}
      >
        <UiInput
          id="create-schema-object-name"
          size="sm"
          aiAssist={false}
          autoDir={false}
          value={objectName}
          autoFocus
          disabled={isSubmitting}
          placeholder="e.g. customer_orders"
          onChange={(event) => setObjectName(sanitizeSchemaObjectNameInput(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSubmit) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
      </FormField>
    </CreateEditModalShell>
  );
};
