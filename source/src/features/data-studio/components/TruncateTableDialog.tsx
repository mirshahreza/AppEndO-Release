import React, { useEffect, useState } from 'react';
import { Eraser, Loader2, X } from 'lucide-react';
import {
  AppButton,
  ConfirmDialogShell,
  DestructiveConfirmBody,
  UiInput,
} from '../../../shared/ui';
import type { DataStudioExplorerObjectRow } from '../types';

export type TruncateTableDialogProps = {
  target: DataStudioExplorerObjectRow | null;
  isSubmitting: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export const TruncateTableDialog: React.FC<TruncateTableDialogProps> = ({
  target,
  isSubmitting,
  error = null,
  onCancel,
  onConfirm,
}) => {
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    setConfirmName('');
  }, [target?.id]);

  if (!target) {
    return null;
  }

  const nameMatches = confirmName.trim() === target.name;
  const canConfirm = nameMatches && !isSubmitting;

  return (
    <ConfirmDialogShell
      size="md"
      title="Truncate table"
      icon={<Eraser className="h-4 w-4" />}
      confirmIntent="destructive"
      closeOnEscape={!isSubmitting}
      onClose={isSubmitting ? () => undefined : onCancel}
      onBackdropClick={isSubmitting ? () => undefined : onCancel}
      error={error}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" disabled={isSubmitting} onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            disabled={!canConfirm}
            onClick={() => { void onConfirm(); }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Truncating…
              </>
            ) : (
              <>
                <Eraser className="h-3.5 w-3.5" />
                Truncate table
              </>
            )}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <DestructiveConfirmBody
          question="Remove all rows from this table?"
          warning="This clears every row and keeps the table structure. Linked models are kept. This action cannot be undone."
          entityName={target.name}
        />

        <div className="space-y-[2px]">
          <label className="block ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Type the object name to confirm
          </label>
          <UiInput
            size="sm"
            aiAssist={false}
            autoDir={false}
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={target.name}
            ariaLabel="Type object name to confirm truncate"
            className="font-mono"
            autoFocus
            disabled={isSubmitting}
          />
          <p className="ps-[4px] text-[10px] font-medium text-slate-500">
            Enter <span className="font-mono font-semibold text-slate-700">{target.name}</span> exactly to continue.
          </p>
        </div>
      </div>
    </ConfirmDialogShell>
  );
};
