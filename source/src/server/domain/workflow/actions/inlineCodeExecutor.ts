import { compileSandboxSource } from '../../../../core/api/sandboxCompileCache';
import { runSandboxInWorkerPool } from '../../../../core/api/sandboxWorkerPool';
import {
  clampMemoryLimitMb,
  clampTimeoutMs,
  normalizeRuntimeVersion,
  normalizeServerFunctionLanguage,
} from '../../../../shared/server-functions/runtimeConfig';
import type { ActionExecutionResult, ActionExecutorContext } from './types';
import type { JsonValue } from '../awm/types';

/**
 * Runs an ACTION node's `INLINE_CODE` implementation (see `awm/types.ts`'s `InlineCodeActionRef`
 * doc comment) — the exact same sandbox (`compileSandboxSource` + `runSandboxInWorkerPool`) Server
 * Functions use, reused directly rather than re-implemented, so a workflow author writes code with
 * the identical `req`/`res` convention they'd already know from Server Functions (Monaco editor
 * globals in `MonacoEditorPanel.tsx`'s `setupEdgeCodeEditorOnMount`): `req.body` is this node's
 * evaluated `input` mapping, `req.query` is this node's evaluated `config` mapping, and the code
 * must call `res.json(...)`/`res.send(...)` to produce the node's output.
 *
 * No Server Function row is created or referenced — `code` lives only in the AWM node definition.
 */
export async function executeInlineCodeAction(
  actionRef: { code: string; language?: 'ts' | 'js'; timeoutMs?: number },
  context: ActionExecutorContext,
  config: JsonValue,
  input: JsonValue,
): Promise<ActionExecutionResult> {
  const language = normalizeServerFunctionLanguage(actionRef.language ?? 'ts');
  const runtimeVersion = normalizeRuntimeVersion(undefined);
  const timeoutMs = clampTimeoutMs(actionRef.timeoutMs);
  const memoryLimitMb = clampMemoryLimitMb(undefined);

  let compiledCode: string;
  try {
    compiledCode = await compileSandboxSource(actionRef.code, language, runtimeVersion);
  } catch (error) {
    return {
      status: 'FAILED',
      errorCode: 'INLINE_CODE_COMPILE_ERROR',
      errorClass: 'VALIDATION',
      safeMessage: error instanceof Error ? error.message : 'Invalid inline code.',
    };
  }

  let workerResult;
  try {
    workerResult = await runSandboxInWorkerPool(
      {
        compiledCode,
        timeoutMs,
        sandboxEnvData: {
          req: {
            body: input,
            query: config,
            params: {},
            method: 'POST',
            headers: {},
            auth: {
              userId: context.effectiveIdentity.id != null ? Number(context.effectiveIdentity.id) : undefined,
            },
          },
          sessionContext: null,
        },
      },
      memoryLimitMb,
    );
  } catch (error) {
    if (context.cancellationSignal.aborted) {
      return { status: 'FAILED', errorCode: 'INLINE_CODE_CANCELLED', errorClass: 'CANCELLED', safeMessage: 'Inline code execution was cancelled.' };
    }
    return {
      status: 'FAILED',
      errorCode: 'INLINE_CODE_EXECUTION_ERROR',
      errorClass: 'EXECUTION_ERROR',
      safeMessage: error instanceof Error ? error.message : 'Inline code execution failed.',
    };
  }

  if (workerResult.error) {
    return { status: 'FAILED', errorCode: 'INLINE_CODE_EXECUTION_ERROR', errorClass: 'EXECUTION_ERROR', safeMessage: workerResult.error };
  }
  if (!workerResult.responseCaptured) {
    return { status: 'FAILED', errorCode: 'INLINE_CODE_NO_RESPONSE', errorClass: 'EXECUTION_ERROR', safeMessage: 'Inline code did not call res.json(...) / res.send(...).' };
  }
  if (workerResult.responseStatusCode < 200 || workerResult.responseStatusCode >= 300) {
    const safeMessage = typeof workerResult.responseBody === 'string' ? workerResult.responseBody : JSON.stringify(workerResult.responseBody);
    return { status: 'FAILED', errorCode: 'INLINE_CODE_FAILED_RESPONSE', errorClass: 'EXECUTION_ERROR', safeMessage: safeMessage || `Inline code responded with status ${workerResult.responseStatusCode}.` };
  }
  context.writeTraceMetadata({ type: 'INLINE_CODE_RESULT', payload: { statusCode: workerResult.responseStatusCode } });
  return { status: 'SUCCEEDED', output: workerResult.responseBody as JsonValue };
}
