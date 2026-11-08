import fs from 'fs';
import vm from 'vm';
import { transpileSandboxSource } from '../../../services/package-runtime/sandboxTranspile';
import type { ActionExecutionResult, ActionExecutor, ActionExecutorContext } from './types';
import type { JsonValue } from '../awm/types';

const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

/**
 * p-99/WFT-1 — the ONE native executor shared by every package-contributed workflow Action.
 * A package never gets its code `require()`d into the trusted server process (the same boundary
 * `packageInstallHookRuntime.service.ts`/`packageApiRuntime.service.ts` already enforce for
 * install hooks and package API handlers): the script is read from the package's already-extracted
 * runtime file, transpiled, and run inside a fresh `vm` context with a bounded timeout. The
 * package's default export — `async (ctx: {config, input}) => output` — receives only plain JSON
 * config/input, no Prisma, no internal engine access, no `require` (deliberately narrower than the
 * package-API sandbox's `createDeveloperLibraryRequire`, since a V1 workflow Action's honest scope
 * is pure data transforms, not external I/O — see the p-99 plan for why the live dispatch-engine
 * wiring itself is deferred, not just this).
 *
 * `context.cancellationSignal` is NOT wired into the vm sandbox — `vm.Script`'s `timeout` option is
 * the only cancellation primitive available here, so `executionTimeoutMs` is the sole bound. This
 * is a documented V1 scope boundary, not a silent gap.
 */
export function createPackageWorkflowActionExecutor(
  packageId: string,
  scriptRuntimePath: string,
  executionTimeoutMs: number,
): ActionExecutor {
  return {
    async execute(_context: ActionExecutorContext, config: JsonValue, input: JsonValue): Promise<ActionExecutionResult> {
      let source: string;
      try {
        source = fs.readFileSync(scriptRuntimePath, 'utf8');
      } catch {
        return {
          status: 'FAILED',
          errorCode: 'WF_PACKAGE_ACTION_SCRIPT_MISSING',
          errorClass: 'RUNTIME',
          safeMessage: `Package "${packageId}"'s workflow action script is missing from the runtime.`,
        };
      }

      let compiledCode: string;
      try {
        compiledCode = await transpileSandboxSource(source, scriptRuntimePath);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Invalid workflow action script.';
        return { status: 'FAILED', errorCode: 'WF_PACKAGE_ACTION_COMPILE_ERROR', errorClass: 'RUNTIME', safeMessage: message };
      }

      const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, executionTimeoutMs));
      const wrappedCode = `(async () => {
        ${compiledCode}
        const __action = module.exports?.default ?? module.exports;
        if (typeof __action !== 'function') {
          throw new Error('Package workflow action must export a default async function.');
        }
        return await __action({ config, input });
      })()`;

      const moduleRef = { exports: {} as Record<string, unknown> };
      const sandboxEnv = { module: moduleRef, exports: moduleRef.exports, config, input };

      try {
        const script = new vm.Script(wrappedCode, { filename: `package-workflow-action-${packageId}.js` });
        const context = vm.createContext(sandboxEnv);
        const output = await (script.runInContext(context, { timeout: timeoutMs }) as Promise<JsonValue>);
        return { status: 'SUCCEEDED', output: output ?? null };
      } catch (error: unknown) {
        // Errors thrown inside the vm sandbox belong to a separate realm — duck-type on `.message`.
        const message = typeof (error as { message?: unknown })?.message === 'string'
          ? (error as { message: string }).message
          : String(error);
        return { status: 'FAILED', errorCode: 'WF_PACKAGE_ACTION_RUNTIME_ERROR', errorClass: 'RUNTIME', safeMessage: message };
      }
    },
  };
}
