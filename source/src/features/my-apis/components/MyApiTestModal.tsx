import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Play, X } from 'lucide-react';
import { AppButton, UiTextarea } from '../../../shared/ui';
import { CreateEditModalShell } from '../../../shared/ui/CreateEditModalShell';
import { invokeAuthenticatedApiRoute } from '../../../shared/api/queries/server-functions';
import type { AccessibleApiRouteItem } from '../../../shared/api/contracts/my-apis/types';

export type MyApiTestModalProps = {
  route: AccessibleApiRouteItem;
  onClose: () => void;
};

export const MyApiTestModal: React.FC<MyApiTestModalProps> = ({ route, onClose }) => {
  const [payloadText, setPayloadText] = useState(route.testPayload);
  const [formError, setFormError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);

  const outputText = useMemo(() => (
    output ? JSON.stringify(output, null, 2) : ''
  ), [output]);

  const handleRun = async () => {
    setFormError(null);
    setOutput(null);

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      setFormError('Payload must be valid JSON.');
      return;
    }

    setIsRunning(true);
    try {
      const { data } = await invokeAuthenticatedApiRoute({
        path: route.path,
        method: route.method,
        payload: parsedPayload,
      });
      setOutput(data);
    } catch (error) {
      setOutput({
        success: false,
        error: error instanceof Error ? error.message : 'Request failed.',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const httpStatus = typeof output?._httpStatus === 'number' ? output._httpStatus : null;
  const requestFailed = Boolean(output?.error)
    || output?.success === false
    || (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300));

  return (
    <CreateEditModalShell
      size="maximized"
      bodyClassName="flex flex-col min-h-0 flex-1 overflow-hidden"
      title="Test API Route"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Close
          </AppButton>
          <AppButton intent="confirm" onClick={() => void handleRun()} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Run
              </>
            )}
          </AppButton>
        </>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-sm font-semibold text-slate-800">{route.name}</p>
          <p className="mt-1 font-mono text-xs text-slate-600">
            {route.method} {route.path}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[2px]">
          <label className="ps-[4px] text-xs font-semibold text-slate-600">Request payload (JSON)</label>
          <UiTextarea
            size="sm"
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            className="min-h-[160px] flex-1 font-mono text-xs"
          />
        </div>

        {formError ? <p className="shrink-0 text-xs font-semibold text-rose-600">{formError}</p> : null}

        {output ? (
          <div className="flex min-h-0 flex-1 flex-col gap-[2px]">
            <div className="flex shrink-0 items-center gap-2 ps-[4px]">
              {requestFailed ? (
                <AlertCircle className="h-4 w-4 text-rose-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <label className="text-xs font-semibold text-slate-600">
                Response
                {httpStatus !== null ? ` (HTTP ${httpStatus})` : ''}
              </label>
            </div>
            <UiTextarea
              size="sm"
              readOnly
              value={outputText}
              className="min-h-[180px] flex-1 font-mono text-xs"
            />
          </div>
        ) : null}
      </div>
    </CreateEditModalShell>
  );
};
