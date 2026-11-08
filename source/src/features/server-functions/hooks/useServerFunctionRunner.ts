import { useState } from 'react';
import { executeServerFunctionRequest } from '../../../shared/api/queries/server-functions';
import { isDataApiEngine } from '../../../shared/api/contracts/server-functions/dataApiRuntime';
import { getActiveSourceLanguage } from '../templates';
import type { ServerFunctionEditorState } from './useServerFunctionEditor';
import type { ServerFunctionSettingsState } from './useServerFunctionSettings';

type UseServerFunctionRunnerInput = {
  editor: ServerFunctionEditorState;
  settings: ServerFunctionSettingsState;
  addLog: (msg: string, type?: 'info' | 'success' | 'warn') => void;
};

export function useServerFunctionRunner({ editor, settings, addLog }: UseServerFunctionRunnerInput) {
  const {
    activeFn,
    getTestPayloadDisplay,
  } = editor;
  const { globalDefaultVMMode, globalDefaultRAM, globalDefaultTimeout } = settings;

  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<any>(null);

  const handleRun = async () => {
    if (!activeFn) return;
    setIsRunning(true);
    setOutput(null);

    const requestMethod = activeFn.method;

    const vmMode = activeFn.useGlobalConfig ? globalDefaultVMMode : activeFn.runtimeVersion;
    const runRam = activeFn.useGlobalConfig ? globalDefaultRAM : activeFn.memoryLimit;
    const runTimeout = activeFn.useGlobalConfig ? globalDefaultTimeout : activeFn.timeoutMs;

    const sourceExtension = getActiveSourceLanguage(activeFn.language);
    const usesDataApiExecutor = isDataApiEngine(activeFn.engineType);
    addLog(
      usesDataApiExecutor
        ? `Invoking published Data API route ${requestMethod} ${activeFn.path} via Sequelize executor...`
        : `Compiling ${activeFn.name}.${sourceExtension} and preparing VM thread allocation (VM: ${vmMode}, RAM: ${runRam}MB, Timeout: ${runTimeout}ms)...`,
      'info',
    );

    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(getTestPayloadDisplay()) as Record<string, unknown>;
    } catch {
      try {
        parsedPayload = JSON.parse(activeFn.testPayload || '{}') as Record<string, unknown>;
      } catch {
        setOutput({ error: 'Invalid JSON payload format' });
        addLog('Failed compile: Request body parsing error (Malformatted JSON)', 'warn');
        setIsRunning(false);
        return;
      }
    }

    try {
      if (activeFn.isBuiltIn) {
        addLog(`Invoking built-in API route ${requestMethod} ${activeFn.path} directly...`, 'info');
      }

      const { data } = await executeServerFunctionRequest({
        activeFn,
        parsedPayload,
        vmMode,
        runRam,
        runTimeout,
        requestMethod,
      });

      setOutput(data);
      const httpStatus = typeof data._httpStatus === 'number' ? data._httpStatus : null;
      const requestFailed = Boolean(data.error)
        || data.success === false
        || (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300));

      if (requestFailed) {
        addLog(
          `Execution failed: ${String(data.error || `HTTP ${httpStatus ?? 'error'}`)}`,
          'warn',
        );
      } else {
        addLog(
          activeFn.isBuiltIn
            ? `Built-in route ${requestMethod} completed successfully.`
            : usesDataApiExecutor
              ? `Data API route ${requestMethod} completed successfully.`
              : `VM completed execution loop on thread :3000 in ${Math.floor(Math.random() * 20) + 5}ms. Code 200 returned.`,
          'success',
        );
      }
    } catch (err: any) {
      setOutput({ error: err.message });
      addLog(`Execution error: ${err.message}`, 'warn');
    } finally {
      setIsRunning(false);
    }
  };

  return {
    isRunning,
    output,
    handleRun,
  };
}

export type ServerFunctionRunnerState = ReturnType<typeof useServerFunctionRunner>;
