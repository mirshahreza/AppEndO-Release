import path from 'node:path';
import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import { createEdgeDbQueryExecutor } from '../../../../../core/database/EdgeDbRouter';
import type { EdgeDbQueryFn } from '../../../server-function.service';
import { getDataSourcesFromSettings } from '../../../../db/dataSourcesStore';
import { EdgeModelService } from '../../../data-api/edgeModelService';
import { EdgeApiService } from '../../../data-api/edgeApiService';
import { DataApiExecutor } from '../../../data-api/dataApiExecutor';

export const DATA_API_LIST_MODELS_TOOL_NAME = 'data_api_list_models';
export const DATA_API_DESCRIBE_MODEL_TOOL_NAME = 'data_api_describe_model';
export const DATA_API_LIST_DEFINITIONS_TOOL_NAME = 'data_api_list_definitions';
export const DATA_API_DESCRIBE_DEFINITION_TOOL_NAME = 'data_api_describe_definition';
export const DATA_API_TRY_TOOL_NAME = 'data_api_try';

export type DataApiToolsDeps = {
  getSettingsPath: () => string;
  edgeDbQuery: EdgeDbQueryFn;
};

const createServices = (deps: DataApiToolsDeps) => {
  const getDataSources = () => getDataSourcesFromSettings(deps.getSettingsPath());
  const edgeModelService = new EdgeModelService({
    settingsPath: deps.getSettingsPath(),
    edgeDbQuery: deps.edgeDbQuery,
    getDataSources,
  });
  const edgeApiService = new EdgeApiService(new DataApiExecutor({ getDataSources }));
  return { edgeModelService, edgeApiService };
};

export const createDefaultDataApiToolsDeps = (): DataApiToolsDeps => {
  const settingsPath = path.join(process.cwd(), 'settings.json');
  return {
    getSettingsPath: () => settingsPath,
    edgeDbQuery: createEdgeDbQueryExecutor({
      getDataSources: () => getDataSourcesFromSettings(settingsPath),
    }),
  };
};

export const createDataApiTools = (deps: DataApiToolsDeps): NativeToolDefinition[] => {
  const { edgeModelService, edgeApiService } = createServices(deps);

  return [
    {
      name: DATA_API_LIST_MODELS_TOOL_NAME,
      description: 'List Edge models imported into Data API Studio.',
      group: 'data',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const items = edgeModelService.listModels();
        return {
          ok: true,
          summary: `Listed ${items.length} Edge model(s).`,
          data: { items, totalCount: items.length },
        };
      },
    },
    {
      name: DATA_API_DESCRIBE_MODEL_TOOL_NAME,
      description: 'Describe a single Edge model by id, including columns and associations.',
      group: 'data',
      parameters: {
        type: 'object',
        properties: {
          modelId: { type: 'string', description: 'Edge model id.' },
        },
        required: ['modelId'],
      },
      execute: async (args) => {
        const modelId = typeof args.modelId === 'string' ? args.modelId.trim() : '';
        if (!modelId) {
          return { ok: false, summary: 'modelId is required.', error: 'missing_model_id' };
        }
        const model = edgeModelService.getModel(modelId);
        if (!model) {
          return { ok: false, summary: `Edge model "${modelId}" was not found.`, error: 'model_not_found' };
        }
        return {
          ok: true,
          summary: `Described Edge model "${model.labels.title}".`,
          data: model,
        };
      },
    },
    {
      name: DATA_API_LIST_DEFINITIONS_TOOL_NAME,
      description: 'List Data API definitions (published and draft).',
      group: 'data',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const items = edgeApiService.listDefinitions();
        return {
          ok: true,
          summary: `Listed ${items.length} Data API definition(s).`,
          data: { items, totalCount: items.length },
        };
      },
    },
    {
      name: DATA_API_DESCRIBE_DEFINITION_TOOL_NAME,
      description: 'Describe a Data API definition by id, including operations and runtime settings.',
      group: 'data',
      parameters: {
        type: 'object',
        properties: {
          definitionId: { type: 'string', description: 'Edge API definition id.' },
        },
        required: ['definitionId'],
      },
      execute: async (args) => {
        const definitionId = typeof args.definitionId === 'string' ? args.definitionId.trim() : '';
        if (!definitionId) {
          return { ok: false, summary: 'definitionId is required.', error: 'missing_definition_id' };
        }
        const definition = edgeApiService.getDefinition(definitionId);
        if (!definition) {
          return {
            ok: false,
            summary: `Data API definition "${definitionId}" was not found.`,
            error: 'definition_not_found',
          };
        }
        return {
          ok: true,
          summary: `Described Data API "${definition.label}".`,
          data: definition,
        };
      },
    },
    {
      name: DATA_API_TRY_TOOL_NAME,
      description: 'Execute a Data API definition in playground mode (admin try endpoint semantics).',
      group: 'data',
      parameters: {
        type: 'object',
        properties: {
          definitionId: { type: 'string' },
          method: { type: 'string', description: 'HTTP method, e.g. GET.' },
          path: { type: 'string', description: 'Request path to match an enabled operation.' },
        },
        required: ['definitionId', 'method', 'path'],
      },
      execute: async (args) => {
        const definitionId = typeof args.definitionId === 'string' ? args.definitionId.trim() : '';
        const method = typeof args.method === 'string' ? args.method.trim() : 'GET';
        const requestPath = typeof args.path === 'string' ? args.path.trim() : '';
        if (!definitionId || !requestPath) {
          return {
            ok: false,
            summary: 'definitionId and path are required.',
            error: 'missing_try_input',
          };
        }

        try {
          const result = await edgeApiService.tryDefinition(definitionId, {
            method,
            path: requestPath,
            params: args.params && typeof args.params === 'object'
              ? args.params as Record<string, string>
              : undefined,
            query: args.query && typeof args.query === 'object'
              ? args.query as Record<string, unknown>
              : undefined,
            body: args.body,
          });
          return {
            ok: true,
            summary: `Executed ${method} ${requestPath} on definition ${definitionId}.`,
            data: result,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Data API try failed.';
          return { ok: false, summary: message, error: 'data_api_try_failed' };
        }
      },
    },
  ];
};
