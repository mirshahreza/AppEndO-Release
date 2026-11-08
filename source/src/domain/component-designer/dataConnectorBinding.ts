import {
  buildDesignerConnectorQueryEndpoint,
  type WorkspaceDataConnectorSummary,
} from './dataConnectorTypes';
import type { DataSourceDefinition } from './types';

export type BuildDataSourceFromConnectorOptions = {
  existingId?: string;
  name?: string;
  fields?: string[];
  primaryKey?: string;
  /** Path suffix for rest-external (becomes `?path=` on the proxy endpoint). */
  path?: string;
  graphqlQuery?: string;
  staticFilePath?: string;
  staticFileFormat?: 'json' | 'csv';
};

/**
 * Create a document DataSource that points at the workspace connector proxy.
 * Client-side `responseMapping` is always the normalized `{ data, total }` envelope;
 * remote-shape mapping lives on the workspace connector and is applied server-side.
 */
export const buildDataSourceFromConnector = (
  connector: Pick<WorkspaceDataConnectorSummary, 'id' | 'name' | 'connectorType'>,
  options: BuildDataSourceFromConnectorOptions = {},
): DataSourceDefinition => {
  const id = options.existingId?.trim()
    || `ds_${connector.id}_${Date.now().toString(36)}`;
  const path = options.path?.trim();
  const endpoint = buildDesignerConnectorQueryEndpoint(connector.id, { path });

  return {
    id,
    name: options.name?.trim() || connector.name,
    endpoint,
    fields: options.fields ?? [],
    primaryKey: options.primaryKey?.trim() || 'id',
    kind: 'collection',
    connectorType: connector.connectorType,
    connectorRef: connector.id,
    responseMapping: { arrayPath: 'data', totalPath: 'total' },
    graphql: options.graphqlQuery?.trim()
      ? { query: options.graphqlQuery.trim() }
      : undefined,
    staticFile: options.staticFilePath?.trim()
      ? {
        path: options.staticFilePath.trim(),
        format: options.staticFileFormat,
      }
      : undefined,
    operations: {
      list: {
        method: 'GET',
        endpoint,
      },
    },
  };
};
