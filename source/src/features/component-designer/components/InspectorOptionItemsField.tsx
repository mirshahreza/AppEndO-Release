import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerNode } from '../../../domain/component-designer/types';
import {
  createPropertyBindingDefinition,
  getNodePropertyBinding,
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
  DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS,
  normalizeDesignerOptionItems,
  serializeDesignerAutocompleteItems,
  type DesignerAutocompleteItem,
} from '../../../domain/component-designer/designerAutocompleteItems';
import { AppButton, UiInput, UiSelect } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';
import { InspectorBindingRequestConfig } from './InspectorBindingRequestConfig';
import { InspectorPropBindingToggle } from './InspectorPropBindingControl';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  resolvePropertyBindingSourceMode,
  type PropertyBindingSourceMode,
} from './inspectorBindingUi';
import {
  resolveDesignerChoiceGroupOptionsSource,
  type DesignerChoiceGroupOptionsSource,
} from '../../../domain/component-designer/designerChoiceGroupOptions';
import { getNodePaletteItemId } from '../../../domain/component-designer/runtimeShared';
import {
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorOptionItemsFieldProps = {
  node: DesignerNode;
  bindingDefinitions: DesignerBindingDefinitions;
  label?: string;
  dispatch: React.Dispatch<DesignerAction>;
};

const readStaticItems = (node: DesignerNode): DesignerAutocompleteItem[] => {
  const normalized = normalizeDesignerOptionItems(node.props.items);
  return normalized.length > 0 ? normalized : [...DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS];
};

export const InspectorOptionItemsField: React.FC<InspectorOptionItemsFieldProps> = ({
  node,
  bindingDefinitions,
  label = 'Options',
  dispatch,
}) => {
  const paletteItemId = getNodePaletteItemId(node);
  const isChoiceGroup = paletteItemId === 'heroui.checkbox-group' || paletteItemId === 'heroui.radio-group';
  const optionsSource: DesignerChoiceGroupOptionsSource | null = isChoiceGroup
    ? resolveDesignerChoiceGroupOptionsSource(node)
    : null;
  const forceDynamicEditor = isChoiceGroup && optionsSource !== 'static';
  const bindingKey = propertyBindingKeyForProp('items');
  const existing = getNodePropertyBinding(node, 'items');
  const storeBinding = getNodeStoreReadBindingForProp(node, 'items');
  const hasBinding = Boolean(existing || storeBinding);
  const lovOptions = Object.values(bindingDefinitions.lovs);
  const [showDynamicEditor, setShowDynamicEditor] = React.useState(hasBinding || forceDynamicEditor);
  const [staticItems, setStaticItems] = React.useState<DesignerAutocompleteItem[]>(() => readStaticItems(node));
  const [dataPath, setDataPath] = React.useState(() => {
    if (storeBinding) {
      return storeBinding.storePath;
    }

    return existing ? resolvePropertyBindingDataPath(existing.definition) ?? '' : '';
  });
  const [lovRef, setLovRef] = React.useState(existing?.definition.lovRef ?? '');
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
      Boolean(storeBinding),
      existing?.definition.lovRef,
    ),
  );

  React.useEffect(() => {
    setStaticItems(readStaticItems(node));
    const nextProperty = getNodePropertyBinding(node, 'items');
    const nextStore = getNodeStoreReadBindingForProp(node, 'items');
    const nextHasBinding = Boolean(nextProperty || nextStore);
    const nextForceDynamic = isChoiceGroup && resolveDesignerChoiceGroupOptionsSource(node) !== 'static';
    setShowDynamicEditor(nextHasBinding || nextForceDynamic);
    setDataPath(
      nextStore
        ? nextStore.storePath
        : nextProperty
          ? resolvePropertyBindingDataPath(nextProperty.definition) ?? ''
          : '',
    );
    setLovRef(nextProperty?.definition.lovRef ?? '');
    setFetchEndpoint(nextProperty?.definition.fetchEndpoint ?? '');
    setUrlParams(nextProperty ? resolveBindingUrlParams(nextProperty.definition) : {});
    setHeaders(nextProperty ? resolveBindingRequestHeaders(nextProperty.definition) : {});
    setSourceMode(resolvePropertyBindingSourceMode(
      nextProperty?.definition.fetchEndpoint ?? '',
      Boolean(nextStore),
      nextProperty?.definition.lovRef,
    ));
  }, [isChoiceGroup, node.id, node.props.items, node.props.optionsSource, node.binding]);

  const persistStaticItems = React.useCallback((nextItems: DesignerAutocompleteItem[]) => {
    dispatch({
      type: 'set-node-prop',
      nodeId: node.id,
      key: 'items',
      value: serializeDesignerAutocompleteItems(nextItems),
    });
  }, [dispatch, node.id]);

  const removePropertyBinding = React.useCallback(() => {
    dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey });
  }, [bindingKey, dispatch, node.id]);

  const removeStoreBinding = React.useCallback(() => {
    const currentStore = getNodeStoreReadBindingForProp(node, 'items');
    if (currentStore) {
      dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey: currentStore.bindingKey });
    }
  }, [dispatch, node]);

  const commitBinding = React.useCallback((
    nextDataPath: string,
    nextSourceMode: PropertyBindingSourceMode,
    nextLovRef: string,
    nextFetchEndpoint: string,
    nextUrlParams: Record<string, string>,
    nextHeaders: Record<string, string>,
  ) => {
    const trimmedPath = nextDataPath.trim();

    if (trimmedPath.length === 0) {
      removePropertyBinding();
      removeStoreBinding();
      return;
    }

    if (nextSourceMode === 'store') {
      removePropertyBinding();
      const currentStore = getNodeStoreReadBindingForProp(node, 'items');
      const storeBindingDefinition = createStoreReadBindingDefinition('items', trimmedPath);
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

    removeStoreBinding();
    const trimmedLovRef = nextLovRef.trim();
    const trimmedEndpoint = nextFetchEndpoint.trim();
    const useLov = nextSourceMode === 'api' && trimmedLovRef.length > 0;

    dispatch({
      type: 'set-node-binding',
      nodeId: node.id,
      bindingKey,
      definition: createPropertyBindingDefinition('items', trimmedPath, {
        lovRef: useLov ? trimmedLovRef : undefined,
        fetchEndpoint: !useLov && trimmedEndpoint.length > 0 ? trimmedEndpoint : undefined,
        urlParams: !useLov && trimmedEndpoint.length > 0 ? nextUrlParams : undefined,
        headers: !useLov && trimmedEndpoint.length > 0 ? nextHeaders : undefined,
      }),
    });
  }, [bindingKey, dispatch, node, removePropertyBinding, removeStoreBinding]);

  const handleToggleDynamic = () => {
    if (forceDynamicEditor) {
      return;
    }

    if (hasBinding) {
      removePropertyBinding();
      removeStoreBinding();
      setShowDynamicEditor(false);
      return;
    }

    setShowDynamicEditor(true);
  };

  const updateStaticItem = (index: number, patch: Partial<DesignerAutocompleteItem>) => {
    const nextItems = staticItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));
    setStaticItems(nextItems);
    persistStaticItems(nextItems);
  };

  const addStaticItem = () => {
    const nextIndex = staticItems.length + 1;
    const nextItems = [
      ...staticItems,
      { id: `option-${nextIndex}`, textValue: `Option ${nextIndex}` },
    ];
    setStaticItems(nextItems);
    persistStaticItems(nextItems);
  };

  const removeStaticItem = (index: number) => {
    const nextItems = staticItems.filter((_, itemIndex) => itemIndex !== index);
    const safeItems = nextItems.length > 0 ? nextItems : [...DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS];
    setStaticItems(safeItems);
    persistStaticItems(safeItems);
  };

  const commitCurrentBinding = React.useCallback((
    nextSourceMode = sourceMode,
    nextLovRef = lovRef,
    nextFetchEndpoint = fetchEndpoint,
    nextUrlParams = urlParams,
    nextHeaders = headers,
    nextDataPathValue = dataPath,
  ) => {
    if (nextDataPathValue.trim().length > 0) {
      commitBinding(
        nextDataPathValue,
        nextSourceMode,
        nextLovRef,
        nextFetchEndpoint,
        nextUrlParams,
        nextHeaders,
      );
    }
  }, [commitBinding, dataPath, fetchEndpoint, headers, lovRef, sourceMode, urlParams]);

  return (
    <DesignerFieldRow label={label} align="start">
      <div className="flex w-full flex-col gap-2" {...preventInspectorDetailsToggle}>
        {(!isChoiceGroup || optionsSource === 'static') ? (
          <div className="flex items-center justify-end">
            <InspectorPropBindingToggle
              active={showDynamicEditor}
              fieldLabel={label}
              onToggle={handleToggleDynamic}
            />
          </div>
        ) : null}

        {showDynamicEditor ? (
          <div className={`flex flex-col gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/80 p-2.5`}>
            <div className="flex flex-col gap-[2px]">
              <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Source Type</span>
              <UiSelect
                size="sm"
                nested
                value={sourceMode}
                onChange={(event) => {
                  const mode = event.target.value as PropertyBindingSourceMode;
                  setSourceMode(mode);
                  commitCurrentBinding(mode, lovRef, fetchEndpoint, urlParams, headers);
                }}
              >
                <option value="state">Data Context</option>
                <option value="store">Global Store</option>
                <option value="api">API / Shared LOV</option>
              </UiSelect>
            </div>

            <div className="flex flex-col gap-[2px]">
              <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>{sourceMode === 'store' ? 'Store Path' : 'Data Path'}</span>
              <UiInput
                size="sm"
                nested
                className="w-full"
                placeholder={sourceMode === 'store' ? 'selection.countryId' : 'items'}
                value={dataPath}
                onChange={(event) => {
                  const nextPath = event.target.value;
                  setDataPath(nextPath);
                  commitBinding(nextPath, sourceMode, lovRef, fetchEndpoint, urlParams, headers);
                }}
              />
            </div>

            {sourceMode === 'api' ? (
              <>
                <div className="flex flex-col gap-[2px]">
                  <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Shared LOV</span>
                  <UiSelect
                    size="sm"
                    nested
                    className="w-full"
                    value={lovRef}
                    onChange={(event) => {
                      const nextLovRef = event.target.value;
                      setLovRef(nextLovRef);
                      commitCurrentBinding(sourceMode, nextLovRef, fetchEndpoint, urlParams, headers);
                    }}
                  >
                    <option value="">Select a shared LOV…</option>
                    {lovOptions.map((lov) => (
                      <option key={lov.id} value={lov.id}>
                        {lov.name} ({lov.id})
                      </option>
                    ))}
                  </UiSelect>
                </div>

                {lovRef.trim().length === 0 ? (
                  <>
                    <div className="flex flex-col gap-[2px]">
                      <span className={`ps-[4px] ${INSPECTOR_TEXT_SM} text-slate-500`}>Custom GET Endpoint</span>
                      <UiInput
                        size="sm"
                        nested
                        className="w-full"
                        placeholder="/api/base-info/options?root=100.1&lang=en"
                        value={fetchEndpoint}
                        onChange={(event) => {
                          const nextEndpoint = event.target.value;
                          setFetchEndpoint(nextEndpoint);
                          commitCurrentBinding(sourceMode, lovRef, nextEndpoint, urlParams, headers);
                        }}
                      />
                    </div>

                    <InspectorBindingRequestConfig
                      endpoint={fetchEndpoint}
                      urlParams={urlParams}
                      headers={headers}
                      onUrlParamsChange={(nextParams) => {
                        setUrlParams(nextParams);
                        commitCurrentBinding(sourceMode, lovRef, fetchEndpoint, nextParams, headers);
                      }}
                      onHeadersChange={(nextHeaders) => {
                        setHeaders(nextHeaders);
                        commitCurrentBinding(sourceMode, lovRef, fetchEndpoint, urlParams, nextHeaders);
                      }}
                    />
                  </>
                ) : (
                  <p className={`rounded-md border border-indigo-100 bg-indigo-50/70 px-2 py-1.5 ${INSPECTOR_TEXT_XS} text-indigo-700`}>
                    Fetch endpoint and column mapping come from the selected shared LOV.
                  </p>
                )}
              </>
            ) : null}
          </div>
        ) : null}

        {!hasBinding ? (
          <div className={`space-y-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
            {staticItems.map((item, index) => (
              <div key={`${node.id}:option:${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_28px] items-center gap-2">
                <UiInput
                  size="sm"
                  nested
                  placeholder="id"
                  value={item.id}
                  onChange={(event) => updateStaticItem(index, { id: event.target.value })}
                />
                <UiInput
                  size="sm"
                  nested
                  placeholder="Label"
                  value={item.textValue}
                  onChange={(event) => updateStaticItem(index, { textValue: event.target.value })}
                />
                <AppButton
                  type="button"
                  size="icon-sm"
                  intent="destructive-soft"
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() => removeStaticItem(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </AppButton>
              </div>
            ))}

            <AppButton type="button" size="sm" intent="secondary" className="w-full" onClick={addStaticItem}>
              <Plus className="h-3.5 w-3.5" />
              Add option
            </AppButton>
          </div>
        ) : null}
      </div>
    </DesignerFieldRow>
  );
};
