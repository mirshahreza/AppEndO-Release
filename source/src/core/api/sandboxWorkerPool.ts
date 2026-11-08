import os from 'node:os';
import { Worker } from 'worker_threads';

export type SandboxWorkerRequest = {
  compiledCode: string;
  timeoutMs: number;
  sandboxEnvData: {
    req: {
      body: unknown;
      query: unknown;
      params: unknown;
      method: string;
      headers: Record<string, unknown>;
      auth: {
        userId?: number;
        email?: string;
        roles: string[];
      };
    };
    sessionContext: {
      serverContext: Record<string, unknown>;
      clientContext: Record<string, unknown>;
    } | null;
    dbContext?: { dataSourceId?: string; dataSourceName?: string; database?: string };
    libsRoot?: string;
  };
};

type SandboxWorkerDbQueryMessage = {
  type: 'dbQuery';
  jobId: number;
  id: number;
  operation: string | Record<string, unknown>;
  params: unknown[];
  context?: { dataSourceId?: string; dataSourceName?: string; database?: string };
};

/**
 * p-68 WHOOK Part B — lets developer code inside a Server Function start a workflow by name
 * without leaving the sandbox. Same postMessage round-trip shape as `dbQuery`, but deliberately
 * NOT the same fallback behavior: `dbQuery` mocks a result when no callback is wired (dev/test
 * convenience); `workflowStart` has no such mock — a missing callback is a real misconfiguration
 * and surfaces as a rejected promise inside the sandbox (see `dispatchRun`'s handler below).
 */
type SandboxWorkerWorkflowStartMessage = {
  type: 'workflowStart';
  jobId: number;
  id: number;
  workflowName: string;
  input: unknown;
  await: boolean;
};

/**
 * PDK-8 — lets developer code inside a Server Function call an admin-configured HTTP Connection
 * by name + operationId, without ever getting raw `fetch`/`require('http')` inside the sandbox.
 * Same postMessage round-trip shape as `workflowStart`: no dev-mode mock, a missing callback is a
 * real misconfiguration surfaced as a rejected promise (see `dispatchRun`'s handler below).
 */
type SandboxWorkerHttpConnectorCallMessage = {
  type: 'httpConnectorCall';
  jobId: number;
  id: number;
  connectionName: string;
  operationId: string;
  pathParams?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
};

type SandboxWorkerDoneMessage = {
  type: 'done';
  jobId: number;
  responseStatusCode: number;
  responseCaptured: boolean;
  responseContentType: 'json' | 'send';
  responseBody: unknown;
  error?: string;
};

type SandboxWorkerOutboundMessage = SandboxWorkerDbQueryMessage | SandboxWorkerWorkflowStartMessage | SandboxWorkerHttpConnectorCallMessage | SandboxWorkerDoneMessage;

type SandboxDbQueryFn = (
  operation: string | Record<string, unknown>,
  params?: unknown[],
  context?: { dataSourceId?: string; dataSourceName?: string; database?: string },
) => Promise<{
  data: unknown[];
  count: number;
  source?: { id: string; name: string; type: string };
}>;

/** Resolves with the started instance (when `await: true`) or `undefined` (fire-and-forget). Rejects on resolution/start failure — see `workflowTriggerService.startWorkflowByName`. */
type SandboxStartWorkflowFn = (
  workflowName: string,
  input: unknown,
  options: { await: boolean },
) => Promise<unknown>;

/** PDK-8 bridge — resolves a stored HTTP Connection by name and performs the SSRF-guarded, spec-allowlisted call. Rejects on unknown connection/operation or call failure. */
type SandboxCallHttpConnectorFn = (
  connectionName: string,
  operationId: string,
  params: { pathParams?: Record<string, string>; query?: Record<string, string>; body?: unknown },
) => Promise<unknown>;

const POOLED_SANDBOX_WORKER_SOURCE = String.raw`
const { parentPort } = require('worker_threads');
const vm = require('vm');
const nodeModule = require('module');
const nodePath = require('path');
const nodeFs = require('fs');
const { RE2 } = require('re2-wasm');
const Ajv = require('ajv').default;
const addFormats = require('ajv-formats').default;

/**
 * "util.regexMatch"/"util.validateSchema" mirror src/server/utils/safeRegex.ts and
 * jsonSchemaValidate.ts (the canonical platform primitives) but are re-implemented inline here
 * rather than imported — this whole worker source is a plain string run via
 * \`new Worker(source, { eval: true })\`, with no real file path to resolve a TS import against.
 * Keep the semantics (limits, error shapes) in sync with those two files if either changes.
 */
const SAFE_REGEX_MAX_PATTERN_LENGTH = 500;
const SAFE_REGEX_MAX_SUBJECT_LENGTH = 100000;

const toSafeRegexMatch = (m) => {
  const namedGroups = {};
  const groupsObj = m.groups || {};
  Object.keys(groupsObj).forEach((key) => {
    if (groupsObj[key] !== undefined) namedGroups[key] = groupsObj[key];
  });
  return {
    match: m[0],
    index: m.index,
    groups: Array.from(m).slice(1).map((g) => (g === undefined ? null : g)),
    namedGroups,
  };
};

const regexMatch = (pattern, text, options) => {
  options = options || {};
  if (typeof pattern !== 'string' || typeof text !== 'string') {
    return { ok: false, errorCode: 'INVALID_PATTERN', message: 'pattern and text must be strings.' };
  }
  if (pattern.length > SAFE_REGEX_MAX_PATTERN_LENGTH) {
    return { ok: false, errorCode: 'PATTERN_TOO_LONG', message: 'Pattern exceeds ' + SAFE_REGEX_MAX_PATTERN_LENGTH + ' character limit.' };
  }
  if (text.length > SAFE_REGEX_MAX_SUBJECT_LENGTH) {
    return { ok: false, errorCode: 'SUBJECT_TOO_LONG', message: 'Subject exceeds ' + SAFE_REGEX_MAX_SUBJECT_LENGTH + ' character limit.' };
  }
  const requestedFlags = String(options.flags || '').replace(/[gu]/g, '');
  const wantsGlobal = options.global === true || String(options.flags || '').indexOf('g') !== -1;
  const re2Flags = requestedFlags + 'u' + (wantsGlobal ? 'g' : '');
  let re2;
  try {
    re2 = new RE2(pattern, re2Flags);
  } catch (error) {
    return { ok: false, errorCode: 'INVALID_PATTERN', message: (error && error.message) || 'Invalid regular expression.' };
  }
  const matches = [];
  if (!wantsGlobal) {
    const m = re2.exec(text);
    if (m) matches.push(toSafeRegexMatch(m));
    return { ok: true, matched: matches.length > 0, matches };
  }
  let m;
  let guard = 0;
  while ((m = re2.exec(text)) !== null) {
    matches.push(toSafeRegexMatch(m));
    if (m[0].length === 0) re2.lastIndex += 1;
    if (++guard > SAFE_REGEX_MAX_SUBJECT_LENGTH + 1) break;
  }
  return { ok: true, matched: matches.length > 0, matches };
};

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const createSandboxRequire = (libsRoot) => {
  const root = libsRoot || nodePath.join(process.cwd(), 'packages-storage', 'libs');
  nodeFs.mkdirSync(root, { recursive: true });
  const manifestPath = nodePath.join(root, 'package.json');
  if (!nodeFs.existsSync(manifestPath)) {
    nodeFs.writeFileSync(manifestPath, JSON.stringify({
      name: 'appendo-developer-libraries',
      private: true,
      dependencies: {},
    }));
  }
  return nodeModule.createRequire(manifestPath);
};

const validateSchema = (schema, value) => {
  if (schema === null || typeof schema !== 'object' || Object.keys(schema).length === 0) {
    return { valid: true };
  }
  let validateFn;
  try {
    validateFn = ajv.compile(schema);
  } catch (error) {
    return { valid: false, errors: ['SCHEMA_INVALID: ' + ((error && error.message) || 'could not compile schema')] };
  }
  const ok = validateFn(value);
  if (ok) return { valid: true };
  return { valid: false, errors: (validateFn.errors || []).map((e) => ((e.instancePath || '/') + ' ' + (e.message || 'is invalid')).trim()) };
};

// vm.Script compiles source into reusable bytecode independent of any vm.createContext() — only
// the *run* is context-bound, so the same compiled Script can safely run in a fresh context per
// job. Without this cache, a warm worker re-parsed/re-compiled the identical wrapped source on
// every single invocation of the same function. Keyed by the exact wrapped-code string (not a
// hash) since that's already an exact, collision-free identity check; bounded so a worker that
// happens to run many distinct functions doesn't grow this unboundedly.
const scriptCache = new Map();
const SCRIPT_CACHE_MAX_ENTRIES = 50;

const getOrCompileScript = (wrappedCode) => {
  const cached = scriptCache.get(wrappedCode);
  if (cached) return cached;
  const script = new vm.Script(wrappedCode, { filename: 'server-function.js' });
  scriptCache.set(wrappedCode, script);
  if (scriptCache.size > SCRIPT_CACHE_MAX_ENTRIES) {
    const oldestKey = scriptCache.keys().next().value;
    scriptCache.delete(oldestKey);
  }
  return script;
};

const createSessionContextSliceAccessor = (slice) => ({
  get: (key) => slice?.[key],
});

const createEdgeSessionContextAccessor = (context) => ({
  get: (key) => {
    if (!context) return undefined;
    if (Object.prototype.hasOwnProperty.call(context.serverContext, key)) {
      return context.serverContext[key];
    }
    return context.clientContext[key];
  },
  server: createSessionContextSliceAccessor(context?.serverContext),
  client: createSessionContextSliceAccessor(context?.clientContext),
});

const executeJob = async (message) => {
  const { jobId, compiledCode, timeoutMs, sandboxEnvData } = message;
  let responseStatusCode = 200;
  let responseCaptured = false;
  let responseContentType = 'json';
  let responseBody;
  let nextQueryId = 0;
  const pendingQueries = new Map();

  const onDbQueryResult = (resultMessage) => {
    if (!resultMessage || resultMessage.type !== 'dbQueryResult' || resultMessage.jobId !== jobId) return;
    const pending = pendingQueries.get(resultMessage.id);
    if (!pending) return;
    pendingQueries.delete(resultMessage.id);
    if (resultMessage.error) {
      pending.reject(new Error(resultMessage.error));
      return;
    }
    pending.resolve(resultMessage.result);
  };

  parentPort.on('message', onDbQueryResult);

  const dbMock = {
    query: async (operation, params = [], context) => {
      const mergedContext = {
        ...(sandboxEnvData.dbContext || {}),
        ...(context || {}),
      };
      const queryId = ++nextQueryId;
      return new Promise((resolve, reject) => {
        pendingQueries.set(queryId, { resolve, reject });
        parentPort.postMessage({
          type: 'dbQuery',
          jobId,
          id: queryId,
          operation,
          params,
          context: mergedContext,
        });
      });
    },
  };

  const WORKFLOW_START_TIMEOUT_MS = 15000;
  let nextWorkflowStartId = 0;
  const pendingWorkflowStarts = new Map();

  const onWorkflowStartResult = (resultMessage) => {
    if (!resultMessage || resultMessage.type !== 'workflowStartResult' || resultMessage.jobId !== jobId) return;
    const pending = pendingWorkflowStarts.get(resultMessage.id);
    if (!pending) return;
    pendingWorkflowStarts.delete(resultMessage.id);
    clearTimeout(pending.timer);
    if (resultMessage.error) {
      pending.reject(new Error(resultMessage.error));
      return;
    }
    pending.resolve(resultMessage.result);
  };

  parentPort.on('message', onWorkflowStartResult);

  const startWorkflow = (workflowName, input, awaitResult) => {
    const id = ++nextWorkflowStartId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingWorkflowStarts.delete(id);
        reject(new Error('workflow.' + (awaitResult ? 'startAndWait' : 'start') + '() timed out waiting for a response.'));
      }, WORKFLOW_START_TIMEOUT_MS);
      pendingWorkflowStarts.set(id, { resolve, reject, timer });
      parentPort.postMessage({
        type: 'workflowStart',
        jobId,
        id,
        workflowName,
        input,
        await: awaitResult,
      });
    });
  };

  const workflowBridge = {
    start: (workflowName, input) => startWorkflow(workflowName, input, false),
    startAndWait: (workflowName, input) => startWorkflow(workflowName, input, true),
  };

  let nextHttpConnectorCallId = 0;
  const pendingHttpConnectorCalls = new Map();

  const onHttpConnectorCallResult = (resultMessage) => {
    if (!resultMessage || resultMessage.type !== 'httpConnectorCallResult' || resultMessage.jobId !== jobId) return;
    const pending = pendingHttpConnectorCalls.get(resultMessage.id);
    if (!pending) return;
    pendingHttpConnectorCalls.delete(resultMessage.id);
    clearTimeout(pending.timer);
    if (resultMessage.error) {
      pending.reject(new Error(resultMessage.error));
      return;
    }
    pending.resolve(resultMessage.result);
  };

  parentPort.on('message', onHttpConnectorCallResult);

  const HTTP_CONNECTOR_CALL_TIMEOUT_MS = 20000;

  const connectorsBridge = {
    call: (connectionName, operationId, params) => {
      const id = ++nextHttpConnectorCallId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingHttpConnectorCalls.delete(id);
          reject(new Error('connectors.call() timed out waiting for a response.'));
        }, HTTP_CONNECTOR_CALL_TIMEOUT_MS);
        pendingHttpConnectorCalls.set(id, { resolve, reject, timer });
        parentPort.postMessage({
          type: 'httpConnectorCall',
          jobId,
          id,
          connectionName,
          operationId,
          pathParams: params && params.pathParams,
          query: params && params.query,
          body: params && params.body,
        });
      });
    },
  };

  const sandboxEnv = {
    req: sandboxEnvData.req,
    res: {
      json: (data) => {
        responseCaptured = true;
        responseContentType = 'json';
        responseBody = data;
        responseStatusCode = Number(responseStatusCode) || 200;
        return data;
      },
      status: (statusCode) => {
        responseStatusCode = Number(statusCode) || 200;
        return sandboxEnv.res;
      },
      send: (data) => {
        responseCaptured = true;
        responseContentType = 'send';
        responseBody = data;
        responseStatusCode = Number(responseStatusCode) || 200;
        return data;
      },
      headersSent: () => responseCaptured,
    },
    db: dbMock,
    workflow: workflowBridge,
    connectors: connectorsBridge,
    ctx: createEdgeSessionContextAccessor(sandboxEnvData.sessionContext),
    console: {
      log: (...args) => console.log('[Server Function]', ...args),
      error: (...args) => console.error('[Edge Error]', ...args),
    },
    util: {
      regexMatch: regexMatch,
      validateSchema: validateSchema,
    },
    require: createSandboxRequire(sandboxEnvData.libsRoot),
  };

  try {
    let executableCode = compiledCode
      .replace(/\s*\(async\s*\(\)\s*=>\s*\{\s*await handler\(\);\s*\}\)\(\);?\s*$/g, '')
      .replace(/\s*void handler\(\);?\s*$/g, '')
      .replace(/\s*await handler\(\);?\s*$/g, '');
    const wrappedCode = /\bhandler\b/.test(executableCode)
      ? '(async () => {\n' + executableCode + '\n  await handler();\n})()'
      : '(async () => {\n' + executableCode + '\n})()';
    const script = getOrCompileScript(wrappedCode);
    const runContext = vm.createContext(sandboxEnv);
    const scriptResult = script.runInContext(runContext, { timeout: timeoutMs });
    if (scriptResult && typeof scriptResult.then === 'function') {
      await scriptResult;
    }
    parentPort.postMessage({
      type: 'done',
      jobId,
      responseStatusCode,
      responseCaptured,
      responseContentType,
      responseBody,
    });
  } catch (error) {
    parentPort.postMessage({
      type: 'done',
      jobId,
      responseStatusCode,
      responseCaptured,
      responseContentType,
      responseBody,
      error: error?.message || 'Error occurred in server function',
    });
  } finally {
    parentPort.off('message', onDbQueryResult);
    parentPort.off('message', onWorkflowStartResult);
    for (const pending of pendingWorkflowStarts.values()) {
      clearTimeout(pending.timer);
    }
    pendingWorkflowStarts.clear();
    parentPort.off('message', onHttpConnectorCallResult);
    for (const pending of pendingHttpConnectorCalls.values()) {
      clearTimeout(pending.timer);
    }
    pendingHttpConnectorCalls.clear();
  }
};

parentPort.on('message', (message) => {
  if (!message || message.type !== 'run') return;
  executeJob(message).catch((error) => {
    parentPort.postMessage({
      type: 'done',
      jobId: message.jobId,
      responseStatusCode: 500,
      responseCaptured: false,
      responseContentType: 'json',
      responseBody: undefined,
      error: error?.message || 'Worker failed to execute server function',
    });
  });
});

parentPort.postMessage({ type: 'ready' });
`;

type PoolWorker = {
  worker: Worker;
  busy: boolean;
  memoryLimitMb: number;
};

type PendingRun = {
  workerRequest: SandboxWorkerRequest;
  memoryLimitMb: number;
  dbQuery?: SandboxDbQueryFn;
  startWorkflow?: SandboxStartWorkflowFn;
  callHttpConnector?: SandboxCallHttpConnectorFn;
  resolve: (value: Extract<SandboxWorkerDoneMessage, { type: 'done' }>) => void;
  reject: (error: Error) => void;
};

const MAX_POOL_WORKERS = Math.max(2, Math.min(os.cpus().length, 8));
const POOL_MEMORY_LIMIT_MB = 256;

let nextJobId = 1;
let poolWorkers: PoolWorker[] = [];
const runQueue: PendingRun[] = [];

const waitForWorkerReady = (worker: Worker): Promise<void> => new Promise((resolve, reject) => {
  const onMessage = (message: { type?: string }) => {
    if (message?.type === 'ready') {
      cleanup();
      resolve();
    }
  };
  const onError = (error: Error) => {
    cleanup();
    reject(error);
  };
  const cleanup = () => {
    worker.off('message', onMessage);
    worker.off('error', onError);
  };
  worker.on('message', onMessage);
  worker.on('error', onError);
});

const createPoolWorker = async (memoryLimitMb: number): Promise<PoolWorker> => {
  const worker = new Worker(POOLED_SANDBOX_WORKER_SOURCE, {
    eval: true,
    resourceLimits: {
      maxOldGenerationSizeMb: memoryLimitMb,
    },
  });
  await waitForWorkerReady(worker);
  return { worker, busy: false, memoryLimitMb };
};

const findIdleWorker = (): PoolWorker | undefined => (
  poolWorkers.find((entry) => !entry.busy)
);

const removePoolWorker = (target: PoolWorker): void => {
  poolWorkers = poolWorkers.filter((entry) => entry !== target);
};

const dispatchRun = async (
  pooledWorker: PoolWorker,
  pending: PendingRun,
): Promise<void> => {
  const jobId = nextJobId++;
  pooledWorker.busy = true;

  let settled = false;
  const releaseWorker = async (handler: () => void, retireWorker = false) => {
    if (settled) {
      return;
    }
    settled = true;
    pooledWorker.worker.removeAllListeners('message');
    pooledWorker.worker.removeAllListeners('error');
    pooledWorker.worker.removeAllListeners('exit');
    if (retireWorker) {
      removePoolWorker(pooledWorker);
      try {
        await pooledWorker.worker.terminate();
      } catch {
        // ignore terminate errors
      }
    } else {
      pooledWorker.busy = false;
    }
    handler();
    void drainRunQueue();
  };

  const onMessage = async (message: SandboxWorkerOutboundMessage) => {
    if (message.jobId !== jobId) {
      return;
    }

    if (message.type === 'dbQuery') {
      try {
        if (!pending.dbQuery) {
          pooledWorker.worker.postMessage({
            type: 'dbQueryResult',
            jobId,
            id: message.id,
            result: { data: [{ mock: 'data', active: true }], count: 1 },
          });
          return;
        }
        const result = await pending.dbQuery(message.operation, message.params, message.context);
        pooledWorker.worker.postMessage({
          type: 'dbQueryResult',
          jobId,
          id: message.id,
          result,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Database query failed.';
        pooledWorker.worker.postMessage({
          type: 'dbQueryResult',
          jobId,
          id: message.id,
          error: errorMessage,
        });
      }
      return;
    }

    if (message.type === 'workflowStart') {
      if (!pending.startWorkflow) {
        pooledWorker.worker.postMessage({
          type: 'workflowStartResult',
          jobId,
          id: message.id,
          error: 'No workflow-trigger capability is wired into this sandbox execution — workflow.start()/startAndWait() is unavailable here.',
        });
        return;
      }
      try {
        const result = await pending.startWorkflow(message.workflowName, message.input, { await: message.await });
        pooledWorker.worker.postMessage({
          type: 'workflowStartResult',
          jobId,
          id: message.id,
          result,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start workflow.';
        pooledWorker.worker.postMessage({
          type: 'workflowStartResult',
          jobId,
          id: message.id,
          error: errorMessage,
        });
      }
      return;
    }

    if (message.type === 'httpConnectorCall') {
      if (!pending.callHttpConnector) {
        pooledWorker.worker.postMessage({
          type: 'httpConnectorCallResult',
          jobId,
          id: message.id,
          error: 'No HTTP Connections capability is wired into this sandbox execution — connectors.call() is unavailable here.',
        });
        return;
      }
      try {
        const result = await pending.callHttpConnector(message.connectionName, message.operationId, {
          pathParams: message.pathParams,
          query: message.query,
          body: message.body,
        });
        pooledWorker.worker.postMessage({
          type: 'httpConnectorCallResult',
          jobId,
          id: message.id,
          result,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'HTTP connection call failed.';
        pooledWorker.worker.postMessage({
          type: 'httpConnectorCallResult',
          jobId,
          id: message.id,
          error: errorMessage,
        });
      }
      return;
    }

    if (message.type === 'done') {
      const retireWorker = Boolean(
        message.error
        && /heap|resource limits|Array buffer allocation failed|Worker exited/i.test(message.error),
      );
      await releaseWorker(() => {
        if (message.error && !message.responseCaptured) {
          pending.reject(new Error(message.error));
          return;
        }
        pending.resolve(message);
      }, retireWorker);
    }
  };

  pooledWorker.worker.on('message', onMessage);
  pooledWorker.worker.on('error', async (error) => {
    await releaseWorker(() => {
      pending.reject(error);
    }, true);
  });
  pooledWorker.worker.on('exit', async (code) => {
    if (code === 0) {
      return;
    }
    await releaseWorker(() => {
      pending.reject(new Error(`Server function worker exited with code ${code}`));
    }, true);
  });

  pooledWorker.worker.postMessage({
    type: 'run',
    jobId,
    compiledCode: pending.workerRequest.compiledCode,
    timeoutMs: pending.workerRequest.timeoutMs,
    sandboxEnvData: pending.workerRequest.sandboxEnvData,
  });
};

const drainRunQueue = async (): Promise<void> => {
  while (runQueue.length > 0) {
    const idleWorker = findIdleWorker();
    if (!idleWorker) {
      if (poolWorkers.length < MAX_POOL_WORKERS) {
        try {
          const created = await createPoolWorker(POOL_MEMORY_LIMIT_MB);
          poolWorkers.push(created);
          const pending = runQueue.shift();
          if (pending) {
            void dispatchRun(created, pending);
          }
          continue;
        } catch {
          const pending = runQueue.shift();
          if (pending) {
            pending.reject(new Error('Failed to create sandbox worker.'));
          }
          continue;
        }
      }
      return;
    }

    const pending = runQueue.shift();
    if (!pending) {
      return;
    }
    void dispatchRun(idleWorker, pending);
  }
};

export const runSandboxInWorkerPool = async (
  workerRequest: SandboxWorkerRequest,
  memoryLimitMb: number,
  dbQuery?: SandboxDbQueryFn,
  startWorkflow?: SandboxStartWorkflowFn,
  callHttpConnector?: SandboxCallHttpConnectorFn,
): Promise<Extract<SandboxWorkerDoneMessage, { type: 'done' }>> => new Promise((resolve, reject) => {
  runQueue.push({
    workerRequest,
    memoryLimitMb,
    dbQuery,
    startWorkflow,
    callHttpConnector,
    resolve,
    reject,
  });
  void drainRunQueue();
});

export const shutdownSandboxWorkerPool = async (): Promise<void> => {
  const workers = poolWorkers;
  poolWorkers = [];
  runQueue.splice(0, runQueue.length);
  await Promise.all(workers.map(async (entry) => {
    try {
      entry.worker.postMessage({ type: 'shutdown' });
    } catch {
      // ignore shutdown post errors
    }
    try {
      await entry.worker.terminate();
    } catch {
      // ignore terminate errors
    }
  }));
};

export const retireAllSandboxWorkers = (): void => {
  void shutdownSandboxWorkerPool();
};

export const resetSandboxWorkerPoolForTests = async (): Promise<void> => {
  await shutdownSandboxWorkerPool();
};
