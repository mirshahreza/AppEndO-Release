import type { Request, Response } from 'express';
import type { ManagedFunctionExecutionRecord } from '../services/server-function.service';
import { DataApiExecutor } from '../services/data-api/dataApiExecutor';
import type { StoredDataSource } from '../db/dataSourcesStore';
import { getEdgeApiDefinitionById } from '../services/data-api/edgeApiStore';
import {
  finalizeDataApiRuntime,
  prepareDataApiRuntime,
} from '../services/data-api/dataApiRuntimePolicy';
import { configureDataApiPublishedRuntime } from '../services/data-api/dataApiPublishedRuntime';
import { hasAdminRole, normalizeAuthRoles } from './auth.middleware';
import { applyImpersonationForRequest } from './impersonation';

type ExecuteDataApiOptions = {
  getDataSources: () => StoredDataSource[];
};

const parseMetadataRecord = (
  record: ManagedFunctionExecutionRecord,
): Record<string, unknown> | null => {
  const raw = record.metadataJson ?? record.metadata_json;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const createDataApiExecutorRunner = (
  options: ExecuteDataApiOptions,
) => {
  configureDataApiPublishedRuntime(options.getDataSources);
  const executor = new DataApiExecutor({
    getDataSources: options.getDataSources,
  });

  return async (
    req: Request,
    res: Response,
    record: ManagedFunctionExecutionRecord,
    params: Record<string, string>,
  ): Promise<void> => {
    applyImpersonationForRequest(req);

    const metadata = parseMetadataRecord(record);
    const definitionId = String(metadata?.edgeApiDefinitionId || '').trim();
    const operationId = String(metadata?.edgeApiOperationId || '').trim() || undefined;

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

    const runtimeContext = await prepareDataApiRuntime(req, res, definition, record);
    if (!runtimeContext) {
      return;
    }

    try {
      const result = await executor.execute({
        edgeApiDefinitionId: definitionId,
        operationId,
        params,
        query: req.query as Record<string, unknown>,
        body: req.body,
        actorUserId: req.auth?.userId,
        actorEmail: req.auth?.email,
        actorRoles: normalizeAuthRoles(req),
        actorIsAdmin: hasAdminRole(req),
        req,
      });
      res.json(result);
      await finalizeDataApiRuntime(req, res, runtimeContext, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Data API execution failed.';
      const status = message === 'Record not found.' ? 404 : 500;
      res.status(status).json({ success: false, error: message });
    }
  };
};

export const isDataApiManagedFunction = (
  record: ManagedFunctionExecutionRecord,
): boolean => (
  record.engineType === 'DATA_API' || record.engine_type === 'DATA_API'
);
