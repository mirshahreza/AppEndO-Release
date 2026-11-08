import React from 'react';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Loader2,
  Play,
  TerminalSquare,
} from 'lucide-react';
import { AppButton, WorkspaceHorizontalSplitHandle, type WorkspaceHorizontalSplitHandleProps } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { isDataApiEngine } from '../../../shared/api/contracts/server-functions/dataApiRuntime';
import { selectLiveOutputTraceLogs } from '../lib/liveOutputTraceLogs';
import type { ServerFunctionItem, EdgeLogEntry } from '../types';
import { MonacoEditorPanel } from './MonacoEditorPanel';

export type TestConsolePanelProps = {
  isLargeScreen: boolean;
  payloadWidth: number;
  payloadHeight: number;
  column3Ref: React.RefObject<HTMLDivElement | null>;
  activeFn: ServerFunctionItem | null;
  testPayloadValue: string;
  onTestPayloadChange: (value: string) => void;
  isRunning: boolean;
  output: Record<string, unknown> | null;
  logs: EdgeLogEntry[];
  handleRun: () => void;
  payloadHeightSplitHandleProps: WorkspaceHorizontalSplitHandleProps;
};

export const TestConsolePanel: React.FC<TestConsolePanelProps> = ({
  isLargeScreen,
  payloadWidth,
  payloadHeight,
  column3Ref,
  activeFn,
  testPayloadValue,
  onTestPayloadChange,
  isRunning,
  output,
  logs = [],
  handleRun,
  payloadHeightSplitHandleProps,
}) => {
  const [localPayload, setLocalPayload] = React.useState(testPayloadValue);

  React.useEffect(() => {
    setLocalPayload(testPayloadValue);
  }, [testPayloadValue, activeFn?.id, activeFn?.method, activeFn?.code]);

  const outputStatusCode = typeof output?._httpStatus === 'number'
    ? output._httpStatus
    : (typeof output?.status === 'number' ? output.status : null);
  const outputHasError = Boolean(output?.error)
    || output?.success === false
    || (outputStatusCode !== null && (outputStatusCode < 200 || outputStatusCode >= 300));
  const outputBody = React.useMemo(() => {
    if (!output) {
      return null;
    }
    const { _httpStatus, status, statusText, ...rest } = output;
    return Object.keys(rest).length > 0 ? rest : output;
  }, [output]);

  const canExecute = Boolean(activeFn?.code?.trim());
  const usesDataApiExecutor = isDataApiEngine(activeFn?.engineType);

  const idleOutputMessage = usesDataApiExecutor
    ? 'Waiting for Data API response... Click "Execute" to call the published route.'
    : 'Wait VM response... Click "Execute" to run the selected route.';
  const traceLogs = selectLiveOutputTraceLogs(logs);

  return (
    <div
      ref={column3Ref}
      data-testid="server-functions-test-console"
      className="flex h-full min-h-0 w-full shrink-0 flex-col border-t border-t-slate-200 bg-slate-50/25 xl:border-t-0"
      style={{ width: isLargeScreen ? `${payloadWidth}px` : '100%' }}
    >
      <div
        className="flex flex-col border-b border-slate-200/80 shrink-0"
        style={{ height: isLargeScreen ? `${payloadHeight}px` : 'auto', minHeight: '100px' }}
      >
        <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-[9px]">
          <div className="flex min-h-8 min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-[2px] font-sans text-xs font-semibold text-slate-500 select-none">
              <span className="flex min-w-0 items-center gap-1.5 uppercase tracking-wider">
                <Box className="w-4 h-4 shrink-0 text-slate-400" />
                <span>Request Payload</span>
              </span>
              {activeFn ? (
                <span
                  className="truncate ps-[22px] font-mono text-[9px] font-semibold tracking-normal text-slate-600"
                  title={`${activeFn.method} ${activeFn.path}`}
                >
                  {activeFn.method}
                  {' '}
                  {activeFn.path}
                </span>
              ) : null}
            </div>

            <AppButton
              type="button"
              intent="primary"
              size="sm"
              className="shrink-0 normal-case tracking-normal"
              disabled={isRunning || !canExecute}
              aria-label="Execute"
              title={canExecute ? 'Execute' : 'Save source before executing'}
              onClick={handleRun}
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Execute
            </AppButton>
          </div>
        </div>

        <MonacoEditorPanel
          defaultLanguage="json"
          language="json"
          value={localPayload}
          onChange={(val) => {
            const nextValue = val || '';
            setLocalPayload(nextValue);
            onTestPayloadChange(nextValue);
          }}
          options={{
            fontSize: 11,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            minimap: { enabled: false },
            lineNumbers: 'off',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 8, bottom: 8 },
            wordWrap: 'on',
            domReadOnly: false,
            readOnly: false,
          }}
        />
      </div>

      <WorkspaceHorizontalSplitHandle
        {...payloadHeightSplitHandleProps}
        title="Drag vertically to adjust Request Payload height"
      />

      <div className="flex-grow flex-1 flex flex-col bg-white text-slate-700 min-h-[140px] overflow-hidden">
        <div className="p-3 px-4 bg-slate-100/30 border-b border-slate-200/60 flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider shrink-0 select-none">
          <span className="flex items-center gap-1.5 font-sans">
            <TerminalSquare className="w-4 h-4 text-primary-500" /> Active Live Output
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 text-[9.5px]">MONITOR</span>
          </span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-700 bg-slate-50/40">
          {!output && traceLogs.length === 0 ? (
            <div className="text-slate-400 flex items-center h-full justify-center text-center px-4 font-mono select-none">
              {idleOutputMessage}
            </div>
          ) : (
            <div className="flex flex-col gap-3 animate-fade-in font-mono">
              {outputHasError ? (
                <>
                  <div className="flex items-center gap-1.5 text-red-600 pb-2 border-b border-slate-200/60">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Status {outputStatusCode ?? '—'}
                      {output?.error ? ` — ${String(output.error)}` : ' — Request failed'}
                    </span>
                  </div>
                  <pre className="text-slate-800 whitespace-pre-wrap break-all">
                    {JSON.stringify(outputBody, null, 2)}
                  </pre>
                </>
              ) : output ? (
                <>
                  <div className="flex items-center gap-1.5 text-emerald-600 pb-2 border-b border-slate-200/60">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Status {outputStatusCode ?? 200} OK — Execution completed
                    </span>
                  </div>
                  <pre className="text-slate-800 whitespace-pre-wrap break-all">
                    {JSON.stringify(outputBody, null, 2)}
                  </pre>
                </>
              ) : null}
              {traceLogs.length > 0 ? (
                <div className={cn('space-y-1 font-mono text-[10px] text-slate-600', output ? 'border-t border-slate-200/60 pt-3' : '')}>
                  {traceLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4">
                      <span className="text-slate-400 leading-normal shrink-0">{log.time}</span>
                      <span
                        className={cn(
                          'font-semibold',
                          log.type === 'success' ? 'text-emerald-600' : log.type === 'warn' ? 'text-red-500' : 'text-cyan-600',
                        )}
                      >
                        {log.msg}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
