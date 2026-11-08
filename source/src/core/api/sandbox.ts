import { cacheManager } from '../cache/CacheManager';
import { compileSandboxSource } from './sandboxCompileCache';
import { runSandboxInWorkerPool, type SandboxWorkerRequest } from './sandboxWorkerPool';
import { buildEdgeResponseCacheKey } from '../../shared/lib/cacheKeyFormat';
import path from 'node:path';
import { PACKAGE_STORAGE_ROOT } from '../packages/PackageFileStore';
import {
  clampMemoryLimitMb,
  clampTimeoutMs,
  normalizeRuntimeVersion,
  normalizeServerFunctionLanguage,
  type ServerFunctionLanguage,
  type ServerFunctionRuntimeVersion,
} from '../../shared/server-functions/runtimeConfig';

type EdgeCacheOptions = {
  enabled?: boolean;
  requestMethod?: string;
  ttlMs?: number;
  byParam?: boolean;
  byUser?: boolean;
  keyNamespace?: string;
  actorId?: string;
  requestParams?: unknown;
  requestQuery?: unknown;
};

type CachedEdgeResponse = {
  statusCode: number;
  body: unknown;
  contentType: 'json' | 'send';
};

type ExecuteEdgeOptions = {
  timeoutMs?: unknown;
  memoryLimit?: unknown;
  runtimeVersion?: unknown;
  language?: unknown;
  dbContext?: { dataSourceId?: string; dataSourceName?: string; database?: string };
  dbQuery?: (
    operation: string | Record<string, unknown>,
    params?: unknown[],
    context?: { dataSourceId?: string; dataSourceName?: string; database?: string },
  ) => Promise<{
    data: unknown[];
    count: number;
    source?: { id: string; name: string; type: string };
  }>;
  /** p-68 WHOOK Part B — bridges `workflow.start()`/`workflow.startAndWait()` inside the sandbox to the real engine. See `sandboxWorkerPool.ts`'s `workflowStart` message. */
  startWorkflow?: (
    workflowName: string,
    input: unknown,
    options: { await: boolean },
  ) => Promise<unknown>;
  /** PDK-8 — bridges `connectors.call()` inside the sandbox to an admin-configured HTTP Connection. See `sandboxWorkerPool.ts`'s `httpConnectorCall` message. */
  callHttpConnector?: (
    connectionName: string,
    operationId: string,
    params: { pathParams?: Record<string, string>; query?: Record<string, string>; body?: unknown },
  ) => Promise<unknown>;
  cache?: EdgeCacheOptions;
  sessionUserId?: number;
  sessionContextLoader?: (userId: number) => Promise<{
    serverContext: Record<string, unknown>;
    clientContext: Record<string, unknown>;
  }>;
  authRoles?: string[];
  actorEmail?: string;
};

const normalizeTtlSeconds = (ttlMs: unknown) => {
  const raw = Number(ttlMs);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 180;
  }
  return Math.max(1, Math.floor(raw / 1000));
};

const compileSource = (
  source: string,
  language: ServerFunctionLanguage,
  runtimeVersion: ServerFunctionRuntimeVersion,
) => compileSandboxSource(source, language, runtimeVersion);

const runSandboxInWorker = (
  workerRequest: SandboxWorkerRequest,
  memoryLimitMb: number,
  dbQuery?: ExecuteEdgeOptions['dbQuery'],
  startWorkflow?: ExecuteEdgeOptions['startWorkflow'],
  callHttpConnector?: ExecuteEdgeOptions['callHttpConnector'],
) => runSandboxInWorkerPool(workerRequest, memoryLimitMb, dbQuery, startWorkflow, callHttpConnector);

export async function executeServerFunction(code: string, req: any, res: any, options: ExecuteEdgeOptions = {}) {
  const timeoutMs = clampTimeoutMs(options.timeoutMs);
  const memoryLimitMb = clampMemoryLimitMb(options.memoryLimit);
  const language = normalizeServerFunctionLanguage(options.language);
  const runtimeVersion = normalizeRuntimeVersion(options.runtimeVersion);

  const cacheOptions = options.cache || {};
  const effectiveMethod = String(cacheOptions.requestMethod || req.method || '').toUpperCase();
  const shouldUseCache = Boolean(cacheOptions.enabled && effectiveMethod === 'GET');
  const cacheKey = shouldUseCache ? buildEdgeResponseCacheKey(cacheOptions) : '';
  const cacheTtlSeconds = normalizeTtlSeconds(cacheOptions.ttlMs);

  if (shouldUseCache) {
    const cachedResponse = await cacheManager.get<CachedEdgeResponse>(cacheKey);
    if (cachedResponse) {
      if (cachedResponse.contentType === 'send') {
        res.status(cachedResponse.statusCode).send(cachedResponse.body);
        return;
      }
      res.status(cachedResponse.statusCode).json(cachedResponse.body);
      return;
    }
  }

  let compiledCode = '';
  try {
    compiledCode = await compileSource(code, language, runtimeVersion);
  } catch (error: any) {
    res.status(400).json({
      error: `Compile error: ${error?.message || 'Invalid source code'}`,
    });
    return;
  }

  const sandboxHeaders = { ...req.headers };
  for (const key of Object.keys(sandboxHeaders)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === 'cookie' || normalizedKey === 'authorization') {
      delete sandboxHeaders[key];
    }
  }

  let sessionContext: { serverContext: Record<string, unknown>; clientContext: Record<string, unknown> } | null = null;
  if (options.sessionUserId && options.sessionContextLoader) {
    try {
      sessionContext = await options.sessionContextLoader(options.sessionUserId);
    } catch (error: any) {
      console.error('[Server Function] Failed to load session context:', error?.message || error);
    }
  }

  const workerRequest: SandboxWorkerRequest = {
    compiledCode,
    timeoutMs,
    sandboxEnvData: {
      req: {
        body: req.body,
        query: req.query,
        params: req.params,
        method: req.method,
        headers: sandboxHeaders,
        auth: {
          ...(options.sessionUserId != null && Number.isFinite(options.sessionUserId)
            ? { userId: options.sessionUserId }
            : {}),
          ...(options.actorEmail?.trim()
            ? { email: options.actorEmail.trim() }
            : {}),
          roles: Array.isArray(options.authRoles)
            ? options.authRoles.filter((role): role is string => typeof role === 'string')
            : [],
        },
      },
      sessionContext,
      dbContext: options.dbContext,
      libsRoot: path.join(process.cwd(), PACKAGE_STORAGE_ROOT, 'libs'),
    },
  };

  try {
    const workerResult = await runSandboxInWorker(workerRequest, memoryLimitMb, options.dbQuery, options.startWorkflow, options.callHttpConnector);

    if (workerResult.error) {
      if (!res.headersSent) {
        res.status(500).json({ error: workerResult.error });
      }
      return;
    }

    if (workerResult.responseCaptured) {
      if (workerResult.responseContentType === 'send') {
        res.status(workerResult.responseStatusCode).send(workerResult.responseBody);
      } else {
        res.status(workerResult.responseStatusCode).json(workerResult.responseBody);
      }
    } else if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: workerResult.error || 'Server function did not produce a response.',
      });
    }

    if (
      shouldUseCache
      && workerResult.responseCaptured
      && workerResult.responseStatusCode >= 200
      && workerResult.responseStatusCode < 300
    ) {
      await cacheManager.set<CachedEdgeResponse>(cacheKey, {
        statusCode: workerResult.responseStatusCode,
        body: workerResult.responseBody,
        contentType: workerResult.responseContentType,
      }, cacheTtlSeconds);
    }
  } catch (error: any) {
    if (!res.headersSent) {
      const message = error?.message || 'Error occurred in server function';
      const isMemoryFailure = /Array buffer allocation failed|JavaScript heap out of memory|Worker exited|resource limits/i.test(message);
      res.status(500).json({
        error: isMemoryFailure
          ? `Memory limit exceeded (${memoryLimitMb}MB)`
          : message,
      });
    }
  }
}
