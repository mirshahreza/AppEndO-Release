import * as React from 'react';
import { Braces, FolderOpen, Link2, Smile, Unlink } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import type { DesignerNode } from '../../../domain/component-designer/types';
import type { InspectorFieldSchema } from '../../../domain/component-designer/inspectorRegistry';
import {
  createPropertyBindingDefinition,
  getNodePropertyBinding,
  isFormValueProp,
  propertyBindingKeyForProp,
  resolveBindingRequestHeaders,
  resolvePropertyBindingDataPath,
  resolveBindingUrlParams,
} from '../../../domain/component-designer/bindingEngine';
import {
  createStoreReadBindingDefinition,
  getNodeStoreReadBindingForProp,
} from '../../../domain/component-designer/bindingStoreEngine';
import {
  createSessionReadBindingDefinition,
  DESIGNER_SESSION_FIELD_OPTIONS,
  getNodeSessionReadBindingForProp,
} from '../../../domain/component-designer/bindingSessionEngine';
import { createFormulaBindingDefinition } from '../../../domain/component-designer/bindingFormulaEngine';
import type { DesignerSessionField } from '../../../domain/component-designer/types';
import { UiInput, UiSelect, AppButton, DesignerCodeEditorField, FieldHintTooltip } from '../../../shared/ui';
import {
  HEROUI_FIELD_BORDER_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { HEROUI_FIELD_RADIUS_CLASS } from '../../../shared/ui/heroFieldChrome';
import { resolveHeroUiFieldSizeTokens } from '../../../shared/ui/heroFieldSize';
import { cn } from '../../../lib/utils';
import { FormAccessorySlot } from '../../../shared/ui/formTabOrder';
import { PackageWorkspaceAssetsPickerDialog } from '../../packages/components/PackageWorkspaceAssetsPickerDialog';
import { NavigationIconPickerDialog } from '../../platform-navigations/components/dialogs/NavigationIconPickerDialog';
import { InspectorPropDialogField } from './InspectorPropDialogField';
import { InspectorJsonArrayListField } from './InspectorJsonArrayListField';
import { InspectorBindingRequestConfig } from './InspectorBindingRequestConfig';
import {
  applyTailwindUtility,
  resolveTailwindUtilityValue,
} from '../../../domain/component-designer/tailwindClasses';
import {
  TAILWIND_INSPECTOR_FIELDS,
  type TailwindInspectorField,
} from '../../../domain/component-designer/inspectorRegistry';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  PROPERTY_BINDING_VALUE_SOURCE_LABELS,
  PROP_BINDING_SOURCE_INDICATOR,
  resolvePropBindingSourceKind,
  resolvePropertyBindingSourceMode,
  resolvePropertyBindingValueSource,
  type PropBindingSourceKind,
  type PropertyBindingSourceMode,
  type PropertyBindingValueSource,
} from './inspectorBindingUi';
import { DESIGNER_FORM_INPUT_PALETTE_ITEM_ID_SET } from '../../../domain/component-designer/catalog';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../../../domain/component-designer/propRegistry';
import {
  createRegionColumnBindingDefinition,
  findAncestorDataRegion,
  getNodeRegionColumnBinding,
  nodeSupportsRegionColumnLov,
  resolveRegionColumnFields,
} from '../../../domain/component-designer/bindingRegionEngine';
import { normalizeBindingDefinitions } from '../../../domain/component-designer/bindingRegistry';
import { suggestColumnForNode } from '../../../domain/component-designer/bindingResourceModel';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import { InspectorFieldLabel } from './DesignerFieldRow';

const smFieldSizeTokens = resolveHeroUiFieldSizeTokens('sm');

/** End-addon slot: no padding so the toggle can fill the full cell. */
const BINDING_END_ADDON_SLOT_CLASS = 'flex w-8 shrink-0 items-stretch self-stretch border-s border-slate-300 !p-0';

/** Single bordered chrome: control body + binding toggle as input end-addon. */
const InspectorBindingInputGroup: React.FC<{
  children: React.ReactNode;
  endAddon: React.ReactNode;
  className?: string;
}> = ({ children, endAddon, className }) => (
  <div
    className={cn(
      'flex w-full items-stretch overflow-hidden !bg-white',
      smFieldSizeTokens.controlHeightClass,
      smFieldSizeTokens.controlMaxHeightClass,
      HEROUI_FIELD_BORDER_CLASS,
      HEROUI_FIELD_RADIUS_CLASS,
      className,
    )}
  >
    <div className="min-w-0 flex-1">{children}</div>
    <FormAccessorySlot className={BINDING_END_ADDON_SLOT_CLASS}>
      {endAddon}
    </FormAccessorySlot>
  </div>
);

const DIALOG_TEXT_FIELD_KEYS = new Set(['className', 'style']);

/** Parses a `field.arrayEditorColumns` field's raw JSON-string prop back into an array for editing. */
const parseJsonArrayFieldValue = (raw: unknown): unknown[] | undefined => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const validateJsonFieldDraft = (draft: string): string | null => {
  const trimmed = draft.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    JSON.parse(trimmed);
    return null;
  } catch {
    return 'Invalid JSON — check for missing quotes, commas, or brackets.';
  }
};

const tailwindFieldByKey = new Map<string, TailwindInspectorField>(
  TAILWIND_INSPECTOR_FIELDS.map((field) => [field.key, field]),
);

const normalizePropValue = (field: InspectorFieldSchema, rawValue: string): unknown => {
  if (field.type === 'number') {
    const trimmed = rawValue.trim();
    return trimmed.length === 0 ? undefined : Number(trimmed);
  }

  if (field.type === 'boolean') {
    return rawValue === 'true';
  }

  const trimmed = rawValue.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const readPropDisplayValue = (node: DesignerNode, field: InspectorFieldSchema): string => {
  const tailwindField = tailwindFieldByKey.get(field.key);
  if (tailwindField) {
    const className = typeof node.props.className === 'string' ? node.props.className : '';
    return resolveTailwindUtilityValue(className, tailwindField);
  }

  const value = node.props[field.key];
  if (field.type === 'boolean') {
    return value === true ? 'true' : 'false';
  }

  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
};

type InspectorPropBindingToggleProps = {
  active: boolean;
  fieldLabel: string;
  onToggle: () => void;
};

export const InspectorPropBindingToggle: React.FC<InspectorPropBindingToggleProps> = ({
  active,
  fieldLabel,
  onToggle,
}) => (
  <button
    type="button"
    tabIndex={-1}
    className={cn(
      // Fill the whole end-addon cell so hover is a full rectangle, not a floating chip.
      'inline-flex h-full min-h-8 w-8 shrink-0 items-center justify-center !rounded-none border-0 bg-transparent p-0 shadow-none outline-none',
      'focus-visible:bg-slate-100 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo-300',
      active
        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
    )}
    aria-label={active ? `Disable dynamic binding for ${fieldLabel}` : `Enable dynamic binding for ${fieldLabel}`}
    aria-pressed={active}
    onClick={onToggle}
  >
    <Braces className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
  </button>
);

type InspectorPropBindingSourceIndicatorProps = {
  kind: PropBindingSourceKind;
};

/** Always-visible colored source marker for actually-bound props (T1-11f). */
export const InspectorPropBindingSourceIndicator: React.FC<InspectorPropBindingSourceIndicatorProps> = ({
  kind,
}) => {
  const meta = PROP_BINDING_SOURCE_INDICATOR[kind];
  return (
    <span
      data-testid={`prop-binding-source-indicator-${kind}`}
      data-binding-source={kind}
      title={meta.title}
      aria-label={meta.title}
      className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-white ${meta.dotClassName} ${meta.ringClassName}`}
    />
  );
};

type InspectorPropBindingDynamicPanelProps = {
  dataPath: string;
  fetchEndpoint: string;
  sourceMode: PropertyBindingSourceMode;
  dataSourceOptions: DesignerBindingDefinitions['dataSources'];
  fieldKey: string;
  urlParams: Record<string, string>;
  headers: Record<string, string>;
  onDataPathChange: (value: string) => void;
  onFetchEndpointChange: (value: string) => void;
  onApiSourceApply: (value: { dataPath: string; fetchEndpoint: string }) => void;
  onSourceModeChange: (mode: PropertyBindingSourceMode) => void;
  onUrlParamsChange: (value: Record<string, string>) => void;
  onHeadersChange: (value: Record<string, string>) => void;
};

const InspectorPropBindingDynamicPanel: React.FC<InspectorPropBindingDynamicPanelProps> = ({
  dataPath,
  fetchEndpoint,
  sourceMode,
  dataSourceOptions,
  fieldKey,
  urlParams,
  headers,
  onDataPathChange,
  onFetchEndpointChange,
  onApiSourceApply,
  onSourceModeChange,
  onUrlParamsChange,
  onHeadersChange,
}) => {
  const dataSources = Object.values(dataSourceOptions);
  const selectedDataSourceId = dataSources.find((dataSource) => dataSource.endpoint === fetchEndpoint)?.id ?? '';
  
  const [connections, setConnections] = React.useState<Array<{ familyId: string; status: string }>>([]);
  const [isChecking, setIsChecking] = React.useState(false);
  const [connectionActionError, setConnectionActionError] = React.useState<string | null>(null);
  const [connectionStatusError, setConnectionStatusError] = React.useState<string | null>(null);

  const fetchConnections = React.useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/packages/api-connectors/connections');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.connections)) {
          setConnections(data.connections);
        }
        setConnectionStatusError(null);
      } else {
        setConnectionStatusError('Could not check connection status. The account state shown below may be stale.');
      }
    } catch {
      setConnectionStatusError('Could not reach the connection service. Check your network and try again.');
    } finally {
      setIsChecking(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  const isConnectorEndpoint = fetchEndpoint.startsWith('/api/packages/api-connectors/proxy/');
  const familyId = isConnectorEndpoint ? fetchEndpoint.substring('/api/packages/api-connectors/proxy/'.length).split('/')[0] : null;
  const hasConnection = familyId ? connections.some(c => c.familyId === familyId && c.status === 'active') : false;

  const handleConnect = async () => {
    if (!familyId) return;
    setConnectionActionError(null);
    try {
      const res = await fetch(`/api/packages/api-connectors/connections/${familyId}/connect`, { method: 'POST' });
      if (res.ok) {
        await fetchConnections();
      } else {
        setConnectionActionError(`Could not connect ${familyId}. Please try again.`);
      }
    } catch {
      setConnectionActionError('Could not reach the connection service. Check your network and try again.');
    }
  };

  const handleDisconnect = async () => {
    if (!familyId) return;
    setConnectionActionError(null);
    try {
      const res = await fetch(`/api/packages/api-connectors/connections/${familyId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchConnections();
      } else {
        setConnectionActionError(`Could not disconnect ${familyId}. Please try again.`);
      }
    } catch {
      setConnectionActionError('Could not reach the connection service. Check your network and try again.');
    }
  };

  const applyDataSource = (dataSourceId: string) => {
    const dataSource = dataSourceOptions[dataSourceId];
    if (!dataSource) {
      return;
    }

    const suggestedField = dataSource.fields.find((candidate) => candidate === fieldKey)
      ?? dataSource.fields.find((candidate) => candidate.toLowerCase() === fieldKey.toLowerCase())
      ?? dataSource.fields[0]
      ?? '';

    if (dataPath.trim().length === 0) {
      onApiSourceApply({ dataPath: suggestedField, fetchEndpoint: dataSource.endpoint });
      return;
    }

    onApiSourceApply({ dataPath, fetchEndpoint: dataSource.endpoint });
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 p-2.5`}
      {...preventInspectorDetailsToggle}
    >
      <div className="flex flex-col gap-[2px]">
        <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Bind value from</span>
        <UiSelect
          size="sm"
          nested
          className="w-full"
          value={sourceMode}
          onChange={(event) => onSourceModeChange(event.target.value as PropertyBindingSourceMode)}
        >
          <option value="state">Page data</option>
          <option value="formula">Formula / expression</option>
          <option value="store">Global store</option>
          <option value="session">Current session</option>
          <option value="api">API response</option>
        </UiSelect>
      </div>

      {sourceMode === 'session' ? (
        <div className="flex flex-col gap-[2px]">
          <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Session field</span>
          <UiSelect
            size="sm"
            nested
            className="w-full"
            value={dataPath || 'displayName'}
            onChange={(event) => onDataPathChange(event.target.value)}
          >
            {DESIGNER_SESSION_FIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </UiSelect>
        </div>
      ) : sourceMode === 'formula' ? (
        <div className="flex flex-col gap-[2px]">
          <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Formula</span>
          <DesignerCodeEditorField
            ariaLabel="Formula expression"
            language="javascript"
            editorHeight={120}
            lineNumbers={false}
            minimap={false}
            fontSize={12}
            placeholder={"store.form.qty * store.form.price"}
            value={dataPath}
            onChange={(nextValue) => onDataPathChange(nextValue)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-[2px]">
          <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>{sourceMode === 'store' ? 'Store Path' : 'Data Path'}</span>
          <UiInput
            size="sm"
            nested
            className="w-full"
            placeholder={sourceMode === 'store' ? 'selection.countryId' : 'user.profile.email'}
            value={dataPath}
            onChange={(event) => onDataPathChange(event.target.value)}
            autoDir={false}
          />
        </div>
      )}

      {sourceMode === 'api' ? (
        <>
          {isConnectorEndpoint && familyId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={`${INSPECTOR_TEXT_SM} font-semibold text-amber-800`}>
                  {hasConnection ? `${familyId} Connected` : `${familyId} Connection`}
                </span>
                <span className={`${INSPECTOR_TEXT_2XS} text-amber-600 font-mono`}>OAuth</span>
              </div>
              <p className={`${INSPECTOR_TEXT_XS} text-amber-700`}>
                {hasConnection 
                  ? 'Your active credentials are ready for preview and deployment.' 
                  : 'An active external connection is required to fetch preview data.'}
              </p>
              <div className="flex gap-2">
                {!hasConnection ? (
                  <AppButton
                    size="sm"
                    intent="primary"
                    className={`w-full ${INSPECTOR_TEXT_SM} py-1`}
                    onClick={handleConnect}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Connect Account
                  </AppButton>
                ) : (
                  <AppButton
                    size="sm"
                    intent="secondary"
                    className={`w-full ${INSPECTOR_TEXT_SM} py-1 text-red-600 border-red-200 hover:bg-red-50`}
                    onClick={handleDisconnect}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect
                  </AppButton>
                )}
              </div>
              {connectionActionError ? (
                <p role="alert" className={`rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 ${INSPECTOR_TEXT_XS} text-rose-700`}>
                  {connectionActionError}
                </p>
              ) : null}
              {!connectionActionError && connectionStatusError ? (
                <p role="alert" className={`rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 ${INSPECTOR_TEXT_XS} text-rose-700`}>
                  {connectionStatusError}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-md border border-indigo-100 bg-white p-2">
            <span className={`inline-flex items-center gap-0.5 ps-[4px] ${INSPECTOR_TEXT_SM} font-medium text-slate-600`}>
              API assistant
              <FieldHintTooltip
                hint="Pick a shared resource to fill the endpoint and suggest a response field."
                label="API assistant"
              />
            </span>
            <div className="mt-2 flex flex-col gap-[2px]">
              <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Resource</span>
              <UiSelect
                size="sm"
                nested
                className="w-full"
                value={selectedDataSourceId}
                onChange={(event) => applyDataSource(event.target.value)}
              >
                <option value="">Select resource…</option>
                {dataSources.map((dataSource) => (
                  <option key={dataSource.id} value={dataSource.id}>{dataSource.name} ({dataSource.id})</option>
                ))}
              </UiSelect>
            </div>
          </div>

          <div className="flex flex-col gap-[2px]">
            <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>GET Endpoint</span>
            <UiInput
              size="sm"
              nested
              className="w-full"
              placeholder="/api/v1/users/{userId}"
              value={fetchEndpoint}
              onChange={(event) => onFetchEndpointChange(event.target.value)}
            />
          </div>

          <InspectorBindingRequestConfig
            endpoint={fetchEndpoint}
            urlParams={urlParams}
            headers={headers}
            onUrlParamsChange={onUrlParamsChange}
            onHeadersChange={onHeadersChange}
          />
        </>
      ) : null}
    </div>
  );
};

type InspectorBindablePropFieldProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  field: InspectorFieldSchema;
  setProp: (key: string, value: unknown) => void;
  dispatch: React.Dispatch<DesignerAction>;
};

export const InspectorBindablePropField: React.FC<InspectorBindablePropFieldProps> = ({
  node,
  document,
  bindingDefinitions: bindingDefinitionsInput,
  field,
  setProp,
  dispatch,
}) => {
  const bindingDefinitions = React.useMemo(
    () => normalizeBindingDefinitions(bindingDefinitionsInput),
    [bindingDefinitionsInput],
  );
  const bindingKey = propertyBindingKeyForProp(field.key);
  const paletteItemId = typeof node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'string'
    ? node.props[DESIGNER_PALETTE_ITEM_ID_PROP]
    : undefined;
  const ancestorDataRegion = React.useMemo(
    () => findAncestorDataRegion(document, node.id),
    [document, node.id],
  );
  const regionColumnFields = React.useMemo(
    () => resolveRegionColumnFields(document, node.id, bindingDefinitions),
    [bindingDefinitions, document, node.id],
  );
  const supportsRegionColumnBinding = Boolean(
    ancestorDataRegion
    && paletteItemId
    && DESIGNER_FORM_INPUT_PALETTE_ITEM_ID_SET.has(paletteItemId)
    && isFormValueProp(field.key),
  );
  const supportsRegionColumnLov = supportsRegionColumnBinding && nodeSupportsRegionColumnLov(node);
  const lovOptions = React.useMemo(
    () => Object.values(bindingDefinitions.lovs),
    [bindingDefinitions.lovs],
  );
  const existingRegionColumn = getNodeRegionColumnBinding(node, field.key);
  const existing = getNodePropertyBinding(node, field.key);
  const sessionBinding = getNodeSessionReadBindingForProp(node, field.key);
  const storeBinding = getNodeStoreReadBindingForProp(node, field.key);
  const pureStoreBinding = storeBinding && storeBinding.definition.sourceType !== 'session'
    ? storeBinding
    : null;
  const boundSourceKind = resolvePropBindingSourceKind(node, field.key);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = React.useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = React.useState(false);
  const [isDynamic, setIsDynamic] = React.useState(Boolean(existingRegionColumn || existing || pureStoreBinding || sessionBinding));
  const [valueSource, setValueSource] = React.useState<PropertyBindingValueSource>(() =>
    resolvePropertyBindingValueSource(
      Boolean(existingRegionColumn),
      resolvePropertyBindingSourceMode(
        existing?.definition.fetchEndpoint ?? '',
        Boolean(pureStoreBinding),
        existing?.definition.lovRef,
        undefined,
        Boolean(sessionBinding),
        existing?.definition.sourceType === 'formula',
      ),
      Boolean(sessionBinding),
    ),
  );
  const [regionColumn, setRegionColumn] = React.useState(existingRegionColumn?.column ?? '');
  const [regionLovRef, setRegionLovRef] = React.useState(existingRegionColumn?.definition.lovRef ?? '');
  const showRegionColumnPanel = isDynamic && supportsRegionColumnBinding && valueSource === 'recordField';
  const showSessionPanel = isDynamic && valueSource === 'session';
  const showOtherBindingPanel = isDynamic
    && (!supportsRegionColumnBinding || valueSource !== 'recordField')
    && valueSource !== 'session';
  const [dataPath, setDataPath] = React.useState(() => {
    if (sessionBinding) {
      return sessionBinding.sessionField;
    }
    if (pureStoreBinding) {
      return pureStoreBinding.storePath;
    }

    return existing ? resolvePropertyBindingDataPath(existing.definition) ?? '' : '';
  });
  const [fetchEndpoint, setFetchEndpoint] = React.useState(existing?.definition.fetchEndpoint ?? '');
  const [urlParams, setUrlParams] = React.useState<Record<string, string>>(() =>
    existing ? resolveBindingUrlParams(existing.definition) : {},
  );
  const [headers, setHeaders] = React.useState<Record<string, string>>(() =>
    existing ? resolveBindingRequestHeaders(existing.definition) : {},
  );
  const [sourceMode, setSourceMode] = React.useState<PropertyBindingSourceMode>(
    resolvePropertyBindingSourceMode(
      existing?.definition.fetchEndpoint ?? '',
      Boolean(pureStoreBinding),
      existing?.definition.lovRef,
      undefined,
      Boolean(sessionBinding),
      existing?.definition.sourceType === 'formula',
    ),
  );

  React.useEffect(() => {
    const nextRegionColumn = getNodeRegionColumnBinding(node, field.key);
    const nextProperty = getNodePropertyBinding(node, field.key);
    const nextSession = getNodeSessionReadBindingForProp(node, field.key);
    const nextStoreRaw = getNodeStoreReadBindingForProp(node, field.key);
    const nextStore = nextStoreRaw && nextStoreRaw.definition.sourceType !== 'session'
      ? nextStoreRaw
      : null;
    const hasBinding = Boolean(nextRegionColumn || nextProperty || nextStore || nextSession);
    const hasFormula = nextProperty?.definition.sourceType === 'formula';

    setIsDynamic((current) => hasBinding || current);
    setValueSource(resolvePropertyBindingValueSource(
      Boolean(nextRegionColumn),
      resolvePropertyBindingSourceMode(
        nextProperty?.definition.fetchEndpoint ?? '',
        Boolean(nextStore),
        nextProperty?.definition.lovRef,
        undefined,
        Boolean(nextSession),
        hasFormula,
      ),
      Boolean(nextSession),
    ));
    setRegionColumn(nextRegionColumn?.column ?? '');
    setRegionLovRef(nextRegionColumn?.definition.lovRef ?? '');
    setDataPath(
      nextSession
        ? nextSession.sessionField
        : nextStore
          ? nextStore.storePath
          : nextProperty
            ? resolvePropertyBindingDataPath(nextProperty.definition) ?? ''
            : '',
    );
    setFetchEndpoint(nextProperty?.definition.fetchEndpoint ?? '');
    setUrlParams(nextProperty ? resolveBindingUrlParams(nextProperty.definition) : {});
    setHeaders(nextProperty ? resolveBindingRequestHeaders(nextProperty.definition) : {});
    setSourceMode(resolvePropertyBindingSourceMode(
      nextProperty?.definition.fetchEndpoint ?? '',
      Boolean(nextStore),
      nextProperty?.definition.lovRef,
      undefined,
      Boolean(nextSession),
      hasFormula,
    ));
  }, [node.id, node.binding, field.key]);

  const removePropertyBinding = React.useCallback(() => {
    dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey });
  }, [bindingKey, dispatch, node.id]);

  const removeStoreBinding = React.useCallback(() => {
    const currentStore = getNodeStoreReadBindingForProp(node, field.key);
    if (currentStore && currentStore.definition.sourceType !== 'session') {
      dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey: currentStore.bindingKey });
    }
  }, [dispatch, field.key, node]);

  const removeSessionBinding = React.useCallback(() => {
    const currentSession = getNodeSessionReadBindingForProp(node, field.key);
    if (currentSession) {
      dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey: currentSession.bindingKey });
    }
  }, [dispatch, field.key, node]);

  const removeRegionColumnBinding = React.useCallback(() => {
    if (getNodeRegionColumnBinding(node, field.key)) {
      dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey });
    }
  }, [bindingKey, dispatch, field.key, node]);

  const commitSessionBinding = React.useCallback((sessionField: DesignerSessionField) => {
    removeRegionColumnBinding();
    removeStoreBinding();
    const sessionBindingDefinition = createSessionReadBindingDefinition(field.key, sessionField);
    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey: sessionBindingDefinition.bindingKey,
      definition: sessionBindingDefinition.definition,
    });
  }, [dispatch, field.key, node.id, removeRegionColumnBinding, removeStoreBinding]);

  const commitRegionColumnBinding = React.useCallback((nextColumn: string, nextLovRef = regionLovRef) => {
    const trimmedColumn = nextColumn.trim();
    const trimmedLovRef = nextLovRef.trim();
    if (trimmedColumn.length === 0) {
      removeRegionColumnBinding();
      removePropertyBinding();
      removeStoreBinding();
      removeSessionBinding();
      return;
    }

    removePropertyBinding();
    removeStoreBinding();
    removeSessionBinding();
    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey,
      definition: createRegionColumnBindingDefinition(field.key, trimmedColumn, {
        lovRef: trimmedLovRef.length > 0 ? trimmedLovRef : undefined,
      }),
    });
  }, [bindingKey, dispatch, field.key, node, regionLovRef, removePropertyBinding, removeRegionColumnBinding, removeSessionBinding, removeStoreBinding]);

  const commitRegionLovRef = React.useCallback((nextLovRef: string) => {
    const trimmedLovRef = nextLovRef.trim();
    setRegionLovRef(trimmedLovRef);
    if (regionColumn.trim().length > 0) {
      commitRegionColumnBinding(regionColumn, trimmedLovRef);
    }
  }, [commitRegionColumnBinding, regionColumn]);

  const commitBinding = React.useCallback((
    nextDataPath: string,
    nextSourceMode: PropertyBindingSourceMode,
    nextFetchEndpoint: string,
    nextUrlParams: Record<string, string>,
    nextHeaders: Record<string, string>,
  ) => {
    const trimmedPath = nextDataPath.trim();

    if (trimmedPath.length === 0) {
      if (getNodePropertyBinding(node, field.key)) {
        dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey });
      }
      removeRegionColumnBinding();
      removeStoreBinding();
      removeSessionBinding();
      return;
    }

    removeRegionColumnBinding();

    if (nextSourceMode === 'session') {
      const sessionField = (
        trimmedPath === 'userId'
        || trimmedPath === 'email'
        || trimmedPath === 'role'
        || trimmedPath === 'displayName'
      ) ? trimmedPath : 'displayName';
      removeStoreBinding();
      commitSessionBinding(sessionField);
      return;
    }

    removeSessionBinding();

    if (nextSourceMode === 'formula') {
      const currentStore = getNodeStoreReadBindingForProp(node, field.key);
      if (currentStore && currentStore.definition.sourceType !== 'session') {
        dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey: currentStore.bindingKey });
      }
      const formulaBinding = createFormulaBindingDefinition(field.key, trimmedPath);
      dispatch({
        type: 'set-node-binding',
        nodeId: node.id,
        bindingKey: formulaBinding.bindingKey,
        definition: formulaBinding.definition,
      });
      return;
    }

    if (nextSourceMode === 'store') {
      if (getNodePropertyBinding(node, field.key)) {
        dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey });
      }

      const currentStore = getNodeStoreReadBindingForProp(node, field.key);
      const storeBindingDefinition = createStoreReadBindingDefinition(field.key, trimmedPath);
      if (currentStore && currentStore.bindingKey !== storeBindingDefinition.bindingKey) {
        dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey: currentStore.bindingKey });
      }

      dispatch({
        type: 'set-node-binding',
        nodeId: node.id,
        bindingKey: storeBindingDefinition.bindingKey,
        definition: storeBindingDefinition.definition,
      });
      return;
    }

    const currentStore = getNodeStoreReadBindingForProp(node, field.key);
    if (currentStore && currentStore.definition.sourceType !== 'session') {
      dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey: currentStore.bindingKey });
    }

    const trimmedEndpoint = nextFetchEndpoint.trim();
    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey,
      definition: createPropertyBindingDefinition(field.key, trimmedPath, {
        fetchEndpoint: trimmedEndpoint.length > 0 ? trimmedEndpoint : undefined,
        urlParams: trimmedEndpoint.length > 0 ? nextUrlParams : undefined,
        headers: trimmedEndpoint.length > 0 ? nextHeaders : undefined,
      }),
    });
  }, [bindingKey, commitSessionBinding, dispatch, field.key, node, removeRegionColumnBinding, removeSessionBinding, removeStoreBinding]);

  const handleToggleDynamic = () => {
    if (isDynamic) {
      removeRegionColumnBinding();
      removePropertyBinding();
      removeStoreBinding();
      removeSessionBinding();
      setIsDynamic(false);
      setRegionColumn('');
      setRegionLovRef('');
      return;
    }

    setIsDynamic(true);
    if (supportsRegionColumnBinding) {
      setValueSource('recordField');
      const suggested = suggestColumnForNode(node, field.key, regionColumnFields);
      if (suggested.length > 0) {
        setRegionColumn(suggested);
        commitRegionColumnBinding(suggested, regionLovRef);
      } else {
        setRegionColumn('');
        setRegionLovRef('');
      }
    }
  };

  const handleValueSourceChange = (nextSource: PropertyBindingValueSource) => {
    setValueSource(nextSource);

    if (nextSource === 'recordField') {
      removePropertyBinding();
      removeStoreBinding();
      removeSessionBinding();
      return;
    }

    removeRegionColumnBinding();

    if (nextSource === 'pageData') {
      handleSourceModeChange('state');
      return;
    }

    if (nextSource === 'formula') {
      handleSourceModeChange('formula');
      return;
    }

    if (nextSource === 'store') {
      handleSourceModeChange('store');
      return;
    }

    if (nextSource === 'session') {
      handleSourceModeChange('session');
      return;
    }

    handleSourceModeChange('api');
  };

  const handleSourceModeChange = (mode: PropertyBindingSourceMode) => {
    setSourceMode(mode);
    const nextEndpoint = mode === 'api' ? fetchEndpoint : '';
    if (mode === 'state' || mode === 'store' || mode === 'session' || mode === 'formula') {
      setFetchEndpoint('');
      setUrlParams({});
      setHeaders({});
    }
    if (mode === 'session') {
      const nextField = (
        dataPath === 'userId'
        || dataPath === 'email'
        || dataPath === 'role'
        || dataPath === 'displayName'
      ) ? dataPath : 'displayName';
      setDataPath(nextField);
      commitBinding(nextField, mode, '', {}, {});
      return;
    }
    if (dataPath.trim().length > 0) {
      commitBinding(
        dataPath,
        mode,
        nextEndpoint,
        mode === 'api' ? urlParams : {},
        mode === 'api' ? headers : {},
      );
    }
  };

  const bindingToggle = (
    <InspectorPropBindingToggle
      active={isDynamic}
      fieldLabel={field.label}
      onToggle={handleToggleDynamic}
    />
  );

  const renderStaticControl = () => {
    if (field.arrayEditorColumns && field.arrayEditorColumns.length > 0 && field.type === 'string') {
      return (
        <InspectorBindingInputGroup endAddon={bindingToggle} className="!h-auto !max-h-none min-h-8">
          <div className="min-w-0 flex-1 p-1">
            <InspectorJsonArrayListField
              columns={field.arrayEditorColumns}
              itemLabel={field.arrayEditorItemLabel}
              value={parseJsonArrayFieldValue(node.props[field.key])}
              onChange={(nextArray) => setProp(field.key, nextArray && nextArray.length > 0 ? JSON.stringify(nextArray) : undefined)}
            />
          </div>
        </InspectorBindingInputGroup>
      );
    }

    if ((DIALOG_TEXT_FIELD_KEYS.has(field.key) || field.jsonEditor) && field.type === 'string') {
      return (
        <InspectorBindingInputGroup endAddon={bindingToggle}>
          <div className="flex min-h-full min-w-0 flex-1 items-center px-1">
            <InspectorPropDialogField
              label={field.label}
              hideLabel
              value={readPropDisplayValue(node, field)}
              placeholder={field.placeholder}
              dialogTitle={`Edit ${field.label}`}
              onChange={(nextValue) => setProp(field.key, normalizePropValue(field, nextValue))}
              validate={field.jsonEditor ? validateJsonFieldDraft : undefined}
            />
          </div>
        </InspectorBindingInputGroup>
      );
    }

    if (field.type === 'boolean') {
      return (
        <InspectorBindingInputGroup endAddon={bindingToggle} className="!h-auto !max-h-none min-h-8">
          <div className="flex min-h-8 min-w-0 flex-1 items-center px-2">
            <UiSelect
              size="sm"
              className="w-full"
              value={node.props[field.key] === true ? 'yes' : 'no'}
              onChange={(event) => setProp(field.key, event.target.value === 'yes' ? true : undefined)}
              ariaLabel={field.label}
            >
              <option value="yes">yes</option>
              <option value="no">no</option>
            </UiSelect>
          </div>
        </InspectorBindingInputGroup>
      );
    }

    if (field.type === 'number') {
      return (
        <UiInput
          size="sm"
          className="w-full"
          type="number"
          placeholder={field.placeholder}
          value={readPropDisplayValue(node, field)}
          onChange={(event) => setProp(field.key, normalizePropValue(field, event.target.value))}
          endContent={bindingToggle}
          endContentClassName={BINDING_END_ADDON_SLOT_CLASS}
        />
      );
    }

    if (field.type === 'string') {
      const isImageAsset = field.key === 'src' || field.key === 'fallbackSrc' || field.key === 'logoSrc';
      const isIconAsset = field.key === 'icon' || field.key === 'iconName' || field.key === 'startContent' || field.key === 'endContent';
      const displayValue = readPropDisplayValue(node, field);
      return (
        <div className="flex w-full items-center gap-1.5">
          <UiInput
            size="sm"
            className="min-w-0 flex-1"
            placeholder={field.placeholder}
            value={displayValue}
            onChange={(event) => setProp(field.key, normalizePropValue(field, event.target.value))}
            endContent={bindingToggle}
            endContentClassName={BINDING_END_ADDON_SLOT_CLASS}
          />
          {isImageAsset ? (
            <>
              <AppButton
                size="sm"
                intent="secondary"
                onClick={() => setIsAssetPickerOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Browse
              </AppButton>
              <PackageWorkspaceAssetsPickerDialog
                open={isAssetPickerOpen}
                selectedPaths={[]}
                onClose={() => setIsAssetPickerOpen(false)}
                onConfirm={(paths) => {
                  if (paths[0]) {
                    setProp(field.key, `/assets/workspace/${paths[0]}`);
                  }
                }}
              />
            </>
          ) : null}
          {isIconAsset ? (
            <>
              <AppButton
                size="sm"
                intent="secondary"
                onClick={() => setIsIconPickerOpen(true)}
              >
                <Smile className="h-3.5 w-3.5" />
                Icon
              </AppButton>
              <NavigationIconPickerDialog
                open={isIconPickerOpen}
                selectedIcon={displayValue}
                onClose={() => setIsIconPickerOpen(false)}
                onSelect={(iconName) => {
                  setProp(field.key, iconName);
                }}
              />
            </>
          ) : null}
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <InspectorBindingInputGroup endAddon={bindingToggle}>
          <UiSelect
            size="sm"
            nested
            className="w-full !border-0 !shadow-none"
            value={readPropDisplayValue(node, field)}
            onChange={(event) => {
              const tailwindField = tailwindFieldByKey.get(field.key);
              if (tailwindField) {
                const currentClassName = typeof node.props.className === 'string' ? node.props.className : '';
                setProp('className', applyTailwindUtility(currentClassName, tailwindField, event.target.value));
                return;
              }

              setProp(field.key, normalizePropValue(field, event.target.value));
            }}
          >
            {(field.options ?? []).map((option) => (
              <option key={`${field.key}:${option.value || '(empty)'}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </UiSelect>
        </InspectorBindingInputGroup>
      );
    }

    return null;
  };

  return (
    <div className="designer-field-row space-y-2" {...preventInspectorDetailsToggle}>
      <div className={`flex gap-2 ${field.type === 'boolean' && !isDynamic ? 'items-start' : 'items-center'}`}>
        <InspectorFieldLabel
          text={field.label}
          // When static (not dynamically bound), a boolean field renders its own clickable
          // inline label via UiCheckboxChoice's children. Keep this label sr-only for search/a11y.
          // Once bound dynamically this becomes the only visible label.
          screenReaderOnly={field.type === 'boolean' && !isDynamic}
        />

        <div className="min-w-0 flex-1">
          {!isDynamic ? renderStaticControl() : (
            <InspectorBindingInputGroup endAddon={bindingToggle}>
              <div className="flex h-full min-w-0 items-center gap-1.5 px-2">
                {boundSourceKind ? (
                  <InspectorPropBindingSourceIndicator kind={boundSourceKind} />
                ) : null}
                <span className={`${INSPECTOR_TEXT_XS} truncate text-slate-500`}>
                  Dynamic binding
                </span>
              </div>
            </InspectorBindingInputGroup>
          )}
        </div>
      </div>

      {isDynamic && supportsRegionColumnBinding ? (
        <div className="flex flex-col gap-[2px]" {...preventInspectorDetailsToggle}>
          <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Bind value from</span>
          <UiSelect
            size="sm"
            className="w-full"
            value={valueSource}
            onChange={(event) => handleValueSourceChange(event.target.value as PropertyBindingValueSource)}
          >
            {(Object.entries(PROPERTY_BINDING_VALUE_SOURCE_LABELS) as Array<[PropertyBindingValueSource, string]>).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </UiSelect>
        </div>
      ) : null}

      {showSessionPanel ? (
        <div
          className={`flex flex-col gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 p-2.5`}
          {...preventInspectorDetailsToggle}
        >
          <div className="flex flex-col gap-[2px]">
            <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Session field</span>
            <UiSelect
              size="sm"
              nested
              className="w-full"
              value={dataPath || 'displayName'}
              onChange={(event) => {
                const nextField = event.target.value as DesignerSessionField;
                setDataPath(nextField);
                setSourceMode('session');
                setValueSource('session');
                commitSessionBinding(nextField);
              }}
            >
              {DESIGNER_SESSION_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </div>
        </div>
      ) : null}

      {showRegionColumnPanel ? (
          <div
            className={`flex flex-col gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 p-2.5`}
            {...preventInspectorDetailsToggle}
          >
            <div className="flex flex-col gap-[2px]">
              <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Record field</span>
              <UiSelect
                size="sm"
                nested
                className="w-full"
                value={regionColumn}
                onChange={(event) => {
                  const nextColumn = event.target.value;
                  setRegionColumn(nextColumn);
                  commitRegionColumnBinding(nextColumn, regionLovRef);
                }}
              >
                <option value="">Select a field…</option>
                {regionColumnFields.map((columnName) => (
                  <option key={`${node.id}:${field.key}:${columnName}`} value={columnName}>
                    {columnName}
                  </option>
                ))}
              </UiSelect>
            </div>
            {regionColumnFields.length === 0 ? (
              <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} text-amber-800`}>
                Add fields to the parent resource to enable record-field mapping.
              </p>
            ) : null}
            {supportsRegionColumnLov ? (
              <div className="flex flex-col gap-[2px]">
                <span className={`inline-flex items-center gap-0.5 ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>
                  Options source
                  {lovOptions.length === 0 ? (
                    <FieldHintTooltip
                      hint="Add an options source under Data Resources to populate this control automatically."
                      label="Options source"
                    />
                  ) : null}
                </span>
                <UiSelect
                  size="sm"
                  nested
                  className="w-full"
                  value={regionLovRef}
                  onChange={(event) => commitRegionLovRef(event.target.value)}
                >
                  <option value="">None (static options)</option>
                  {lovOptions.map((lov) => (
                    <option key={`${node.id}:${field.key}:lov:${lov.id}`} value={lov.id}>
                      {lov.name} ({lov.id})
                    </option>
                  ))}
                </UiSelect>
              </div>
            ) : null}
          </div>
        ) : showOtherBindingPanel ? (
          <InspectorPropBindingDynamicPanel
            dataPath={dataPath}
            fetchEndpoint={fetchEndpoint}
            sourceMode={sourceMode}
            dataSourceOptions={bindingDefinitions.dataSources}
            fieldKey={field.key}
            urlParams={urlParams}
            headers={headers}
            onDataPathChange={(nextValue) => {
              setDataPath(nextValue);
              commitBinding(nextValue, sourceMode, sourceMode === 'api' ? fetchEndpoint : '', urlParams, headers);
            }}
            onFetchEndpointChange={(nextValue) => {
              setFetchEndpoint(nextValue);
              if (dataPath.trim().length > 0) {
                commitBinding(dataPath, sourceMode, nextValue, urlParams, headers);
              }
            }}
            onApiSourceApply={({ dataPath: nextDataPath, fetchEndpoint: nextFetchEndpoint }) => {
              setDataPath(nextDataPath);
              setFetchEndpoint(nextFetchEndpoint);
              if (nextDataPath.trim().length > 0) {
                commitBinding(nextDataPath, 'api', nextFetchEndpoint, urlParams, headers);
              }
            }}
            onSourceModeChange={handleSourceModeChange}
            onUrlParamsChange={(nextValue) => {
              setUrlParams(nextValue);
              if (dataPath.trim().length > 0) {
                commitBinding(dataPath, sourceMode, fetchEndpoint, nextValue, headers);
              }
            }}
            onHeadersChange={(nextValue) => {
              setHeaders(nextValue);
              if (dataPath.trim().length > 0) {
                commitBinding(dataPath, sourceMode, fetchEndpoint, urlParams, nextValue);
              }
            }}
          />
        ) : null}
    </div>
  );
};
