import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { EdgeModelService } from '../services/data-api/edgeModelService';
import type { EdgeApiService } from '../services/data-api/edgeApiService';
import type { EdgeModelDatasheetService } from '../services/data-api/edgeModelDatasheet.service';
import { isHttpError } from '../errors/HttpError';
import { buildDataApiServerFunctionExport } from '../services/data-api/dataApiExport';
import {
  importEdgeModelInputSchema,
  normalizeQuerySurfaceBindingDocument,
  upsertEdgeModelStudioMetaInputSchema,
  type EdgeModelDefinition,
} from '../../shared/api/contracts/data-api';
import { buildClientQuerySurfaceManifest } from '../domain/data-api/querySurfaceRuntime';
import { resolveEdgeModelIdForListEndpoint } from '../domain/data-api/resolveEdgeModelIdForListEndpoint';
import { getEdgeModelStudioMeta } from '../services/data-api/edgeModelStudioMetaStore';
import {
  getQuerySurfaceBinding,
  getQuerySurfaceBindingOrDefault,
  saveQuerySurfaceBinding,
} from '../services/query-surface/querySurfaceBindingStore';

const sendError = (res: Response, status: number, message: string) => {
  res.status(status).json({ success: false, error: message });
};

const sendDatasheetError = (res: Response, error: unknown, fallback: string) => {
  if (isHttpError(error)) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...error.body,
    });
    return;
  }
  sendError(res, 400, error instanceof Error ? error.message : fallback);
};

const formatRouteError = (error: unknown, fallback: string): string => {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    if (!first) {
      return 'Invalid request.';
    }
    const path = first.path.length > 0 ? first.path.join('.') : 'body';
    return `${path}: ${first.message}`;
  }
  return error instanceof Error ? error.message : fallback;
};

export class DataApiController {
  constructor(
    private readonly edgeModelService: EdgeModelService,
    private readonly edgeApiService: EdgeApiService,
    private readonly datasheetService: EdgeModelDatasheetService,
  ) {}

  listModels = (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: this.edgeModelService.listModels(),
      count: this.edgeModelService.listModels().length,
    });
  };

  importModel = async (req: Request, res: Response) => {
    try {
      const parsed = importEdgeModelInputSchema.parse(req.body);
      const model = await this.edgeModelService.importModel(parsed);
      res.status(201).json({ success: true, data: model });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import Edge model.';
      sendError(res, 400, message);
    }
  };

  getModel = (req: Request, res: Response) => {
    const model = this.edgeModelService.getModel(req.params.id);
    if (!model) {
      sendError(res, 404, 'Edge model not found.');
      return;
    }
    res.json({ success: true, data: model });
  };

  queryDatasheet = async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
      const sql = typeof body.sql === 'string'
        ? body.sql
        : (typeof req.query.sql === 'string' ? req.query.sql : '');
      const data = await this.datasheetService.query(req.params.id, { sql });
      res.json({ success: true, data });
    } catch (error) {
      sendDatasheetError(res, error, 'Failed to load datasheet.');
    }
  };

  commitDatasheetRow = async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
      const data = await this.datasheetService.commitRow(req.params.id, body);
      res.json({ success: true, data });
    } catch (error) {
      sendDatasheetError(res, error, 'Failed to save row.');
    }
  };

  deleteDatasheetRow = async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
      await this.datasheetService.deleteRow(req.params.id, body);
      res.json({ success: true, data: { ok: true } });
    } catch (error) {
      sendDatasheetError(res, error, 'Failed to delete row.');
    }
  };

  patchModel = async (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {};
      const studioMetaInput = body.studioMeta !== undefined
        ? upsertEdgeModelStudioMetaInputSchema.parse((() => {
          const raw = body.studioMeta as Record<string, unknown>;
          // Ignore retired model-level studio notes if an older client still sends them.
          const { notes: _retiredNotes, ...rest } = raw;
          return rest;
        })())
        : undefined;

      const modelPatch: Partial<{
        labels: EdgeModelDefinition['labels'];
        columns: EdgeModelDefinition['columns'];
        associations: EdgeModelDefinition['associations'];
        readOnly: boolean;
      }> = {};
      if (body.labels !== undefined) {
        const labels = { ...(body.labels as Record<string, unknown>) };
        delete labels.description;
        modelPatch.labels = labels as EdgeModelDefinition['labels'];
      }
      if (body.columns !== undefined) {
        modelPatch.columns = body.columns as EdgeModelDefinition['columns'];
      }
      if (body.associations !== undefined) {
        modelPatch.associations = body.associations as EdgeModelDefinition['associations'];
      }
      if (body.readOnly !== undefined) {
        modelPatch.readOnly = Boolean(body.readOnly);
      }

      const hasModelPatch = Object.keys(modelPatch).length > 0;
      let model = hasModelPatch
        ? await this.edgeModelService.updateModel(req.params.id, modelPatch)
        : this.edgeModelService.getModel(req.params.id);

      if (!model) {
        sendError(res, 404, 'Edge model not found.');
        return;
      }

      if (studioMetaInput) {
        this.edgeModelService.upsertStudioMeta(req.params.id, studioMetaInput);
      }

      res.json({ success: true, data: model });
    } catch (error) {
      sendError(res, 400, formatRouteError(error, 'Failed to update Edge model.'));
    }
  };

  deleteModel = (req: Request, res: Response) => {
    try {
      this.edgeModelService.deleteModel(req.params.id);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete Edge model.';
      sendError(res, 400, message);
    }
  };

  refreshModel = async (req: Request, res: Response) => {
    try {
      const model = await this.edgeModelService.refreshModel(req.params.id);
      res.json({ success: true, data: model });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh Edge model.';
      sendError(res, 400, message);
    }
  };

  getModelStudioMeta = (req: Request, res: Response) => {
    try {
      const meta = this.edgeModelService.getStudioMeta(req.params.id);
      res.json({ success: true, data: meta });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load studio metadata.';
      sendError(res, 404, message);
    }
  };

  upsertModelStudioMeta = (req: Request, res: Response) => {
    try {
      const parsed = upsertEdgeModelStudioMetaInputSchema.parse(req.body || {});
      const meta = this.edgeModelService.upsertStudioMeta(req.params.id, parsed);
      res.json({ success: true, data: meta });
    } catch (error) {
      sendError(res, 400, formatRouteError(error, 'Failed to save studio metadata.'));
    }
  };

  getModelQuerySurfaceRuntime = (req: Request, res: Response) => {
    try {
      const model = this.edgeModelService.getModel(req.params.id);
      if (!model) {
        sendError(res, 404, 'Edge model not found.');
        return;
      }
      const meta = getEdgeModelStudioMeta(model.id);
      const binding = getQuerySurfaceBindingOrDefault(model.id);
      const roles = (req.auth?.roles ?? []).map((role) => String(role).toUpperCase());
      const isAdmin = Boolean(req.auth?.isAdmin) || roles.includes('ADMIN');
      const allowed = new Set(model.columns.map((column) => column.field));
      const manifest = buildClientQuerySurfaceManifest(
        model,
        meta,
        binding,
        {
          userId: req.auth?.userId != null ? Number(req.auth.userId) : undefined,
          roleIds: roles,
          isAdmin,
        },
        allowed,
      );
      res.json({ success: true, data: manifest });
    } catch (error) {
      sendError(res, 400, formatRouteError(error, 'Failed to load query surface runtime.'));
    }
  };

  getModelQuerySurfaceBinding = (req: Request, res: Response) => {
    const binding = getQuerySurfaceBinding(req.params.id) ?? getQuerySurfaceBindingOrDefault(req.params.id);
    res.json({ success: true, data: { item: binding } });
  };

  resolveEdgeModelForListEndpoint = (req: Request, res: Response) => {
    const endpoint = typeof req.query.endpoint === 'string' ? req.query.endpoint : '';
    const edgeModelId = resolveEdgeModelIdForListEndpoint(endpoint);
    if (!edgeModelId) {
      sendError(res, 404, 'No Edge model found for this list endpoint.');
      return;
    }
    res.json({ success: true, data: { edgeModelId } });
  };

  saveModelQuerySurfaceBinding = (req: Request, res: Response) => {
    try {
      const normalized = normalizeQuerySurfaceBindingDocument({
        ...(req.body as Record<string, unknown>),
        edgeModelId: req.params.id,
      });
      if (!normalized.ok) {
        sendError(res, 400, normalized.message);
        return;
      }
      const saved = saveQuerySurfaceBinding(normalized.binding);
      res.json({ success: true, data: { item: saved } });
    } catch (error) {
      sendError(res, 400, formatRouteError(error, 'Failed to save query surface binding.'));
    }
  };

  explorerCatalog = async (req: Request, res: Response) => {
    try {
      const dataSourceId = String(req.query.dataSourceId || '').trim();
      if (!dataSourceId) {
        sendError(res, 400, 'dataSourceId is required.');
        return;
      }
      const tables = await this.edgeModelService.listCatalogObjects(dataSourceId, 'TABLE');
      const views = await this.edgeModelService.listCatalogObjects(dataSourceId, 'VIEW');
      res.json({
        success: true,
        data: {
          tables,
          views,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load schema catalog.';
      sendError(res, 400, message);
    }
  };

  listDefinitions = (_req: Request, res: Response) => {
    const data = this.edgeApiService.listDefinitions();
    res.json({ success: true, data, count: data.length });
  };

  createDefinition = (req: Request, res: Response) => {
    try {
      const definition = this.edgeApiService.createDefinition(req.body);
      res.status(201).json({ success: true, data: definition });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create Edge API definition.';
      sendError(res, 400, message);
    }
  };

  getDefinition = (req: Request, res: Response) => {
    const definition = this.edgeApiService.getDefinition(req.params.id);
    if (!definition) {
      sendError(res, 404, 'Edge API definition not found.');
      return;
    }
    res.json({ success: true, data: definition });
  };

  patchDefinition = (req: Request, res: Response) => {
    try {
      const definition = this.edgeApiService.updateDefinition(req.params.id, req.body);
      res.json({ success: true, data: definition });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update Edge API definition.';
      sendError(res, 400, message);
    }
  };

  publishDefinition = (req: Request, res: Response) => {
    try {
      const definition = this.edgeApiService.publish(req.params.id);
      res.json({ success: true, data: definition });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish Edge API definition.';
      sendError(res, 400, message);
    }
  };

  unpublishDefinition = (req: Request, res: Response) => {
    try {
      const definition = this.edgeApiService.unpublish(req.params.id);
      res.json({ success: true, data: definition });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unpublish Edge API definition.';
      sendError(res, 400, message);
    }
  };

  tryDefinition = async (req: Request, res: Response) => {
    try {
      const result = await this.edgeApiService.tryDefinition(req.params.id, {
        method: String(req.body?.method || 'GET'),
        path: String(req.body?.path || ''),
        params: req.body?.params,
        query: req.body?.query,
        body: req.body?.body,
        testActorUserId: req.body?.testActorUserId,
        testActorRoles: Array.isArray(req.body?.testActorRoles) ? req.body.testActorRoles.map(String) : undefined,
        testActorIsAdmin: Boolean(req.body?.testActorIsAdmin),
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Data API try execution failed.';
      sendError(res, 400, message);
    }
  };

  deleteDefinition = (req: Request, res: Response) => {
    try {
      this.edgeApiService.delete(req.params.id);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete Edge API definition.';
      sendError(res, 400, message);
    }
  };

  exportDefinition = (req: Request, res: Response) => {
    try {
      const definition = this.edgeApiService.getDefinition(req.params.id);
      if (!definition) {
        sendError(res, 404, 'Edge API definition not found.');
        return;
      }
      const operationId = typeof req.body?.operationId === 'string' ? req.body.operationId : undefined;
      const payload = buildDataApiServerFunctionExport(definition, operationId);
      res.json({ success: true, data: payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export Data API definition.';
      sendError(res, 400, message);
    }
  };
}
