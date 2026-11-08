import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import { getEdgeModelById } from './edgeModelStore';

export type DataApiExportResult = {
  name: string;
  folder: string;
  method: string;
  path: string;
  language: 'ts';
  code: string;
  metadataJson: Record<string, unknown>;
  description: string;
};

const buildExportCode = (
  definition: EdgeApiDefinition,
  operationId: string,
): string => {
  const operation = definition.operations.find((item) => item.id === operationId)
    ?? definition.operations.find((item) => item.enabled);
  if (!operation) {
    throw new Error('No operation available to export.');
  }

  const model = getEdgeModelById(definition.edgeModelId);
  const modelName = model?.sequelize.modelName ?? 'EdgeModel';

  return `/**
 * Exported from Data API Studio: ${definition.label}
 * Definition: ${definition.id}
 * Operation: ${operation.id} (${operation.method} ${operation.pathPattern})
 *
 * Customize business logic below. Runtime ACL/cache/hooks remain on the published Data API route.
 */
import type { EdgeRequestContext } from '@/server/edge/types';

export default async function handler(ctx: EdgeRequestContext) {
  // Example: delegate to the published Data API route or add custom validation.
  const response = await fetch(\`${operation.pathPattern}\`, {
    method: '${operation.method}',
    headers: ctx.request.headers,
    body: ['POST', 'PUT', 'PATCH'].includes('${operation.method}') ? JSON.stringify(ctx.request.body) : undefined,
  });
  const payload = await response.json();
  return payload;
}

// Model reference: ${modelName}
`;
};

export const buildDataApiServerFunctionExport = (
  definition: EdgeApiDefinition,
  operationId?: string,
): DataApiExportResult => {
  const operation = operationId
    ? definition.operations.find((item) => item.id === operationId)
    : definition.operations.find((item) => item.enabled);
  if (!operation) {
    throw new Error('Operation not found for export.');
  }

  const exportName = `${definition.key}-${operation.kind}`;
  return {
    name: exportName,
    folder: 'data-api-exports',
    method: operation.method,
    path: operation.pathPattern,
    language: 'ts',
    code: buildExportCode(definition, operation.id),
    metadataJson: {
      origin: 'data-api-export',
      edgeApiDefinitionId: definition.id,
      edgeApiOperationId: operation.id,
      edgeModelId: definition.edgeModelId,
    },
    description: `Exported from Data API "${definition.label}".`,
  };
};
