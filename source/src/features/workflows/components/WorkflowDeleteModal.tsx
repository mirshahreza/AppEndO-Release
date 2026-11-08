import React from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import {
  AppButton,
  ConfirmDialogShell,
  DestructiveConfirmBody,
  UiInput,
} from '../../../shared/ui';
import type { WorkflowDeletePreview } from '../lib/workflowDeletePreview';
import type { WorkflowDefinitionSummary } from '../types';

export type WorkflowDeleteTarget = WorkflowDefinitionSummary;

type WorkflowDeleteModalProps = {
  target: WorkflowDeleteTarget | null;
  preview: WorkflowDeletePreview | null;
  confirmName: string;
  error: string | null;
  isDeleting: boolean;
  isLoadingPreview: boolean;
  onConfirmNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const ExecutionHistoryDetails: React.FC<{ preview: WorkflowDeletePreview }> = ({ preview }) => (
  <div className="flex flex-col gap-2 text-xs text-slate-600">
    <p className="text-start">
      This workflow has been executed before. Deleting it permanently removes its draft, published revisions,
      designer layout, validation history, simulation runs, and all {preview.instanceCount} execution record
      {preview.instanceCount === 1 ? '' : 's'} (including completed and cancelled runs).
    </p>
    <p className="text-start">
      This cannot be undone. The workflow key will become available for a new definition, but historical
      audit data tied to this definition will be gone.
    </p>
    {preview.revisionCount > 0 ? (
      <p className="text-start font-medium text-slate-700">
        {preview.revisionCount} published revision{preview.revisionCount === 1 ? '' : 's'} will also be removed.
      </p>
    ) : null}
    {preview.nonTerminalInstanceCount > 0 ? (
      <p className="text-start font-medium text-rose-700">
        {preview.nonTerminalInstanceCount} running instance{preview.nonTerminalInstanceCount === 1 ? '' : 's'} will be cancelled during deletion.
      </p>
    ) : null}
  </div>
);

export const WorkflowDeleteModal: React.FC<WorkflowDeleteModalProps> = ({
  target,
  preview,
  confirmName,
  error,
  isDeleting,
  isLoadingPreview,
  onConfirmNameChange,
  onCancel,
  onConfirm,
}) => {
  if (!target) {
    return null;
  }

  const requiresTypedConfirmation = Boolean(preview?.hasExecutionHistory);
  const nameMatches = confirmName.trim() === target.key;
  const canConfirmDelete = Boolean(preview?.canDelete)
    && !isLoadingPreview
    && Boolean(preview)
    && (!requiresTypedConfirmation || nameMatches);

  const blockerMessage = preview && !preview.canDelete
    ? preview.blockerMessage
    : null;

  return (
    <ConfirmDialogShell
      size="md"
      title="Delete workflow"
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      closeOnEscape={!isDeleting}
      error={error}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onCancel} disabled={isDeleting}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            disabled={isDeleting || !canConfirmDelete}
            onClick={() => { void onConfirm(); }}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </>
            )}
          </AppButton>
        </>
      )}
    >
      {isLoadingPreview ? (
        <p className="text-sm text-slate-600">Loading workflow details…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <DestructiveConfirmBody
            question={requiresTypedConfirmation
              ? 'This workflow has execution history. Confirm permanent deletion.'
              : 'Delete this unpublished workflow?'}
            warning={preview?.canDelete ? 'This action cannot be undone.' : undefined}
            entityName={target.key}
            entityDetail={target.scopeKey !== 'global' ? `scope: ${target.scopeKey}` : undefined}
            extra={preview?.hasExecutionHistory && preview.canDelete ? (
              <ExecutionHistoryDetails preview={preview} />
            ) : preview?.canDelete ? (
              <p className="text-start text-xs text-slate-600">
                The draft definition and any saved designer layout will be removed permanently.
                No execution history exists for this workflow.
              </p>
            ) : null}
          />

          {blockerMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-semibold">{blockerMessage}</p>
              {preview?.subflowReferencers && preview.subflowReferencers.length > 0 ? (
                <ul className="mt-2 list-disc ps-4">
                  {preview.subflowReferencers.map((referencer) => (
                    <li key={referencer.id} className="font-mono">{referencer.key}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {requiresTypedConfirmation && preview?.canDelete ? (
            <div className="space-y-[2px]">
              <label className="block ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Type the workflow name to confirm
              </label>
              <UiInput
                size="sm"
                autoDir={false}
                value={confirmName}
                onChange={(event) => onConfirmNameChange(event.target.value)}
                placeholder={target.key}
                ariaLabel="Type workflow name to confirm deletion"
                className="font-mono"
                autoFocus
              />
              <p className="ps-[4px] text-[10px] font-medium text-slate-500">
                Enter <span className="font-mono font-semibold text-slate-700">{target.key}</span> exactly.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </ConfirmDialogShell>
  );
};
