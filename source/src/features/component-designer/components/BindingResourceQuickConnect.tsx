import * as React from 'react';
import { Cable, Link2, Loader2, Plus } from 'lucide-react';
import type { DataSourceDefinition, DesignerApiOperationMethod, DesignerBindingDefinitions } from '../../../domain/component-designer/types';
import { isDefaultGridTemplateFieldList } from '../../../domain/component-designer/designerDataGridColumns';
import {
  buildDataSourceFromEndpoint,
  inferResourceIdFromEndpoint,
  inferResourceNameFromEndpoint,
} from '../../../domain/component-designer/bindingResourceModel';
import { buildDataSourceFromConnector } from '../../../domain/component-designer/dataConnectorBinding';
import type { WorkspaceDataConnectorSummary } from '../../../domain/component-designer/dataConnectorTypes';
import { getDataSources } from '../../../domain/component-designer/bindingRegistry';
import { fetchEndpointFormFields, fetchEndpointResponseFields } from '../../../shared/api/queries/api-endpoint-schema';
import { fetchDesignerDataConnectors } from '../../../shared/api/queries/component-designer-connectors';
import { useAccessibleApiRoutesQuery } from '../../../shared/api/queries/my-apis';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { UiInput, UiSelect } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';
import { BindingApiEndpointPicker } from './BindingApiEndpointPicker';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

export type BindingResourceQuickConnectProps = {
  bindingDefinitions: DesignerBindingDefinitions;
  dataSourceId: string;
  quickEndpoint: string;
  onDataSourceIdChange: (value: string) => void;
  onQuickEndpointChange: (value: string) => void;
  onCreateResource?: (dataSource: DataSourceDefinition) => void;
  suggestedFields?: string[];
  /** Default HTTP method shown in the picker (e.g. grids load via GET). */
  defaultMethod?: DesignerApiOperationMethod;
  /** Restricts the route list to specific methods. */
  methodFilter?: readonly DesignerApiOperationMethod[];
  /** Whether Connect reads request fields (forms) or response row fields (grids). */
  fieldSource?: 'request' | 'response';
};

type ConnectSourceMode = 'internal-api' | 'workspace-connector';

export const BindingResourceQuickConnect: React.FC<BindingResourceQuickConnectProps> = ({
  bindingDefinitions,
  dataSourceId,
  quickEndpoint,
  onDataSourceIdChange,
  onQuickEndpointChange,
  onCreateResource,
  suggestedFields = [],
  defaultMethod = 'GET',
  methodFilter,
  fieldSource = 'request',
}) => {
  const dataSourceOptions = React.useMemo(
    () => Object.values(getDataSources(bindingDefinitions)),
    [bindingDefinitions],
  );

  const [quickMethod, setQuickMethod] = React.useState<DesignerApiOperationMethod>(defaultMethod);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [connectError, setConnectError] = React.useState<string | null>(null);
  const [sourceMode, setSourceMode] = React.useState<ConnectSourceMode>('internal-api');
  const [connectors, setConnectors] = React.useState<WorkspaceDataConnectorSummary[]>([]);
  const [connectorsLoading, setConnectorsLoading] = React.useState(false);
  const [selectedConnectorId, setSelectedConnectorId] = React.useState('');
  const [connectorPath, setConnectorPath] = React.useState('');
  const routesQuery = useAccessibleApiRoutesQuery();

  React.useEffect(() => {
    setQuickMethod(defaultMethod);
    setConnectError(null);
    setIsConnecting(false);
  }, [defaultMethod]);

  React.useEffect(() => {
    if (sourceMode !== 'workspace-connector') {
      return;
    }
    let cancelled = false;
    setConnectorsLoading(true);
    void fetchDesignerDataConnectors()
      .then((items) => {
        if (!cancelled) {
          setConnectors(items);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setConnectError((error as Error).message || 'Failed to load workspace connectors.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setConnectorsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sourceMode]);

  const normalizedQuickPath = quickEndpoint.trim().replace(/\/+$/, '').toLowerCase();
  const matchedRoute = React.useMemo(() => {
    const routes = routesQuery.data ?? [];
    if (!normalizedQuickPath) {
      return undefined;
    }
    const matches = routes.filter((route) => route.path.trim().replace(/\/+$/, '').toLowerCase() === normalizedQuickPath);
    return matches.find((route) => route.method.toUpperCase() === quickMethod) ?? matches[0];
  }, [normalizedQuickPath, quickMethod, routesQuery.data]);

  const selectedDataSource = dataSourceId ? bindingDefinitions.dataSources[dataSourceId] : undefined;
  const inferredId = inferResourceIdFromEndpoint(quickEndpoint);
  const inferredName = inferResourceNameFromEndpoint(quickEndpoint);
  const canQuickConnect = quickEndpoint.trim().length > 0 && inferredId.length > 0;
  const selectedConnector = connectors.find((item) => item.id === selectedConnectorId);
  const canConnectorConnect = Boolean(selectedConnector && onCreateResource);

  const handleQuickConnect = async () => {
    if (!canQuickConnect || !onCreateResource) {
      return;
    }

    setIsConnecting(true);
    setConnectError(null);

    try {
      const existing = inferredId ? bindingDefinitions.dataSources[inferredId] : undefined;
      const existingFields = existing?.fields ?? [];
      const hasUsableExistingFields = existingFields.length > 0
        && !(fieldSource === 'response' && isDefaultGridTemplateFieldList(existingFields));

      let resolvedFields: string[] = [];
      let schemaLookupFailed = false;

      if (matchedRoute?.id) {
        try {
          if (fieldSource === 'response') {
            const responseFields = await fetchEndpointResponseFields(
              matchedRoute.id,
              quickMethod,
              { endpointPath: quickEndpoint.trim(), refreshOpenApi: true },
            );
            if (responseFields.length > 0) {
              resolvedFields = responseFields;
            }
          } else {
            const apiFields = await fetchEndpointFormFields(
              matchedRoute.id,
              quickMethod,
              { endpointPath: quickEndpoint.trim(), refreshOpenApi: true },
            );
            const names = apiFields.map((field) => field.name).filter(Boolean);
            if (names.length > 0) {
              resolvedFields = names;
            }
          }
        } catch {
          schemaLookupFailed = true;
        }
      }

      if (resolvedFields.length === 0) {
        if (hasUsableExistingFields) {
          resolvedFields = existingFields;
        } else if (fieldSource === 'response') {
          resolvedFields = isDefaultGridTemplateFieldList(suggestedFields) ? [] : suggestedFields;
        } else {
          resolvedFields = suggestedFields;
        }
      }

      if (schemaLookupFailed && resolvedFields.length === 0) {
        setConnectError(
          fieldSource === 'response'
            ? 'Could not read column fields from this API. Check the path and method, then try again — or pick an existing resource below.'
            : 'Could not read form fields from this API. Check the path and method, then try again — or pick an existing resource below.',
        );
        return;
      }

      if (schemaLookupFailed && resolvedFields.length > 0) {
        setConnectError(
          fieldSource === 'response'
            ? 'Connected using saved or suggested columns — the API schema could not be refreshed.'
            : 'Connected using saved or suggested fields — the API schema could not be refreshed.',
        );
      }

      const built = buildDataSourceFromEndpoint(quickEndpoint, {
        existingId: inferredId,
        fields: resolvedFields,
        primaryKey: existing?.primaryKey,
        method: quickMethod,
      });
      const dataSource = existing
        ? {
          ...existing,
          endpoint: built.endpoint,
          operations: built.operations,
          fields: resolvedFields.length > 0 ? resolvedFields : existing.fields,
          connectorType: 'internal-api' as const,
          connectorRef: undefined,
        }
        : { ...built, connectorType: 'internal-api' as const };

      onCreateResource(dataSource);
      onDataSourceIdChange(dataSource.id);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectorConnect = () => {
    if (!selectedConnector || !onCreateResource) {
      return;
    }
    setConnectError(null);
    const dataSource = buildDataSourceFromConnector(selectedConnector, {
      fields: suggestedFields,
      path: selectedConnector.connectorType === 'rest-external' ? connectorPath.trim() || undefined : undefined,
      staticFilePath: selectedConnector.connectorType === 'static-file'
        ? selectedConnector.staticFilePath
        : undefined,
      staticFileFormat: selectedConnector.connectorType === 'static-file'
        ? selectedConnector.staticFileFormat
        : undefined,
      graphqlQuery: selectedConnector.connectorType === 'graphql'
        ? selectedConnector.graphqlQuery
        : undefined,
    });
    onCreateResource(dataSource);
    onDataSourceIdChange(dataSource.id);
  };

  return (
    <div className="flex flex-col gap-3">
      <DesignerFieldRow label="Source type" layout="stack">
        <UiSelect
          size="sm"
          value={sourceMode}
          onChange={(event) => {
            setSourceMode(event.target.value as ConnectSourceMode);
            setConnectError(null);
          }}
          aria-label="Data source connect mode"
        >
          <option value="internal-api">AppEndO internal API</option>
          <option value="workspace-connector">Workspace connector (REST / GraphQL / file)</option>
        </UiSelect>
      </DesignerFieldRow>

      {sourceMode === 'internal-api' ? (
        <>
          {routesQuery.isLoading ? (
            <div className={`flex items-center gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 px-3 py-2 text-xs text-slate-600`}>
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={2} />
              Loading your API routes…
            </div>
          ) : null}

          {routesQuery.isError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Could not load your API route list. You can still type a path manually, or retry from the API picker.
            </div>
          ) : null}
        </>
      ) : null}

      {connectError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {connectError}
        </div>
      ) : null}

      {sourceMode === 'internal-api' ? (
        <AppSurfaceBox tone="indigo" title="Quick connect" layout="panel">
          <p className="mb-2 ps-[4px] text-xs leading-relaxed text-slate-600">
            Pick one of your API routes (or type a path) — we create the resource
            {fieldSource === 'response' ? ' and infer grid columns from the response schema' : ' and REST endpoints'}
            {' '}
            automatically.
          </p>
          <DesignerFieldRow label="API path" layout="stack">
            <div className="flex flex-col gap-2">
              <BindingApiEndpointPicker
                value={quickEndpoint}
                method={quickMethod}
                methodFilter={methodFilter}
                onChange={onQuickEndpointChange}
                onMethodChange={setQuickMethod}
              />
              <AppButton
                type="button"
                intent="primary"
                size="sm"
                className="h-8 self-start px-3"
                disabled={!canQuickConnect || !onCreateResource || isConnecting}
                onClick={() => { void handleQuickConnect(); }}
              >
                {isConnecting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Link2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
                )}
                Connect
              </AppButton>
            </div>
          </DesignerFieldRow>
          {canQuickConnect ? (
            <p className="mt-2 ps-[4px] text-[11px] text-slate-500">
              Will use resource <span className="font-semibold text-slate-700">{inferredName}</span>
              {' '}(<span className="font-mono">{inferredId}</span>) ·{' '}
              <span className="font-mono text-slate-600">{quickMethod} {quickEndpoint.trim()}</span>
            </p>
          ) : null}
        </AppSurfaceBox>
      ) : (
        <AppSurfaceBox tone="indigo" title="Workspace connector" layout="panel">
          <p className="mb-2 ps-[4px] text-xs leading-relaxed text-slate-600">
            Use a connector defined in the workspace Data Connectors manager. The binding endpoint points at the secure server proxy.
          </p>
          {connectorsLoading ? (
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading connectors…
            </div>
          ) : null}
          <DesignerFieldRow label="Connector" layout="stack">
            <UiSelect
              size="sm"
              nested
              value={selectedConnectorId}
              onChange={(event) => setSelectedConnectorId(event.target.value)}
              aria-label="Workspace connector"
            >
              <option value="">Select connector…</option>
              {connectors.map((connector) => (
                <option key={connector.id} value={connector.id}>
                  {connector.name} ({connector.connectorType})
                </option>
              ))}
            </UiSelect>
          </DesignerFieldRow>
          {selectedConnector?.connectorType === 'rest-external' ? (
            <DesignerFieldRow label="Path override" layout="stack">
              <UiInput
                size="sm"
                nested
                value={connectorPath}
                onChange={(event) => setConnectorPath(event.target.value)}
                placeholder={selectedConnector.defaultPath || '/v1/resource'}
                autoDir={false}
              />
            </DesignerFieldRow>
          ) : null}
          <AppButton
            type="button"
            intent="primary"
            size="sm"
            className="mt-2 h-8 self-start px-3"
            disabled={!canConnectorConnect}
            onClick={handleConnectorConnect}
          >
            <Cable className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Connect connector
          </AppButton>
        </AppSurfaceBox>
      )}

      <AppSurfaceBox tone="slate" layout="strip" className="px-3 py-2.5">
        <DesignerFieldRow label="Or pick existing resource" layout="stack">
          <div className="flex items-end gap-2">
            <UiSelect
              size="sm"
              nested
              className="min-w-0 flex-1"
              placeholder="Select resource…"
              value={dataSourceId}
              onChange={(event) => onDataSourceIdChange(event.target.value)}
            >
              <option value="">Select resource…</option>
              {dataSourceOptions.map((dataSource) => (
                <option key={dataSource.id} value={dataSource.id}>
                  {dataSource.name} ({dataSource.id})
                  {dataSource.connectorType && dataSource.connectorType !== 'internal-api'
                    ? ` · ${dataSource.connectorType}`
                    : ''}
                </option>
              ))}
            </UiSelect>
            {onCreateResource ? (
              <AppButton
                type="button"
                intent="secondary"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => {
                  const newId = `resource_${Date.now().toString(36)}`;
                  onCreateResource({
                    id: newId,
                    name: 'New Resource',
                    endpoint: '/api/',
                    fields: suggestedFields,
                    primaryKey: 'id',
                    connectorType: 'internal-api',
                  });
                  onDataSourceIdChange(newId);
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} />
                New
              </AppButton>
            ) : null}
          </div>
        </DesignerFieldRow>
      </AppSurfaceBox>

      {selectedDataSource ? (
        <AppSurfaceBox tone="cyan" title="Selected resource">
          <dl className="space-y-2 text-xs text-slate-700">
            <div className="flex flex-col gap-[2px]">
              <dt className="ps-[4px] font-semibold text-slate-600">Endpoint</dt>
              <dd className="font-mono text-[11px] text-slate-800">{selectedDataSource.endpoint || '(not set)'}</dd>
            </div>
            <div className="flex flex-col gap-[2px]">
              <dt className="ps-[4px] font-semibold text-slate-600">Connector</dt>
              <dd className="font-mono text-[11px]">
                {selectedDataSource.connectorType ?? 'internal-api'}
                {selectedDataSource.connectorRef ? ` · ${selectedDataSource.connectorRef}` : ''}
              </dd>
            </div>
            <div className="flex flex-col gap-[2px]">
              <dt className="ps-[4px] font-semibold text-slate-600">Primary key</dt>
              <dd>{selectedDataSource.primaryKey ?? 'id'}</dd>
            </div>
            <div className="flex flex-col gap-[2px]">
              <dt className="ps-[4px] font-semibold text-slate-600">Fields</dt>
              <dd>
                {selectedDataSource.fields.length > 0
                  ? selectedDataSource.fields.join(', ')
                  : suggestedFields.length > 0
                    ? `Will auto-fill: ${suggestedFields.join(', ')}`
                    : '(auto-filled from mapped inputs on apply)'}
              </dd>
            </div>
          </dl>
        </AppSurfaceBox>
      ) : dataSourceOptions.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          No resources yet. Paste an API path above and click <span className="font-semibold">Connect</span>,
          or pick a workspace connector.
        </div>
      ) : null}
    </div>
  );
};
