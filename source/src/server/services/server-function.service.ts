import type { Request, Response } from 'express';
import { executeServerFunction } from '../../core/api/sandbox';
import type { FunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import type { ServerFunctionHooksConfig } from '../../shared/api/contracts/server-functions/hooks';
import { fireServerFunctionHook } from './workflow/workflowHookFiring';
import { startWorkflowByName } from '../domain/workflow/engine/workflowTriggerService';
import type { JsonValue } from '../domain/workflow/awm/types';
import { HttpError } from '../errors/HttpError';
import {
  resolveServerFunctionRuntimeConfig,
  runtimeConfigInputFromManagedRecord,
} from './resolveServerFunctionRuntimeConfig';
import { DataApiExecutor } from './data-api/dataApiExecutor';
import { getEdgeApiDefinitionById } from './data-api/edgeApiStore';
import {
  finalizeDataApiRuntime,
  prepareDataApiRuntime,
} from './data-api/dataApiRuntimePolicy';
import { configureDataApiPublishedRuntime } from './data-api/dataApiPublishedRuntime';
import type { StoredDataSource } from '../db/dataSourcesStore';
import { findHttpConnectionRecordByName } from './http-connections/httpConnectionStore';
import { callHttpConnection } from './http-connections/httpConnectionExecutor';

export type EdgeDbQueryFn = (
  operation: string | Record<string, unknown>,
  params?: unknown[],
  context?: { dataSourceId?: string; dataSourceName?: string; database?: string },
) => Promise<{
  data: unknown[];
  count: number;
  source?: { id: string; name: string; type: string };
}>;

export type ManagedFunctionExecutionRecord = {
  id?: string;
  name?: string | null;
  folder?: string | null;
  engine_type?: string | null;
  engineType?: string | null;
  metadata_json?: string | Record<string, unknown> | null;
  metadataJson?: Record<string, unknown> | null;
  code?: string | null;
  timeout_ms?: number | null;
  timeoutMs?: number | null;
  language?: string | null;
  runtime_version?: string | null;
  runtimeVersion?: string | null;
  memory_limit?: number | null;
  memoryLimit?: number | null;
  use_global_config?: boolean | null;
  useGlobalConfig?: boolean | null;
  enable_logs?: boolean | null;
  enableLogs?: boolean | null;
  cache_enabled?: boolean | null;
  cacheEnabled?: boolean | null;
  cache_ttl_ms?: number | null;
  cacheTtlMs?: number | null;
  cache_by_param?: boolean | null;
  cacheByParam?: boolean | null;
  cache_by_user?: boolean | null;
  cacheByUser?: boolean | null;
  path?: string | null;
  method?: string | null;
  access_control?: FunctionAccessControl;
  accessControl?: FunctionAccessControl;
  hooks?: ServerFunctionHooksConfig;
};

export type EdgeExecuteInput = {
  code?: unknown;
  timeoutMs?: unknown;
  memoryLimit?: unknown;
  runtimeVersion?: unknown;
  language?: unknown;
  useGlobalConfig?: unknown;
  enableLogs?: unknown;
  dbContext?: unknown;
  edgeCache?: unknown;
  actorUserId?: number;
  engineType?: unknown;
  engine_type?: unknown;
  metadataJson?: unknown;
  metadata_json?: unknown;
  managedFunction?: ManagedFunctionExecutionRecord;
  functionId?: string;
  sessionContextLoader?: (userId: number) => Promise<{
    serverContext: Record<string, unknown>;
    clientContext: Record<string, unknown>;
  }>;
  authRoles?: string[];
  actorEmail?: string;
};

export type EdgeExecutePrepared = {
  code: string;
  timeoutMs: number;
  memoryLimit: number;
  runtimeVersion: 'v18.x' | 'v20.x';
  language?: unknown;
  dbContext?: {
    dataSourceId?: string;
    dataSourceName?: string;
    database?: string;
  };
  cache: {
    enabled: boolean;
    requestMethod?: string;
    ttlMs?: number;
    byParam: boolean;
    byUser: boolean;
    keyNamespace?: string;
    actorId?: string;
    requestParams?: unknown;
    requestQuery?: unknown;
  };
  dbQuery: EdgeDbQueryFn;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const parseMetadataValue = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new HttpError(500, 'metadata_json is empty.');
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const record = asRecord(parsed);
      if (!record) {
        throw new HttpError(500, 'metadata_json must be a JSON object.');
      }
      return record;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(500, 'metadata_json is not valid JSON.');
    }
  }

  const record = asRecord(raw);
  if (!record) {
    throw new HttpError(500, 'metadata_json must be a JSON object.');
  }
  return record;
};

const normalizeEngineType = (
  value: unknown,
): 'SANDBOX_JS' | 'DATA_API' => {
  if (value === 'DATA_API') {
    return 'DATA_API';
  }
  return 'SANDBOX_JS';
};

const resolveMetadataInput = (input: EdgeExecuteInput): unknown => {
  if (input.metadataJson !== undefined) {
    return input.metadataJson;
  }
  if (input.metadata_json !== undefined) {
    return input.metadata_json;
  }
  if (input.managedFunction) {
    return input.managedFunction.metadataJson ?? input.managedFunction.metadata_json;
  }
  return undefined;
};

const resolveEngineTypeInput = (input: EdgeExecuteInput): unknown => {
  if (input.engineType !== undefined || input.engine_type !== undefined) {
    return input.engineType ?? input.engine_type;
  }
  if (input.managedFunction) {
    return input.managedFunction.engineType ?? input.managedFunction.engine_type;
  }
  return undefined;
};

const resolveSandboxInput = (input: EdgeExecuteInput): EdgeExecuteInput => {
  if (!input.managedFunction) {
    return input;
  }

  const managed = input.managedFunction;
  const runtimeInput = {
    ...runtimeConfigInputFromManagedRecord(managed as unknown as Record<string, unknown>),
    timeoutMs: input.timeoutMs ?? managed.timeoutMs ?? managed.timeout_ms,
    memoryLimit: input.memoryLimit ?? managed.memoryLimit ?? managed.memory_limit,
    runtimeVersion: input.runtimeVersion ?? managed.runtimeVersion ?? managed.runtime_version,
    language: input.language ?? managed.language,
    useGlobalConfig: input.useGlobalConfig ?? managed.useGlobalConfig ?? managed.use_global_config,
    enableLogs: input.enableLogs ?? managed.enableLogs ?? managed.enable_logs,
    cacheEnabled: managed.cacheEnabled ?? managed.cache_enabled,
    cacheTtlMs: managed.cacheTtlMs ?? managed.cache_ttl_ms,
    cacheByParam: managed.cacheByParam ?? managed.cache_by_param,
    cacheByUser: managed.cacheByUser ?? managed.cache_by_user,
  };
  const resolved = resolveServerFunctionRuntimeConfig(runtimeInput);

  return {
    ...input,
    code: input.code ?? managed.code,
    timeoutMs: resolved.timeoutMs,
    memoryLimit: resolved.memoryLimit,
    runtimeVersion: resolved.runtimeVersion,
    language: resolved.language,
    enableLogs: resolved.enableLogs,
    edgeCache: input.edgeCache ?? {
      enabled: resolved.cache.enabled,
      requestMethod: managed.method || undefined,
      ttlMs: resolved.cache.ttlMs,
      byParam: resolved.cache.byParam,
      byUser: resolved.cache.byUser,
      keyNamespace: managed.path ? `${managed.method || 'GET'}:${managed.path}` : undefined,
    },
  };
};

const resolveExecuteRuntimeConfig = (input: EdgeExecuteInput) => {
  const sandboxInput = resolveSandboxInput(input);

  if (!input.managedFunction) {
    const cacheRecord = asRecord(sandboxInput.edgeCache);
    const hasExplicitRuntime = sandboxInput.timeoutMs !== undefined
      || sandboxInput.memoryLimit !== undefined
      || sandboxInput.runtimeVersion !== undefined;

    return resolveServerFunctionRuntimeConfig({
      timeoutMs: sandboxInput.timeoutMs,
      memoryLimit: sandboxInput.memoryLimit,
      runtimeVersion: sandboxInput.runtimeVersion,
      language: sandboxInput.language,
      useGlobalConfig: hasExplicitRuntime ? false : sandboxInput.useGlobalConfig,
      enableLogs: sandboxInput.enableLogs,
      cacheEnabled: cacheRecord?.enabled,
      cacheTtlMs: cacheRecord?.ttlMs,
      cacheByParam: cacheRecord?.byParam,
      cacheByUser: cacheRecord?.byUser,
    });
  }

  return resolveServerFunctionRuntimeConfig(
    runtimeConfigInputFromManagedRecord(input.managedFunction as unknown as Record<string, unknown>),
  );
};

export class ServerFunctionService {
  private readonly getDataSources?: () => StoredDataSource[];

  constructor(deps: { getDataSources?: () => StoredDataSource[] } = {}) {
    this.getDataSources = deps.getDataSources;
  }

  private ensureDataApiExecutor(): DataApiExecutor {
    if (!this.getDataSources) {
      throw new HttpError(500, 'DATA_API execution is not configured on this node.');
    }
    configureDataApiPublishedRuntime(this.getDataSources);
    return new DataApiExecutor({ getDataSources: this.getDataSources });
  }

  private buildDataApiExecutionRecord(input: EdgeExecuteInput): ManagedFunctionExecutionRecord {
    const managed = input.managedFunction;
    if (managed) {
      return managed;
    }

    return {
      id: String(input.functionId ?? ''),
      code: String(input.code ?? ''),
      engineType: 'DATA_API',
      engine_type: 'DATA_API',
      metadataJson: input.metadataJson ?? input.metadata_json,
      metadata_json: input.metadataJson ?? input.metadata_json,
      method: String((input as { method?: string }).method ?? 'GET'),
      path: String((input as { path?: string }).path ?? ''),
      timeoutMs: Number(input.timeoutMs ?? 30_000),
      timeout_ms: Number(input.timeoutMs ?? 30_000),
      cacheEnabled: Boolean((input.edgeCache as Record<string, unknown> | undefined)?.enabled),
      cache_enabled: Boolean((input.edgeCache as Record<string, unknown> | undefined)?.enabled),
      cacheTtlMs: Number((input.edgeCache as Record<string, unknown> | undefined)?.ttlMs ?? 60_000),
      cache_ttl_ms: Number((input.edgeCache as Record<string, unknown> | undefined)?.ttlMs ?? 60_000),
      cacheByParam: Boolean((input.edgeCache as Record<string, unknown> | undefined)?.byParam),
      cache_by_param: Boolean((input.edgeCache as Record<string, unknown> | undefined)?.byParam),
      cacheByUser: Boolean((input.edgeCache as Record<string, unknown> | undefined)?.byUser),
      cache_by_user: Boolean((input.edgeCache as Record<string, unknown> | undefined)?.byUser),
    };
  }

  async executeDataApi(
    req: Request,
    res: Response,
    input: EdgeExecuteInput,
  ): Promise<void> {
    const metadataRecord = parseMetadataValue(resolveMetadataInput(input) ?? {});
    const definitionId = String(metadataRecord.edgeApiDefinitionId || '').trim();
    const operationId = String(metadataRecord.edgeApiOperationId || '').trim() || undefined;

    if (!definitionId) {
      res.status(500).json({
        success: false,
        error: 'DATA_API metadata is missing edgeApiDefinitionId.',
      });
      return;
    }

    const definition = getEdgeApiDefinitionById(definitionId);
    if (!definition) {
      res.status(500).json({
        success: false,
        error: 'DATA_API definition was not found.',
      });
      return;
    }

    const record = this.buildDataApiExecutionRecord(input);
    const runtimeContext = await prepareDataApiRuntime(req, res, definition, record);
    if (!runtimeContext) {
      return;
    }

    const executor = this.ensureDataApiExecutor();
    const params = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? asRecord((req.body as Record<string, unknown>).params) ?? {}
      : {};

    try {
      const result = await executor.execute({
        edgeApiDefinitionId: definitionId,
        operationId,
        params: params as Record<string, string>,
        query: {
          ...(req.query as Record<string, unknown>),
          ...(asRecord((req.body as Record<string, unknown> | undefined)?.query) ?? {}),
        },
        body: (req.body as Record<string, unknown> | undefined)?.body ?? req.body,
        actorUserId: req.auth?.userId,
      });
      res.json(result);
      await finalizeDataApiRuntime(req, res, runtimeContext, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Data API execution failed.';
      res.status(500).json({ success: false, error: message });
    }
  }

  prepareExecute(input: EdgeExecuteInput, dbQuery: EdgeDbQueryFn): EdgeExecutePrepared {
    const sandboxInput = resolveSandboxInput(input);
    const resolved = resolveExecuteRuntimeConfig(input);
    const { code, dbContext, edgeCache, actorUserId } = sandboxInput;

    if (!code || typeof code !== 'string') {
      throw new HttpError(400, 'Code payload is required.');
    }

    const cacheRecord = edgeCache && typeof edgeCache === 'object'
      ? edgeCache as Record<string, unknown>
      : {};

    const dbRecord = dbContext && typeof dbContext === 'object'
      ? dbContext as Record<string, unknown>
      : null;

    const rawTtlMs = Number(cacheRecord.ttlMs ?? resolved.cache.ttlMs);
    const ttlMs = Number.isFinite(rawTtlMs) ? rawTtlMs : undefined;

    return {
      code,
      timeoutMs: resolved.timeoutMs,
      memoryLimit: resolved.memoryLimit,
      runtimeVersion: resolved.runtimeVersion,
      language: resolved.language,
      dbContext: dbRecord
        ? {
            dataSourceId: typeof dbRecord.dataSourceId === 'string' ? dbRecord.dataSourceId : undefined,
            dataSourceName: typeof dbRecord.dataSourceName === 'string' ? dbRecord.dataSourceName : undefined,
            database: typeof dbRecord.database === 'string' ? dbRecord.database : undefined,
          }
        : undefined,
      cache: {
        enabled: Boolean(cacheRecord.enabled ?? resolved.cache.enabled),
        requestMethod: typeof cacheRecord.requestMethod === 'string' ? cacheRecord.requestMethod : undefined,
        ttlMs,
        byParam: Boolean(cacheRecord.byParam ?? resolved.cache.byParam),
        byUser: Boolean(cacheRecord.byUser ?? resolved.cache.byUser),
        keyNamespace: typeof cacheRecord.keyNamespace === 'string' ? cacheRecord.keyNamespace : undefined,
        actorId: actorUserId ? String(actorUserId) : undefined,
        requestParams: cacheRecord.requestParams,
        requestQuery: cacheRecord.requestQuery,
      },
      dbQuery,
    };
  }

  async executeSandbox(
    req: Request,
    res: Response,
    input: EdgeExecuteInput,
    dbQuery: EdgeDbQueryFn,
  ): Promise<void> {
    const prepared = this.prepareExecute(resolveSandboxInput(input), dbQuery);

    await executeServerFunction(prepared.code, req, res, {
      timeoutMs: prepared.timeoutMs,
      memoryLimit: prepared.memoryLimit,
      runtimeVersion: prepared.runtimeVersion,
      language: prepared.language,
      cache: prepared.cache,
      dbContext: prepared.dbContext,
      dbQuery: prepared.dbQuery,
      startWorkflow: (workflowName, workflowInput, options) => startWorkflowByName(workflowName, workflowInput as JsonValue, {
        await: options.await,
        startedByType: 'SYSTEM',
        startType: 'SERVER_FUNCTION_DIRECT_CALL',
      }),
      callHttpConnector: async (connectionName, operationId, params) => {
        const connection = findHttpConnectionRecordByName(connectionName);
        if (!connection) {
          throw new Error(`No HTTP Connection named "${connectionName}" is configured.`);
        }
        return callHttpConnection(connection, { operationId, ...params });
      },
      sessionUserId: input.actorUserId,
      sessionContextLoader: input.sessionContextLoader,
      authRoles: input.authRoles,
      actorEmail: input.actorEmail,
    });
  }

  async executeManagedFunction(
    req: Request,
    res: Response,
    managedFunction: ManagedFunctionExecutionRecord,
    dbQuery: EdgeDbQueryFn,
    overrides: Omit<EdgeExecuteInput, 'managedFunction'> = {},
  ): Promise<void> {
    await this.execute(req, res, {
      ...overrides,
      managedFunction,
      functionId: overrides.functionId ?? managedFunction.id,
      code: overrides.code ?? managedFunction.code,
      engineType: overrides.engineType ?? managedFunction.engineType ?? managedFunction.engine_type,
      metadataJson: overrides.metadataJson ?? managedFunction.metadataJson ?? managedFunction.metadata_json,
    }, dbQuery);
  }

  async execute(
    req: Request,
    res: Response,
    input: EdgeExecuteInput,
    dbQuery: EdgeDbQueryFn,
  ): Promise<void> {
    const engineType = normalizeEngineType(resolveEngineTypeInput(input));
    const hooks = input.managedFunction?.hooks;

    if (hooks?.before) {
      fireServerFunctionHook(hooks.before, req.body as Record<string, unknown> | undefined);
    }

    let capturedOutput: Record<string, unknown> | undefined;
    if (hooks?.after) {
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        if (body && typeof body === 'object' && !Array.isArray(body)) {
          capturedOutput = body as Record<string, unknown>;
        }
        return originalJson(body);
      }) as Response['json'];
    }

    if (engineType === 'DATA_API') {
      await this.executeDataApi(req, res, input);
    } else {
      await this.executeSandbox(req, res, input, dbQuery);
    }

    if (hooks?.after) {
      fireServerFunctionHook(hooks.after, capturedOutput);
    }
  }
}
