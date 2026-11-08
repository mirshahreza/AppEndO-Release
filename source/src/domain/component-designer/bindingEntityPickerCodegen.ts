import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import type { DesignerDocument } from './types';
import { readString } from './runtimeShared';

export type EntityPickerCodegenConfig = {
  nodeId: string;
  entityRef: string;
  searchParam: string;
  returnField: string;
  displayField: string;
  itemsVar: string;
  loadingVar: string;
  loadOptionsVar: string;
};

const sanitizeCodegenIdentifier = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, '_');

export const createEntityPickerHookNames = (nodeId: string): Pick<EntityPickerCodegenConfig, 'itemsVar' | 'loadingVar' | 'loadOptionsVar'> => {
  const suffix = sanitizeCodegenIdentifier(nodeId);
  return {
    itemsVar: `entityPickerItems_${suffix}`,
    loadingVar: `entityPickerLoading_${suffix}`,
    loadOptionsVar: `loadEntityPickerOptions_${suffix}`,
  };
};

export const collectEntityPickerConfigs = (document: DesignerDocument): EntityPickerCodegenConfig[] => {
  const configs: EntityPickerCodegenConfig[] = [];

  for (const node of Object.values(document.nodes)) {
    if (node.layout.visible === false) {
      continue;
    }

    const paletteItemId = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
    if (paletteItemId !== 'heroui.entity-picker') {
      continue;
    }

    const entityRef = readString(node.props.entityRef);
    if (!entityRef) {
      continue;
    }

    const hookNames = createEntityPickerHookNames(node.id);
    configs.push({
      nodeId: node.id,
      entityRef,
      searchParam: readString(node.props.searchParam, 'search'),
      returnField: readString(node.props.returnField, 'id'),
      displayField: readString(node.props.displayField, 'label'),
      ...hookNames,
    });
  }

  return configs;
};

export const renderEntityPickerRuntimeHelper = (): string[] => [
  'type EntityPickerOption = { id: string; textValue: string };',
  'type EntityPickerFieldMapping = { returnField: string; displayField: string };',
  '',
  'function normalizeEntityPickerItems(payload: unknown, mapping?: EntityPickerFieldMapping): EntityPickerOption[] {',
  '  const returnField = mapping?.returnField?.trim() || "id";',
  '  const displayField = mapping?.displayField?.trim() || "label";',
  '  if (Array.isArray(payload)) {',
  '    return payload',
  '      .map((entry) => {',
  '        if (!entry || typeof entry !== "object") {',
  '          return null;',
  '        }',
  '        const record = entry as Record<string, unknown>;',
  '        const mappedId = record[returnField];',
  '        const id = typeof mappedId === "string" && mappedId.trim()',
  '          ? mappedId.trim()',
  '          : typeof record.id === "string" && record.id.trim()',
  '            ? record.id.trim()',
  '            : typeof record.value === "string" && record.value.trim()',
  '              ? record.value.trim()',
  '              : "";',
  '        const mappedLabel = record[displayField];',
  '        const textValue = typeof mappedLabel === "string" && mappedLabel.trim()',
  '          ? mappedLabel.trim()',
  '          : typeof record.textValue === "string" && record.textValue.trim()',
  '            ? record.textValue.trim()',
  '            : typeof record.label === "string" && record.label.trim()',
  '              ? record.label.trim()',
  '              : typeof record.name === "string" && record.name.trim()',
  '                ? record.name.trim()',
  '                : id;',
  '        if (!id || !textValue) {',
  '          return null;',
  '        }',
  '        return { id, textValue };',
  '      })',
  '      .filter((entry): entry is EntityPickerOption => entry !== null);',
  '  }',
  '',
  '  if (payload && typeof payload === "object") {',
  '    const record = payload as Record<string, unknown>;',
  '    const items = record.items ?? record.results ?? record.data;',
  '    return normalizeEntityPickerItems(items, mapping);',
  '  }',
  '',
  '  return [];',
  '}',
  '',
  'function useEntityPickerOptions(entityRef: string, searchParam: string, mapping?: EntityPickerFieldMapping) {',
  '  const [items, setItems] = React.useState<EntityPickerOption[]>([]);',
  '  const [isLoading, setIsLoading] = React.useState(false);',
  '',
  '  const loadOptions = React.useCallback(async (query: string) => {',
  '    if (!entityRef) {',
  '      setItems([]);',
  '      return;',
  '    }',
  '',
  '    setIsLoading(true);',
  '    try {',
  '      const url = entityRef.startsWith("http")',
  '        ? new URL(entityRef)',
  '        : new URL(entityRef, window.location.origin);',
  '      // Option A (parity audit items 31/32): Autocomplete is Select-based — no live typing.',
  '      // Still honour an explicit non-empty query if a caller passes one, but initial load uses "".',
  '      if (query.trim()) {',
  '        url.searchParams.set(searchParam, query);',
  '      }',
  '      const response = await fetch(url.toString());',
  '      if (!response.ok) {',
  '        throw new Error(await parseApiErrorMessage(response));',
  '      }',
  '      const payload = await response.json();',
  '      setItems(normalizeEntityPickerItems(payload, mapping));',
  '    } catch {',
  '      setItems([]);',
  '    } finally {',
  '      setIsLoading(false);',
  '    }',
  '  }, [entityRef, searchParam, mapping?.returnField, mapping?.displayField]);',
  '',
  '  React.useEffect(() => {',
  '    void loadOptions("");',
  '  }, [loadOptions]);',
  '',
  '  return { items, isLoading, loadOptions };',
  '}',
];

export const renderEntityPickerHookLines = (config: EntityPickerCodegenConfig): string[] => {
  const mappingLiteral = `{ returnField: ${JSON.stringify(config.returnField)}, displayField: ${JSON.stringify(config.displayField)} }`;
  return [
    `  const { items: ${config.itemsVar}, isLoading: ${config.loadingVar}, loadOptions: ${config.loadOptionsVar} } = useEntityPickerOptions(${JSON.stringify(config.entityRef)}, ${JSON.stringify(config.searchParam)}, ${mappingLiteral});`,
  ];
};

/**
 * Search-change handler emitted alongside each entity-picker hook. Shared so Export handler
 * generation cannot diverge from the naming used by `renderEntityPickerCustomJsx`.
 */
export const renderEntityPickerSearchHandlerLines = (config: EntityPickerCodegenConfig): string[] => {
  const handlerName = `handleEntitySearch_${sanitizeCodegenIdentifier(config.nodeId)}`;
  return [
    `  const ${handlerName} = React.useCallback((nextValue: string) => {`,
    `    void ${config.loadOptionsVar}(nextValue);`,
    `  }, [${config.loadOptionsVar}]);`,
  ];
};

export const resolveEntityPickerConfig = (
  nodeId: string,
  configs: EntityPickerCodegenConfig[],
): EntityPickerCodegenConfig | undefined =>
  configs.find((config) => config.nodeId === nodeId);
