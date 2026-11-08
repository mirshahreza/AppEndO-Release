import React, { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, Rocket, Save, X } from 'lucide-react';
import { FloatingPanelShell } from '../../../shared/ui/FloatingPanelShell';
import { AppButton, ConfirmDialogShell, UiInput, UiSelect } from '../../../shared/ui';
import { workflowRuntimeApi, WorkflowRuntimeApiError } from '../api/workflowRuntimeApi';
import type { WorkflowDesignerProjection } from '../types';

const PANEL_BOUNDS = { minWidth: 380, maxWidth: 640, minHeight: 320, maximizeInset: 24 };

type StartType = 'MANUAL_API' | 'EVENT' | 'SCHEDULE' | 'WEBHOOK';

/** Loose mirror of the server's `StartDefinition` union (`awm/types.ts`) — frontend types.ts keeps `start` untyped, so this file owns just enough shape to build a valid `CHANGE_START` payload. */
type StartValue = { type: string; targetNodeKey: string; [k: string]: unknown };

const startTypeOf = (start: StartValue): StartType => (['MANUAL_API', 'EVENT', 'SCHEDULE', 'WEBHOOK'].includes(start.type) ? (start.type as StartType) : 'MANUAL_API');

/**
 * p-68 WHOOK — the workflow's Start configuration: which trigger type starts it, and (for WEBHOOK)
 * the callable URL. No Start editor existed anywhere in the Designer before this — every start type
 * (not just WEBHOOK) is covered here, following `WorkflowSecretReferencesPanel.tsx`'s
 * `FloatingPanelShell` pattern. Type/targetNodeKey/eventName/cron edits are draft-local (queued via
 * `onSave`, like every other node edit — only takes effect on the workspace's own Save); the webhook
 * secret is NOT draft state — it's live server state that only exists once the workflow has been
 * published at least once, so that section calls `workflowRuntimeApi` directly and ignores the
 * dirty/readOnly draft lock.
 */
export const WorkflowStartSettingsPanel: React.FC<{
  open: boolean;
  onClose: () => void;
  definitionId: number;
  projection: WorkflowDesignerProjection;
  start: StartValue;
  readOnly: boolean;
  onSave: (start: StartValue) => void;
}> = ({ open, onClose, definitionId, projection, start, readOnly, onSave }) => {
  const [type, setType] = useState<StartType>(startTypeOf(start));
  const [eventName, setEventName] = useState('');
  const [cron, setCron] = useState('');

  const [status, setStatus] = useState<{ configured: boolean; enabled: boolean; rotatedAt: string | null } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(startTypeOf(start));
    setEventName(typeof start.eventName === 'string' ? start.eventName : '');
    const binding = start.scheduledTaskBinding as { bindingId?: string } | undefined;
    setCron(binding?.bindingId ?? '');
    setRawToken(null);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, start.type]);

  const loadStatus = React.useCallback(async () => {
    setStatusError(null);
    try {
      const result = await workflowRuntimeApi.getWebhookSecretStatus(definitionId);
      setStatus(result);
    } catch (e) {
      setStatusError(e instanceof WorkflowRuntimeApiError ? e.message : 'Failed to load webhook status.');
    }
  }, [definitionId]);

  useEffect(() => {
    if (open && type === 'WEBHOOK') void loadStatus();
  }, [open, type, loadStatus]);

  const isPublished = projection.publicationStatus.isPublished;

  const generate = async () => {
    setBusy(true);
    setStatusError(null);
    try {
      const result = await workflowRuntimeApi.rotateWebhookSecret(definitionId);
      setRawToken(result.token);
      setConfirmRegenerateOpen(false);
      await loadStatus();
    } catch (e) {
      setStatusError(e instanceof WorkflowRuntimeApiError ? e.message : 'Failed to generate webhook secret.');
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!rawToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/api/workflow-hooks/${rawToken}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const canSaveType = type === 'MANUAL_API'
    || (type === 'EVENT' && eventName.trim().length > 0)
    || (type === 'SCHEDULE' && cron.trim().length > 0)
    || type === 'WEBHOOK';

  const submit = () => {
    if (type === 'MANUAL_API') {
      onSave({ type: 'MANUAL_API', targetNodeKey: start.targetNodeKey });
    } else if (type === 'EVENT') {
      onSave({ type: 'EVENT', targetNodeKey: start.targetNodeKey, eventName: eventName.trim() });
    } else if (type === 'SCHEDULE') {
      onSave({ type: 'SCHEDULE', targetNodeKey: start.targetNodeKey, scheduledTaskBinding: { bindingType: 'CRON', bindingId: cron.trim() } });
    } else {
      onSave({ type: 'WEBHOOK', targetNodeKey: start.targetNodeKey, ingressBinding: { bindingType: 'HTTP', bindingId: 'AUTO' } });
    }
    onClose();
  };

  return (
    <FloatingPanelShell
      open={open}
      onClose={onClose}
      title="Start settings"
      titleIcon={<Rocket className="h-4 w-4 text-indigo-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={480}
      defaultHeight={420}
      initialPosition="center"
      zIndexClassName="z-[93]"
    >
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
        {readOnly ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
            Published workflow — unpublish to change the start type. The webhook URL below can still be generated/regenerated while published.
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-slate-700">Start type</span>
          <UiSelect
            size="sm"
            ariaLabel="Start type"
            value={type}
            disabled={readOnly}
            onChange={(e) => setType(e.target.value as StartType)}
          >
            <option value="MANUAL_API">Manual / API — started explicitly by a caller</option>
            <option value="EVENT">Event — started when a named event occurs</option>
            <option value="SCHEDULE">Schedule — started on a cron schedule</option>
            <option value="WEBHOOK">Webhook — started by an external HTTP POST</option>
          </UiSelect>
        </div>

        {type === 'EVENT' ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-700">Event name</span>
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              className="text-xs"
              placeholder="e.g. order.created"
              value={eventName}
              disabled={readOnly}
              onChange={(e) => setEventName(e.target.value)}
            />
          </div>
        ) : null}

        {type === 'SCHEDULE' ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-700">Cron expression</span>
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              className="text-xs font-mono"
              placeholder="e.g. */15 * * * *"
              value={cron}
              disabled={readOnly}
              onChange={(e) => setCron(e.target.value)}
            />
          </div>
        ) : null}

        {type === 'WEBHOOK' ? (
          <div className="flex flex-col gap-1.5 rounded border border-slate-200 p-2">
            <span className="text-[11px] font-semibold text-slate-700">Webhook URL</span>
            {!isPublished ? (
              <p className="text-[11px] text-slate-500">Publish this workflow first, then generate its webhook URL here.</p>
            ) : (
              <>
                {statusError ? <div className="rounded border border-red-200 bg-red-50 p-1.5 text-[11px] text-red-700">{statusError}</div> : null}

                {rawToken ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-1.5 py-1 text-[11px]">
                        {window.location.origin}/api/workflow-hooks/{rawToken}
                      </code>
                      <AppButton intent="utility" size="icon-sm" tabStop="skip" onClick={() => void copyUrl()} title="Copy URL">
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </AppButton>
                    </div>
                    <p className="text-[10px] font-semibold text-amber-700">
                      This URL is shown only once — copy it now. It cannot be retrieved again (only regenerated, which invalidates it).
                    </p>
                  </>
                ) : status?.configured ? (
                  <p className="text-[11px] text-slate-600">
                    A webhook URL is already configured{status.enabled ? '' : ' (currently disabled)'}. The URL itself was only shown at generation time — regenerate to get a new one.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">No webhook URL generated yet.</p>
                )}

                <AppButton
                  intent="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => (status?.configured ? setConfirmRegenerateOpen(true) : void generate())}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {status?.configured ? 'Regenerate' : 'Generate'} webhook URL
                </AppButton>
              </>
            )}
          </div>
        ) : null}

        {type !== 'WEBHOOK' || !readOnly ? (
          <div className="mt-auto flex justify-end gap-1.5 border-t border-slate-200 pt-2">
            <AppButton intent="cancel" size="sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              Close
            </AppButton>
            {!readOnly ? (
              <AppButton intent="primary" size="sm" disabled={!canSaveType} onClick={submit}>
                <Save className="h-3.5 w-3.5" />
                Save
              </AppButton>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmDialogShell
        open={confirmRegenerateOpen}
        title="Regenerate webhook URL?"
        onClose={() => setConfirmRegenerateOpen(false)}
        onConfirm={() => void generate()}
        confirmLabel="Regenerate"
        confirmIntent="destructive"
        isConfirming={busy}
      >
        <p className="text-sm text-slate-700">
          The current URL will stop working immediately — any external system already using it must be updated with the new one.
        </p>
      </ConfirmDialogShell>
    </FloatingPanelShell>
  );
};
