import * as React from 'react';
import type { DesignerAction, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import { getNodePaletteItemId } from '../../../domain/component-designer/runtimeShared';
import {
  DASHBOARD_CANVAS_CONFIG_PROP,
  DASHBOARD_PERSONALIZABLE_PROP,
  parseDashboardCanvasPageConfig,
  serializeDashboardCanvasPageConfig,
  type DashboardCanvasPageConfig,
  type DashboardDomainEntry,
  type DashboardFilterDeclaration,
  type DashboardJoinablePair,
} from '../../../shared/api/contracts/dashboard-canvas';
import {
  AppButton,
  FormField,
  UiCheckboxChoice,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import {
  useDataSourceObjectFieldsQuery,
  useDataSourceSchemaCatalogQuery,
  useDataSourcesQuery,
} from '../../../shared/api/queries/data-sources';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useComponentDesignerDraftsQuery } from '../../../shared/api/queries/component-designer';

type InspectorDashboardDomainPanelProps = {
  document: DesignerDocument;
  dispatch: React.Dispatch<DesignerAction>;
};

type InspectorDashboardWidgetPanelProps = {
  document: DesignerDocument;
  node: DesignerNode;
  dispatch: React.Dispatch<DesignerAction>;
};

const findDashboardCanvasNode = (document: DesignerDocument) => (
  Object.values(document.nodes).find((item) => getNodePaletteItemId(item) === 'viz.dashboard-canvas')
);

export const isDashboardCanvasWidgetNode = (document: DesignerDocument, nodeId: string): boolean => (
  Boolean(findDashboardCanvasNode(document)?.children.includes(nodeId))
);

export const InspectorDashboardWidgetPanel: React.FC<InspectorDashboardWidgetPanelProps> = ({
  document,
  node,
  dispatch,
}) => {
  const root = document.nodes[document.rootNodeId];
  const config = parseDashboardCanvasPageConfig(root?.props?.[DASHBOARD_CANVAS_CONFIG_PROP]);
  const setProp = (key: string, value: unknown) => {
    dispatch({ type: 'set-node-prop', nodeId: node.id, key, value });
  };
  return (
    <div className="flex flex-col gap-3">
      {config.domain.length > 0 ? (
        <FormField label="Domain entry">
          <UiSelect
            size="sm"
            ariaLabel="Widget domain entry"
            value={typeof node.props.dashboardDomainEntryId === 'string' ? node.props.dashboardDomainEntryId : ''}
            onChange={(event) => setProp('dashboardDomainEntryId', event.target.value)}
          >
            <option value="">Infer from fields</option>
            {config.domain.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
      {(config.tabs ?? []).length > 0 ? (
        <FormField label="Home tab">
          <UiSelect
            size="sm"
            ariaLabel="Widget home tab"
            value={typeof node.props.dashboardTabId === 'string' ? node.props.dashboardTabId : ''}
            onChange={(event) => setProp('dashboardTabId', event.target.value)}
          >
            <option value="">Default tab</option>
            {(config.tabs ?? []).map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
    </div>
  );
};

const nextId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}`;

const dataSourceIdOf = (ref: unknown): string => {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && !Array.isArray(ref)) {
    const row = ref as Record<string, unknown>;
    if (typeof row.id === 'string') return row.id;
    if (typeof row.dataSourceId === 'string') return row.dataSourceId;
  }
  return '';
};

const DomainExposedFieldsEditor: React.FC<{
  dataSourceId: string;
  value: string[];
  onChange: (fields: string[]) => void;
}> = ({ dataSourceId, value, onChange }) => {
  const catalog = useDataSourceSchemaCatalogQuery(dataSourceId, Boolean(dataSourceId));
  const tables = catalog.objectsByType.TABLE ?? [];
  const views = catalog.objectsByType.VIEW ?? [];
  const objectType = tables.length > 0 ? 'TABLE' : 'VIEW';
  const objects = objectType === 'TABLE' ? tables : views;
  const [objectName, setObjectName] = React.useState(objects[0] ?? '');
  const [draftField, setDraftField] = React.useState('');
  React.useEffect(() => {
    if (objects.length > 0 && (!objectName || !objects.includes(objectName))) {
      setObjectName(objects[0] ?? '');
    }
  }, [objects, objectName]);
  const fieldsQuery = useDataSourceObjectFieldsQuery(dataSourceId, objectType, objectName);
  const options = [...new Set([
    ...value,
    ...(fieldsQuery.data?.items ?? []).map((item) => item.name),
  ])];
  const addDraftField = () => {
    const next = draftField.trim();
    if (!next || value.includes(next)) {
      setDraftField('');
      return;
    }
    onChange([...value, next]);
    setDraftField('');
  };
  return (
    <>
      {objects.length > 1 ? (
        <FormField label={objectType === 'TABLE' ? 'Table' : 'View'}>
          <UiSelect size="sm" ariaLabel="Domain object" value={objectName} onChange={(event) => setObjectName(event.target.value)}>
            {objects.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </UiSelect>
        </FormField>
      ) : null}
      <FormField label="Exposed fields">
        <UiSelect
          size="sm"
          multiple
          ariaLabel="Exposed fields"
          value={value.join(',')}
          onChange={(event) => onChange(event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
        >
          {options.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </UiSelect>
      </FormField>
      <FormField label="Add field name">
        <div className="flex gap-1">
          <UiInput
            size="sm"
            value={draftField}
            onChange={(event) => setDraftField(event.target.value)}
            ariaLabel="Add exposed field name"
          />
          <AppButton size="sm" intent="secondary" onClick={addDraftField} disabled={!draftField.trim()}>
            Add
          </AppButton>
        </div>
      </FormField>
    </>
  );
};

export const InspectorDashboardDomainPanel: React.FC<InspectorDashboardDomainPanelProps> = ({
  document,
  dispatch,
}) => {
  const root = document.nodes[document.rootNodeId];
  const config = parseDashboardCanvasPageConfig(root?.props?.[DASHBOARD_CANVAS_CONFIG_PROP]);
  const personalizable = root?.props?.[DASHBOARD_PERSONALIZABLE_PROP] === true || config.personalizable;

  const commit = (next: DashboardCanvasPageConfig, personalizableFlag = personalizable) => {
    dispatch({
      type: 'set-node-prop',
      nodeId: document.rootNodeId,
      key: DASHBOARD_CANVAS_CONFIG_PROP,
      value: serializeDashboardCanvasPageConfig(next),
    });
    dispatch({
      type: 'set-node-prop',
      nodeId: document.rootNodeId,
      key: DASHBOARD_PERSONALIZABLE_PROP,
      value: personalizableFlag,
    });
  };

  const bindingKeys = Object.keys(document.nodes).length > 0
    ? Object.keys((document as { bindingDefinitions?: Record<string, unknown> }).bindingDefinitions ?? {})
    : [];
  void bindingKeys;
  const dataSourcesQuery = useDataSourcesQuery();
  const dataSources = dataSourcesQuery.data?.items ?? [];
  const draftsQuery = useComponentDesignerDraftsQuery();
  const designerPages = draftsQuery.data ?? [];
  const canvasNode = Object.values(document.nodes).find((item) => getNodePaletteItemId(item) === 'viz.dashboard-canvas');
  const canvasWidgets = (canvasNode?.children ?? []).flatMap((id) => {
    const child = document.nodes[id];
    if (!child) return [];
    const label = typeof child.props.title === 'string' && child.props.title
      ? child.props.title
      : typeof child.props.label === 'string' && child.props.label
        ? child.props.label
        : getNodePaletteItemId(child) ?? id;
    return [{ id, label }];
  });

  const addEntry = () => {
    const entry: DashboardDomainEntry = {
      id: nextId('domain'),
      label: 'Domain entry',
      dataSourceRef: '',
      exposedFields: [],
    };
    commit({ ...config, domain: [...config.domain, entry] });
  };

  const addFilter = () => {
    const first = config.domain[0];
    if (!first) return;
    const filter: DashboardFilterDeclaration = {
      id: nextId('filter'),
      label: 'Filter',
      domainEntryId: first.id,
      field: first.exposedFields[0] ?? '',
      controlType: 'select',
    };
    commit({ ...config, filters: [...(config.filters ?? []), filter] });
  };

  const addPair = () => {
    const first = config.domain[0];
    const second = config.domain[1] ?? first;
    if (!first || !second) return;
    const pair: DashboardJoinablePair = {
      domainEntryIdA: first.id,
      fieldA: first.exposedFields[0] ?? '',
      domainEntryIdB: second.id,
      fieldB: second.exposedFields[0] ?? '',
      label: 'Join',
    };
    commit({ ...config, joinablePairs: [...(config.joinablePairs ?? []), pair] });
  };

  return (
    <div className="flex flex-col gap-3">
      <UiCheckboxChoice
        id="dashboard-personalizable"
        checked={personalizable}
        onChange={(checked) => commit(config, checked)}
      >
        Personalizable dashboard
      </UiCheckboxChoice>

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Domain entries</p>
        <AppButton size="sm" intent="secondary" onClick={addEntry}>
          <Plus className="h-3 w-3" />
          Add entry
        </AppButton>
      </div>
      {config.domain.map((entry, index) => {
        const selectedId = dataSourceIdOf(entry.dataSourceRef);
        const knownSource = dataSources.some((source) => source.id === selectedId);
        return (
        <div key={entry.id} className="rounded-md border border-slate-200 p-2">
          <FormField label="Label">
            <UiInput
              size="sm"
              value={entry.label ?? ''}
              onChange={(event) => {
                const domain = [...config.domain];
                domain[index] = { ...entry, label: event.target.value };
                commit({ ...config, domain });
              }}
              ariaLabel="Domain entry label"
            />
          </FormField>
          <FormField label="Data source">
            <UiSelect
              size="sm"
              ariaLabel="Data source"
              value={selectedId}
              onChange={(event) => {
                const domain = [...config.domain];
                domain[index] = { ...entry, dataSourceRef: event.target.value };
                commit({ ...config, domain });
              }}
            >
              <option value="">Select data source</option>
              {selectedId && !knownSource ? <option value={selectedId}>{selectedId}</option> : null}
              {dataSources.map((source) => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </UiSelect>
          </FormField>
          <DomainExposedFieldsEditor
            dataSourceId={dataSourceIdOf(entry.dataSourceRef)}
            value={entry.exposedFields}
            onChange={(exposedFields) => {
              const domain = [...config.domain];
              domain[index] = { ...entry, exposedFields };
              commit({ ...config, domain });
            }}
          />
          <AppButton
            size="sm"
            intent="utility"
            onClick={() => commit({ ...config, domain: config.domain.filter((item) => item.id !== entry.id) })}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </AppButton>
        </div>
        );
      })}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filters</p>
        <AppButton size="sm" intent="secondary" onClick={addFilter} disabled={config.domain.length === 0}>
          <Plus className="h-3 w-3" />
          Add filter
        </AppButton>
      </div>
      {(config.filters ?? []).map((filter, index) => (
        <div key={filter.id} className="rounded-md border border-slate-200 p-2">
          <FormField label="Label">
            <UiInput
              size="sm"
              value={filter.label}
              onChange={(event) => {
                const filters = [...(config.filters ?? [])];
                filters[index] = { ...filter, label: event.target.value };
                commit({ ...config, filters });
              }}
              ariaLabel="Filter label"
            />
          </FormField>
          <FormField label="Domain entry">
            <UiSelect
              size="sm"
              ariaLabel="Filter domain entry"
              value={filter.domainEntryId}
              onChange={(event) => {
                const filters = [...(config.filters ?? [])];
                filters[index] = { ...filter, domainEntryId: event.target.value };
                commit({ ...config, filters });
              }}
            >
              {config.domain.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>
              ))}
            </UiSelect>
          </FormField>
          <FormField label="Field">
            <UiSelect
              size="sm"
              ariaLabel="Filter field"
              value={filter.field}
              onChange={(event) => {
                const filters = [...(config.filters ?? [])];
                filters[index] = { ...filter, field: event.target.value };
                commit({ ...config, filters });
              }}
            >
              {(config.domain.find((item) => item.id === filter.domainEntryId)?.exposedFields ?? []).map((field) => (
                <option key={field} value={field}>{field}</option>
              ))}
            </UiSelect>
          </FormField>
          <FormField label="Control type">
            <UiSelect
              size="sm"
              ariaLabel="Filter control type"
              value={filter.controlType}
              onChange={(event) => {
                const filters = [...(config.filters ?? [])];
                filters[index] = { ...filter, controlType: event.target.value as DashboardFilterDeclaration['controlType'] };
                commit({ ...config, filters });
              }}
            >
              <option value="select">Select</option>
              <option value="multiSelect">Multi-select</option>
              <option value="dateRange">Date range</option>
              <option value="text">Text</option>
              <option value="numericRange">Numeric range</option>
            </UiSelect>
          </FormField>
          <FormField label="Default value">
            <UiInput
              size="sm"
              value={filter.defaultValue == null ? '' : String(filter.defaultValue)}
              onChange={(event) => {
                const filters = [...(config.filters ?? [])];
                filters[index] = { ...filter, defaultValue: event.target.value };
                commit({ ...config, filters });
              }}
              ariaLabel="Filter default value"
            />
          </FormField>
          {canvasWidgets.length > 0 ? (
            <FormField label="Applies to widgets">
              <UiSelect
                size="sm"
                multiple
                ariaLabel="Filter applies to widgets"
                value={(filter.appliesToWidgetIds ?? []).join(',')}
                onChange={(event) => {
                  const filters = [...(config.filters ?? [])];
                  const appliesToWidgetIds = event.target.value.split(',').map((item) => item.trim()).filter(Boolean);
                  filters[index] = {
                    ...filter,
                    appliesToWidgetIds: appliesToWidgetIds.length > 0 ? appliesToWidgetIds : undefined,
                  };
                  commit({ ...config, filters });
                }}
              >
                {canvasWidgets.map((widget) => (
                  <option key={widget.id} value={widget.id}>{widget.label}</option>
                ))}
              </UiSelect>
            </FormField>
          ) : null}
          <AppButton
            size="sm"
            intent="utility"
            onClick={() => commit({ ...config, filters: (config.filters ?? []).filter((item) => item.id !== filter.id) })}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </AppButton>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Joinable pairs</p>
        <AppButton size="sm" intent="secondary" onClick={addPair} disabled={config.domain.length === 0}>
          <Plus className="h-3 w-3" />
          Add pair
        </AppButton>
      </div>
      {(config.joinablePairs ?? []).map((pair, index) => (
        <div key={`${pair.domainEntryIdA}-${pair.fieldA}-${index}`} className="rounded-md border border-slate-200 p-2">
          <FormField label="Label">
            <UiInput
              size="sm"
              value={pair.label ?? ''}
              onChange={(event) => {
                const joinablePairs = [...(config.joinablePairs ?? [])];
                joinablePairs[index] = { ...pair, label: event.target.value };
                commit({ ...config, joinablePairs });
              }}
              ariaLabel="Joinable pair label"
            />
          </FormField>
          <FormField label="Entry A">
            <UiSelect
              size="sm"
              ariaLabel="Join domain entry A"
              value={pair.domainEntryIdA}
              onChange={(event) => {
                const joinablePairs = [...(config.joinablePairs ?? [])];
                joinablePairs[index] = { ...pair, domainEntryIdA: event.target.value };
                commit({ ...config, joinablePairs });
              }}
            >
              {config.domain.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>
              ))}
            </UiSelect>
          </FormField>
          <FormField label="Field A">
            <UiSelect
              size="sm"
              ariaLabel="Join field A"
              value={pair.fieldA}
              onChange={(event) => {
                const joinablePairs = [...(config.joinablePairs ?? [])];
                joinablePairs[index] = { ...pair, fieldA: event.target.value };
                commit({ ...config, joinablePairs });
              }}
            >
              {(config.domain.find((item) => item.id === pair.domainEntryIdA)?.exposedFields ?? []).map((field) => (
                <option key={field} value={field}>{field}</option>
              ))}
            </UiSelect>
          </FormField>
          <FormField label="Entry B">
            <UiSelect
              size="sm"
              ariaLabel="Join domain entry B"
              value={pair.domainEntryIdB}
              onChange={(event) => {
                const joinablePairs = [...(config.joinablePairs ?? [])];
                joinablePairs[index] = { ...pair, domainEntryIdB: event.target.value };
                commit({ ...config, joinablePairs });
              }}
            >
              {config.domain.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>
              ))}
            </UiSelect>
          </FormField>
          <FormField label="Field B">
            <UiSelect
              size="sm"
              ariaLabel="Join field B"
              value={pair.fieldB}
              onChange={(event) => {
                const joinablePairs = [...(config.joinablePairs ?? [])];
                joinablePairs[index] = { ...pair, fieldB: event.target.value };
                commit({ ...config, joinablePairs });
              }}
            >
              {(config.domain.find((item) => item.id === pair.domainEntryIdB)?.exposedFields ?? []).map((field) => (
                <option key={field} value={field}>{field}</option>
              ))}
            </UiSelect>
          </FormField>
          <AppButton
            size="sm"
            intent="utility"
            onClick={() => commit({ ...config, joinablePairs: (config.joinablePairs ?? []).filter((_, itemIndex) => itemIndex !== index) })}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </AppButton>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tabs</p>
        <AppButton
          size="sm"
          intent="secondary"
          onClick={() => commit({
            ...config,
            tabs: [...(config.tabs ?? []), { id: nextId('tab'), label: 'Tab' }],
          })}
        >
          <Plus className="h-3 w-3" />
          Add tab
        </AppButton>
      </div>
      {(config.tabs ?? []).map((tab, index) => (
        <div key={tab.id} className="flex items-end gap-2">
          <FormField label="Tab label" className="min-w-0 flex-1">
            <UiInput
              size="sm"
              value={tab.label}
              onChange={(event) => {
                const tabs = [...(config.tabs ?? [])];
                tabs[index] = { ...tab, label: event.target.value };
                commit({ ...config, tabs });
              }}
              ariaLabel="Tab label"
            />
          </FormField>
          <AppButton
            size="icon-sm"
            intent="utility"
            aria-label="Move tab up"
            disabled={index === 0}
            onClick={() => {
              const tabs = [...(config.tabs ?? [])];
              const previous = tabs[index - 1];
              if (!previous) return;
              tabs[index - 1] = tab;
              tabs[index] = previous;
              commit({ ...config, tabs });
            }}
          >
            <ChevronUp className="h-3 w-3" />
          </AppButton>
          <AppButton
            size="icon-sm"
            intent="utility"
            aria-label="Move tab down"
            disabled={index === (config.tabs ?? []).length - 1}
            onClick={() => {
              const tabs = [...(config.tabs ?? [])];
              const next = tabs[index + 1];
              if (!next) return;
              tabs[index + 1] = tab;
              tabs[index] = next;
              commit({ ...config, tabs });
            }}
          >
            <ChevronDown className="h-3 w-3" />
          </AppButton>
          <AppButton
            size="sm"
            intent="utility"
            onClick={() => commit({ ...config, tabs: (config.tabs ?? []).filter((item) => item.id !== tab.id) })}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </AppButton>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dashboard links</p>
        <AppButton
          size="sm"
          intent="secondary"
          onClick={() => commit({
            ...config,
            dashboardLinks: [...(config.dashboardLinks ?? []), { label: 'Related', target: { pageId: '' } }],
          })}
        >
          <Plus className="h-3 w-3" />
          Add link
        </AppButton>
      </div>
      {(config.dashboardLinks ?? []).map((link, index) => (
        <div key={`${link.label}-${index}`} className="rounded-md border border-slate-200 p-2">
          <FormField label="Label">
            <UiInput
              size="sm"
              value={link.label}
              onChange={(event) => {
                const dashboardLinks = [...(config.dashboardLinks ?? [])];
                dashboardLinks[index] = { ...link, label: event.target.value };
                commit({ ...config, dashboardLinks });
              }}
              ariaLabel="Dashboard link label"
            />
          </FormField>
          <FormField label="Target kind">
            <UiSelect
              size="sm"
              ariaLabel="Dashboard link target kind"
              value={'url' in link.target ? 'url' : 'page'}
              onChange={(event) => {
                const dashboardLinks = [...(config.dashboardLinks ?? [])];
                dashboardLinks[index] = {
                  ...link,
                  target: event.target.value === 'page' ? { pageId: designerPages[0]?.id ?? '' } : { url: '/' },
                };
                commit({ ...config, dashboardLinks });
              }}
            >
              <option value="page">Designer page</option>
              <option value="url">External URL</option>
            </UiSelect>
          </FormField>
          {'pageId' in link.target ? (
            <FormField label="Target page">
              <UiSelect
                size="sm"
                ariaLabel="Dashboard link page"
                value={link.target.pageId}
                onChange={(event) => {
                  const dashboardLinks = [...(config.dashboardLinks ?? [])];
                  dashboardLinks[index] = { ...link, target: { pageId: event.target.value } };
                  commit({ ...config, dashboardLinks });
                }}
              >
                <option value="">Select page</option>
                {designerPages.map((page) => (
                  <option key={page.id} value={page.id}>{page.name || page.id}</option>
                ))}
              </UiSelect>
            </FormField>
          ) : (
            <FormField label="Target URL">
              <UiInput
                size="sm"
                value={link.target.url}
                onChange={(event) => {
                  const dashboardLinks = [...(config.dashboardLinks ?? [])];
                  dashboardLinks[index] = { ...link, target: { url: event.target.value } };
                  commit({ ...config, dashboardLinks });
                }}
                ariaLabel="Dashboard link URL"
              />
            </FormField>
          )}
          <UiCheckboxChoice
            id={`dashboard-link-forward-${index}`}
            checked={Boolean(link.forwardFilterState)}
            onChange={(checked) => {
              const dashboardLinks = [...(config.dashboardLinks ?? [])];
              dashboardLinks[index] = { ...link, forwardFilterState: checked };
              commit({ ...config, dashboardLinks });
            }}
          >
            Forward current filters
          </UiCheckboxChoice>
          <AppButton
            size="sm"
            intent="utility"
            onClick={() => commit({ ...config, dashboardLinks: (config.dashboardLinks ?? []).filter((_, itemIndex) => itemIndex !== index) })}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </AppButton>
        </div>
      ))}
    </div>
  );
};
