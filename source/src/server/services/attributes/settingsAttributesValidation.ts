export type AttributeScope = 'USER' | 'ROLE';
export type AttributeSourceType = 'BASE_INFO' | 'CUSTOM';
export type AttributeDataType = 'string' | 'number' | 'boolean' | 'json' | 'base_info_code';
export type AttributeCardinality = 'single' | 'multi';
export type AttributeVisibility = 'SERVER' | 'CLIENT' | 'BOTH' | 'NONE';

import {
  DEFAULT_ATTRIBUTE_USER_EDIT_POLICY,
  deriveUserEditableFromPolicy,
  normalizeUserEditPolicy,
  type AttributeUserEditPolicy,
} from '../../../shared/api/contracts/attributes/editPolicy';
import { HttpError } from '../../errors/HttpError';

export type SettingsAttributePayload = {
  key?: unknown;
  label?: unknown;
  scope?: unknown;
  sourceType?: unknown;
  source_type?: unknown;
  baseInfoRootId?: unknown;
  base_info_root_id?: unknown;
  profileField?: unknown;
  profile_field?: unknown;
  dataType?: unknown;
  data_type?: unknown;
  cardinality?: unknown;
  minSelections?: unknown;
  min_selections?: unknown;
  maxSelections?: unknown;
  max_selections?: unknown;
  visibility?: unknown;
  isRequired?: unknown;
  is_required?: unknown;
  isActive?: unknown;
  is_active?: unknown;
  userEditable?: unknown;
  user_editable?: unknown;
  userEditPolicy?: unknown;
  user_edit_policy?: unknown;
  viewOrder?: unknown;
  view_order?: unknown;
};

export type NormalizedSettingsAttributeInput = {
  key: string;
  label: string | null;
  scope: AttributeScope;
  sourceType: AttributeSourceType;
  baseInfoRootId: string | null;
  profileField: string | null;
  dataType: AttributeDataType | null;
  cardinality: AttributeCardinality;
  minSelections: number | null;
  maxSelections: number | null;
  visibility: AttributeVisibility;
  isRequired: boolean;
  isActive: boolean;
  userEditable: boolean;
  userEditPolicy: AttributeUserEditPolicy;
  viewOrder: number;
};

const KEY_PATTERN = /^[a-z0-9._-]+$/;
const SCOPES = new Set<AttributeScope>(['USER', 'ROLE']);
const SOURCE_TYPES = new Set<AttributeSourceType>(['BASE_INFO', 'CUSTOM']);
const DATA_TYPES = new Set<AttributeDataType>(['string', 'number', 'boolean', 'json', 'base_info_code']);
const CARDINALITIES = new Set<AttributeCardinality>(['single', 'multi']);
const VISIBILITIES = new Set<AttributeVisibility>(['SERVER', 'CLIENT', 'BOTH']);

const toOptionalTrimmed = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
};

const toOptionalInteger = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
};

const toViewOrder = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickField = <T>(payload: SettingsAttributePayload, camel: keyof SettingsAttributePayload, snake: keyof SettingsAttributePayload): T | undefined => {
  if (payload[camel] !== undefined) return payload[camel] as T;
  if (payload[snake] !== undefined) return payload[snake] as T;
  return undefined;
};

const resolveUserEditPolicy = (
  payload: SettingsAttributePayload,
  scope: AttributeScope,
): AttributeUserEditPolicy => {
  if (scope !== 'USER') {
    return 'NONE';
  }

  const explicitPolicy = pickField(payload, 'userEditPolicy', 'user_edit_policy');
  if (explicitPolicy !== undefined) {
    return normalizeUserEditPolicy(explicitPolicy, DEFAULT_ATTRIBUTE_USER_EDIT_POLICY);
  }

  if (pickField(payload, 'userEditable', 'user_editable') !== undefined) {
    return normalizeUserEditPolicy(pickField(payload, 'userEditable', 'user_editable'), 'NONE');
  }

  return DEFAULT_ATTRIBUTE_USER_EDIT_POLICY;
};

export const normalizeAttributeScope = (value: unknown): AttributeScope | null => {
  const normalized = String(value || '').trim().toUpperCase();
  return SCOPES.has(normalized as AttributeScope) ? normalized as AttributeScope : null;
};

export const validateSettingsAttributePayload = (
  payload: SettingsAttributePayload,
  options: { scope?: AttributeScope; requireScope?: boolean } = {},
): NormalizedSettingsAttributeInput => {
  const scope = options.scope ?? normalizeAttributeScope(payload.scope);
  if (!scope) {
    throw new HttpError(400, options.requireScope === false ? 'scope is invalid.' : 'scope is required.');
  }

  const key = toOptionalTrimmed(payload.key)?.toLowerCase() ?? '';
  if (!key) {
    throw new HttpError(400, 'key is required.');
  }
  if (!KEY_PATTERN.test(key)) {
    throw new HttpError(400, 'key may only contain lowercase letters, numbers, dash, underscore, and dot.');
  }

  const sourceTypeRaw = String(pickField(payload, 'sourceType', 'source_type') || '').trim().toUpperCase();
  if (sourceTypeRaw === 'PROFILE') {
    throw new HttpError(400, 'Profile fields are managed separately in Profile Fields settings.');
  }
  if (!SOURCE_TYPES.has(sourceTypeRaw as AttributeSourceType)) {
    throw new HttpError(400, 'sourceType must be BASE_INFO or CUSTOM.');
  }
  const sourceType = sourceTypeRaw as AttributeSourceType;

  const cardinalityRaw = String(payload.cardinality || 'single').trim().toLowerCase();
  if (!CARDINALITIES.has(cardinalityRaw as AttributeCardinality)) {
    throw new HttpError(400, 'cardinality must be single or multi.');
  }
  let cardinality = cardinalityRaw as AttributeCardinality;

  const visibilityRaw = String(payload.visibility || 'BOTH').trim().toUpperCase();
  if (!VISIBILITIES.has(visibilityRaw as AttributeVisibility)) {
    throw new HttpError(400, 'visibility must be SERVER, CLIENT, or BOTH.');
  }
  const visibility = visibilityRaw as AttributeVisibility;

  const baseInfoRootId = toOptionalTrimmed(pickField(payload, 'baseInfoRootId', 'base_info_root_id'));
  const dataTypeRaw = toOptionalTrimmed(pickField(payload, 'dataType', 'data_type'));
  let dataType: AttributeDataType | null = null;

  if (sourceType === 'BASE_INFO') {
    if (!baseInfoRootId) {
      throw new HttpError(400, 'baseInfoRootId is required for BASE_INFO attributes.');
    }
    dataType = 'base_info_code';
  } else {
    if (!dataTypeRaw || !DATA_TYPES.has(dataTypeRaw as AttributeDataType) || dataTypeRaw === 'base_info_code') {
      throw new HttpError(400, 'dataType must be string, number, boolean, or json for CUSTOM attributes.');
    }
    dataType = dataTypeRaw as AttributeDataType;
    // Custom attributes are typed scalars — selection cardinality only applies to BASE_INFO.
    cardinality = 'single';
  }

  let minSelections = toOptionalInteger(pickField(payload, 'minSelections', 'min_selections'));
  let maxSelections = toOptionalInteger(pickField(payload, 'maxSelections', 'max_selections'));

  if (cardinality === 'single') {
    minSelections = null;
    maxSelections = null;
  } else {
    if (minSelections !== null && minSelections < 0) {
      throw new HttpError(400, 'minSelections must be zero or greater.');
    }
    if (maxSelections !== null && maxSelections < 1) {
      throw new HttpError(400, 'maxSelections must be at least 1.');
    }
    if (minSelections !== null && maxSelections !== null && minSelections > maxSelections) {
      throw new HttpError(400, 'minSelections cannot exceed maxSelections.');
    }
  }

  const userEditPolicy = resolveUserEditPolicy(payload, scope);

  return {
    key,
    label: toOptionalTrimmed(payload.label),
    scope,
    sourceType,
    baseInfoRootId: sourceType === 'BASE_INFO' ? baseInfoRootId : null,
    profileField: null,
    dataType,
    cardinality,
    minSelections,
    maxSelections,
    visibility,
    isRequired: toBoolean(pickField(payload, 'isRequired', 'is_required'), false),
    isActive: toBoolean(pickField(payload, 'isActive', 'is_active'), true),
    userEditPolicy,
    userEditable: deriveUserEditableFromPolicy(userEditPolicy),
    viewOrder: toViewOrder(pickField(payload, 'viewOrder', 'view_order')),
  };
};
