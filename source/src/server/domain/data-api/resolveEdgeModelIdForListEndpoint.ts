import { listEdgeApiDefinitions } from '../../services/data-api/edgeApiStore';

const normalizePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const withoutQuery = trimmed.split('?')[0] ?? trimmed;
  return withoutQuery.replace(/\/+$/, '') || '/';
};

/**
 * Resolve edge model id from a designer data-source list endpoint (REST path).
 */
export const resolveEdgeModelIdForListEndpoint = (endpoint: string): string | null => {
  const target = normalizePath(endpoint);
  if (!target) {
    return null;
  }

  for (const definition of listEdgeApiDefinitions()) {
    const base = normalizePath(definition.basePath);
    if (target === base || target.startsWith(`${base}/`)) {
      return definition.edgeModelId;
    }
    for (const operation of definition.operations) {
      if (operation.kind !== 'list') {
        continue;
      }
      const pattern = normalizePath(operation.pathPattern ?? '');
      if (pattern && (target === pattern || target.startsWith(`${pattern}/`))) {
        return definition.edgeModelId;
      }
    }
  }

  return null;
};
