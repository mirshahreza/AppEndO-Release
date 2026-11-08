import type { DesignerResponseMapping } from './types';

/**
 * How a Designer Data Source obtains rows.
 * Missing / undefined ≡ `'internal-api'` (backward compatible with all existing drafts).
 */
export type DesignerConnectorType =
  | 'internal-api'
  | 'rest-external'
  | 'graphql'
  | 'static-file';

export type DesignerConnectorAuth =
  | { kind: 'none' }
  | { kind: 'bearer'; token: string }
  | { kind: 'api-key-header'; headerName: string; token: string };

/** GraphQL operation attached to a DataSource (overrides connector default when set). */
export type DataSourceGraphqlConfig = {
  query: string;
  /** Variable name → store-path or literal string. */
  variables?: Record<string, string>;
};

/** Static file reference on a DataSource (overrides connector default when set). */
export type DataSourceStaticFileConfig = {
  /** Relative path under the connector's files dir, or absolute workspace-relative path. */
  path: string;
  format?: 'json' | 'csv';
};

/**
 * Workspace-level connector definition (Asset Manager analogue).
 * Secrets stay server-side; clients receive redacted summaries.
 */
export type WorkspaceDataConnector = {
  id: string;
  name: string;
  connectorType: Exclude<DesignerConnectorType, 'internal-api'>;
  /** Absolute http(s) base URL for rest-external / graphql. */
  baseUrl?: string;
  /** Non-secret request headers. */
  headers?: Record<string, string>;
  auth?: DesignerConnectorAuth;
  /** Default path suffix under baseUrl for rest-external list fetches. */
  defaultPath?: string;
  /** GraphQL HTTP path (default `/graphql`). */
  graphqlPath?: string;
  /** Default GraphQL document when DataSource does not override. */
  graphqlQuery?: string;
  /** Default static file path for static-file connectors. */
  staticFilePath?: string;
  staticFileFormat?: 'json' | 'csv';
  /**
   * Mapping applied to the **remote / file** payload before the proxy returns
   * the normalized `{ data, total }` envelope.
   */
  responseMapping?: DesignerResponseMapping;
  createdAt: string;
  updatedAt: string;
};

/** Client-safe view (auth tokens redacted). */
export type WorkspaceDataConnectorSummary = Omit<WorkspaceDataConnector, 'auth'> & {
  authKind: DesignerConnectorAuth['kind'];
  hasAuthToken: boolean;
};

/** Normalized adapter / proxy result — same shape for every connector type. */
export type DesignerConnectorQueryResult = {
  data: unknown;
  total?: number;
};

export const DEFAULT_DESIGNER_CONNECTOR_TYPE: DesignerConnectorType = 'internal-api';

export const resolveDesignerConnectorType = (
  value: DesignerConnectorType | string | undefined | null,
): DesignerConnectorType => {
  if (
    value === 'rest-external'
    || value === 'graphql'
    || value === 'static-file'
    || value === 'internal-api'
  ) {
    return value;
  }
  return DEFAULT_DESIGNER_CONNECTOR_TYPE;
};

export const isExternalDesignerConnectorType = (
  value: DesignerConnectorType | string | undefined | null,
): value is Exclude<DesignerConnectorType, 'internal-api'> => {
  const resolved = resolveDesignerConnectorType(value);
  return resolved !== 'internal-api';
};

export const DESIGNER_CONNECTORS_API_BASE = '/api/component-designer/connectors';

/**
 * Build the same-origin proxy URL used as `DataSourceDefinition.endpoint` for
 * non-internal connectors so Preview / Export keep using `useDataFetch` (GET).
 */
export const buildDesignerConnectorQueryEndpoint = (
  connectorId: string,
  options: {
    path?: string;
    op?: 'list' | 'detail';
    primaryKeyValue?: string;
  } = {},
): string => {
  const id = connectorId.trim();
  if (!id) {
    return '';
  }

  const params = new URLSearchParams();
  const path = options.path?.trim();
  if (path) {
    params.set('path', path);
  }
  if (options.op === 'detail') {
    params.set('op', 'detail');
  }
  const pk = options.primaryKeyValue?.trim();
  if (pk) {
    params.set('id', pk);
  }

  const qs = params.toString();
  return `${DESIGNER_CONNECTORS_API_BASE}/${encodeURIComponent(id)}/query${qs ? `?${qs}` : ''}`;
};
