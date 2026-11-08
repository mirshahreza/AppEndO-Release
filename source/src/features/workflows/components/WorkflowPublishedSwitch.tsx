import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { workflowsApi, WorkflowsApiError } from '../api/workflowsApi';
import type { WorkflowDesignerProjection } from '../types';
import { ConfirmDialogShell, UiSwitch } from '../../../shared/ui';
import { WorkflowPublishDialog } from './ValidationPublishPanel';
import { isWorkflowPublished } from '../lib/workflowPublished';

export const WorkflowPublishedSwitch: React.FC<{
  definitionId: number;
  projection: WorkflowDesignerProjection;
  disabled?: boolean;
  onChanged: () => void;
}> = ({ definitionId, projection, disabled = false, onChanged }) => {
  const published = isWorkflowPublished(projection);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [incompleteInstanceCount, setIncompleteInstanceCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPublish = () => {
    setError(null);
    setPublishOpen(true);
  };

  const requestUnpublish = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await workflowsApi.getUnpublishImpact(definitionId);
      setIncompleteInstanceCount(result.impact.incompleteInstanceCount);
      setUnpublishOpen(true);
    } catch (unpublishError) {
      setError(unpublishError instanceof WorkflowsApiError ? `${unpublishError.code}: ${unpublishError.message}` : 'Failed to load unpublish impact.');
    } finally {
      setBusy(false);
    }
  };

  const confirmUnpublish = async () => {
    setBusy(true);
    setError(null);
    try {
      await workflowsApi.unpublish(definitionId, projection.definition.stateVersion);
      setUnpublishOpen(false);
      onChanged();
    } catch (unpublishError) {
      setError(unpublishError instanceof WorkflowsApiError ? `${unpublishError.code}: ${unpublishError.message}` : 'Unpublish failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex shrink-0 translate-y-px items-center gap-2 border-s border-slate-200 ps-2">
        <UiSwitch
          aria-label="Published"
          isSelected={published}
          isDisabled={disabled || busy}
          onChange={(nextSelected) => {
            if (nextSelected) {
              requestPublish();
              return;
            }
            void requestUnpublish();
          }}
          label="Published"
        />
      </div>

      <WorkflowPublishDialog
        open={publishOpen}
        definitionId={definitionId}
        projection={projection}
        onClose={() => setPublishOpen(false)}
        onPublished={() => {
          setPublishOpen(false);
          onChanged();
        }}
      />

      <ConfirmDialogShell
        open={unpublishOpen}
        title="Unpublish workflow?"
        icon={<AlertTriangle className="h-4 w-4" />}
        onClose={() => {
          if (!busy) {
            setUnpublishOpen(false);
          }
        }}
        onConfirm={() => { void confirmUnpublish(); }}
        confirmLabel="Unpublish"
        confirmIntent="destructive"
        isConfirming={busy}
        error={error}
      >
        <p className="text-sm text-slate-700">
          This workflow will stop accepting new runs and return to unpublished state.
        </p>
        {incompleteInstanceCount > 0 ? (
          <p className="mt-2 text-sm font-semibold text-rose-700">
            {incompleteInstanceCount} running instance{incompleteInstanceCount === 1 ? '' : 's'} will be cancelled and cannot be resumed.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No incomplete instances are currently running.</p>
        )}
      </ConfirmDialogShell>
    </>
  );
};
