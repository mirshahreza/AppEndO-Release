import type { DesignerConnectorQueryResult } from '../../../../domain/component-designer/dataConnectorTypes';
import type { DesignerResponseMapping } from '../../../../domain/component-designer/types';
import type { WorkspaceDataConnector } from '../../../../domain/component-designer/dataConnectorTypes';
import { HttpError } from '../../../errors/HttpError';
import { getWorkspaceDataConnector } from './connectorsStore';
import { runGraphqlAdapter } from './graphqlAdapter';
import { runRestExternalAdapter } from './restExternalAdapter';
import { runStaticFileAdapter } from './staticFileAdapter';

export type ConnectorQueryRequest = {
  connectorId: string;
  path?: string;
  method?: string;
  query?: Record<string, string>;
  graphqlQuery?: string;
  graphqlVariables?: Record<string, unknown>;
  staticFilePath?: string;
  staticFileFormat?: 'json' | 'csv';
  responseMapping?: DesignerResponseMapping;
  op?: 'list' | 'detail';
  primaryKey?: string;
  id?: string;
};

export const executeWorkspaceConnectorQuery = async (
  request: ConnectorQueryRequest,
): Promise<DesignerConnectorQueryResult> => {
  const connector = getWorkspaceDataConnector(request.connectorId);
  if (!connector) {
    throw new HttpError(404, `Connector "${request.connectorId}" was not found.`);
  }

  switch (connector.connectorType) {
    case 'rest-external':
      return runRestExternalAdapter({
        connector,
        path: request.path,
        method: request.method,
        query: request.query,
        responseMapping: request.responseMapping,
        op: request.op,
        primaryKey: request.primaryKey,
        id: request.id,
      });
    case 'graphql':
      return runGraphqlAdapter({
        connector,
        query: request.graphqlQuery,
        variables: request.graphqlVariables,
        responseMapping: request.responseMapping,
        op: request.op,
        primaryKey: request.primaryKey,
        id: request.id,
      });
    case 'static-file':
      return runStaticFileAdapter({
        connector,
        filePath: request.staticFilePath,
        format: request.staticFileFormat,
        responseMapping: request.responseMapping,
        op: request.op,
        primaryKey: request.primaryKey,
        id: request.id,
      });
    default:
      throw new HttpError(400, `Unsupported connector type.`);
  }
};

export type { WorkspaceDataConnector };
