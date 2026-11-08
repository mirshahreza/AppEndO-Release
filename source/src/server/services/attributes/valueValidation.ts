import { ensureBaseInfoCode } from '../../utils/baseInfoValidation';
import type { SettingsAttributeRow } from '../../domain/attributes/settingsAttributesRepository';

export type AttributeValueInput = {
  settingsAttributeId?: unknown;
  value?: unknown;
};

export type NormalizedAttributeValueInput = {
  settingsAttributeId: number;
  value: unknown | null;
};

const pickSettingsAttributeId = (input: AttributeValueInput): number | null => {
  const raw = input.settingsAttributeId;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseAttributeValuesPayload = (payload: unknown): NormalizedAttributeValueInput[] => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('values payload is required.');
  }

  const values = (payload as { values?: unknown }).values;
  if (!Array.isArray(values)) {
    throw new Error('values must be an array.');
  }

  const seen = new Set<number>();
  const normalized: NormalizedAttributeValueInput[] = [];

  for (const item of values) {
    if (!item || typeof item !== 'object') {
      throw new Error('Each value entry must be an object.');
    }

    const settingsAttributeId = pickSettingsAttributeId(item as AttributeValueInput);
    if (!settingsAttributeId) {
      throw new Error('settingsAttributeId is required for each value entry.');
    }
    if (seen.has(settingsAttributeId)) {
      throw new Error(`Duplicate settingsAttributeId ${settingsAttributeId}.`);
    }
    seen.add(settingsAttributeId);

    const value = (item as AttributeValueInput).value;
    normalized.push({
      settingsAttributeId,
      value: value === undefined ? null : value,
    });
  }

  return normalized;
};

const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const assertScalarType = (dataType: string, value: unknown, key: string) => {
  if (dataType === 'string' || dataType === 'base_info_code') {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`"${key}" must be a non-empty string.`);
    }
    return value.trim();
  }

  if (dataType === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
    throw new Error(`"${key}" must be a valid number.`);
  }

  if (dataType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    throw new Error(`"${key}" must be a boolean.`);
  }

  if (dataType === 'json') {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(`"${key}" must be valid JSON.`);
      }
    }
    if (value !== null && typeof value === 'object') return value;
    throw new Error(`"${key}" must be valid JSON.`);
  }

  throw new Error(`"${key}" has unsupported data type.`);
};

const assertMultiArray = (value: unknown, key: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`"${key}" must be an array.`);
  }
  return value;
};

export const validateAttributeValueForSettingsAttribute = async (
  settingsAttribute: SettingsAttributeRow,
  rawValue: unknown | null,
): Promise<unknown | null> => {
  if (isEmptyValue(rawValue)) {
    if (settingsAttribute.is_required) {
      throw new Error(`"${settingsAttribute.key}" is required.`);
    }
    return null;
  }

  if (settingsAttribute.cardinality === 'multi') {
    const arrayValue = assertMultiArray(rawValue, settingsAttribute.key);
    const min = settingsAttribute.min_selections;
    const max = settingsAttribute.max_selections;

    if (min !== null && arrayValue.length < min) {
      throw new Error(`"${settingsAttribute.key}" requires at least ${min} selection(s).`);
    }
    if (max !== null && arrayValue.length > max) {
      throw new Error(`"${settingsAttribute.key}" allows at most ${max} selection(s).`);
    }

    const normalizedItems: unknown[] = [];
    for (const item of arrayValue) {
      if (settingsAttribute.source_type === 'BASE_INFO') {
        const code = assertScalarType('base_info_code', item, settingsAttribute.key) as string;
        await ensureBaseInfoCode(code, settingsAttribute.base_info_root_id || '', settingsAttribute.key);
        normalizedItems.push(code);
      } else {
        normalizedItems.push(assertScalarType(settingsAttribute.data_type || 'string', item, settingsAttribute.key));
      }
    }
    return normalizedItems;
  }

  if (settingsAttribute.source_type === 'BASE_INFO') {
    const code = assertScalarType('base_info_code', rawValue, settingsAttribute.key) as string;
    await ensureBaseInfoCode(code, settingsAttribute.base_info_root_id || '', settingsAttribute.key);
    return code;
  }

  return assertScalarType(settingsAttribute.data_type || 'string', rawValue, settingsAttribute.key);
};

export const serializeAttributeValue = (value: unknown): string => JSON.stringify(value);

export const parseStoredAttributeValue = (valueText: string | null): unknown | null => {
  if (valueText === null || valueText.trim() === '') return null;
  try {
    return JSON.parse(valueText) as unknown;
  } catch {
    return valueText;
  }
};
