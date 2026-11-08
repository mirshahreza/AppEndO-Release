import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { SettingsAttributeSummary, AttributeValueItem } from '../../../shared/api/contracts/attributes/types';
import { fetchBaseInfoOptions } from '../../../shared/api/queries/base-info';
import { useCulture } from '../../../core/culture/CultureContext';

export const resolveBaseInfoRootId = (definition: SettingsAttributeSummary): string | null => {
  if (definition.source_type === 'BASE_INFO') {
    return definition.base_info_root_id;
  }
  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
};

const formatBooleanValue = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'true' || value === 1 || value === '1') return 'Yes';
  if (value === 'false' || value === 0 || value === '0') return 'No';
  return 'No';
};

const formatJsonValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatBaseInfoValue = (
  value: unknown,
  cardinality: SettingsAttributeSummary['cardinality'],
  labelByCode: Map<string, string>,
): string => {
  const codes = cardinality === 'multi' ? toStringArray(value) : [String(value)];
  const labels = codes
    .map((code) => labelByCode.get(code) || code)
    .filter(Boolean);

  return labels.length > 0 ? labels.join(', ') : String(value);
};

export const hasAttributeDisplayValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export const formatAttributeDisplayValue = (
  item: AttributeValueItem,
  labelByCode: Map<string, string>,
): string => {
  const { settingsAttribute, value } = item;
  if (!hasAttributeDisplayValue(value)) return '—';

  const baseInfoRootId = resolveBaseInfoRootId(settingsAttribute);
  if (baseInfoRootId) {
    return formatBaseInfoValue(value, settingsAttribute.cardinality, labelByCode);
  }

  if (settingsAttribute.data_type === 'boolean') {
    return formatBooleanValue(value);
  }

  if (settingsAttribute.cardinality === 'multi') {
    const items = toStringArray(value);
    return items.length > 0 ? items.join(', ') : String(value);
  }

  if (settingsAttribute.data_type === 'json') {
    return formatJsonValue(value);
  }

  return String(value);
};

export const useAttributeLabelMaps = (items: AttributeValueItem[]): Map<string, string> => {
  const { cultureId } = useCulture();
  const roots = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const root = resolveBaseInfoRootId(item.settingsAttribute);
      if (root) set.add(root);
    }
    return Array.from(set);
  }, [items]);

  const queries = useQueries({
    queries: roots.map((root) => ({
      queryKey: ['attribute-base-info-options', root, cultureId],
      queryFn: () => fetchBaseInfoOptions(root, cultureId),
      enabled: Boolean(root),
    })),
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    for (const query of queries) {
      for (const option of query.data ?? []) {
        map.set(option.id, option.label);
      }
    }
    return map;
  }, [queries]);
};
