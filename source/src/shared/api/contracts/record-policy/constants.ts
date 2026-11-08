/** Workspace dirs for Record Policy Engine (p-87). */

import {
  GEO_BASE_INFO_ROOT_ID,
  ORG_BASE_INFO_ROOT_ID,
} from '../org-geo/constants';

export const RECORD_POLICY_WORKSPACE_DIR = 'record-policies';
export const RECORD_POLICY_BINDING_WORKSPACE_DIR = 'record-policy-bindings';

/** Built-in dimension keys aligned with org-geo Base Info roots (p-88). */
export const PRESET_SCOPE_DIMENSION_KEYS = {
  org: 'org',
  geo: 'geo',
} as const;

export type PresetScopeDimensionKey =
  typeof PRESET_SCOPE_DIMENSION_KEYS[keyof typeof PRESET_SCOPE_DIMENSION_KEYS];

export const isPresetScopeDimensionKey = (key: string): key is PresetScopeDimensionKey => (
  Object.values(PRESET_SCOPE_DIMENSION_KEYS).includes(key as PresetScopeDimensionKey)
);

export const PRESET_SCOPE_DIMENSION_ROOTS: Record<string, string> = {
  org: ORG_BASE_INFO_ROOT_ID,
  geo: GEO_BASE_INFO_ROOT_ID,
};

export const PRESET_SCOPE_DIMENSION_LABELS: Record<PresetScopeDimensionKey, string> = {
  org: 'Organization',
  geo: 'Geographic Divisions',
};

/** Server-context keys for built-in record-scope memberships (RPE value source). */
export const SCOPE_CONTEXT_KEY_PREFIX = 'scope.' as const;

export const scopeContextKey = (dimensionKey: string): string =>
  `${SCOPE_CONTEXT_KEY_PREFIX}${String(dimensionKey || '').trim()}`;

export const PRESET_SCOPE_CONTEXT_KEYS: Record<PresetScopeDimensionKey, string> = {
  org: scopeContextKey(PRESET_SCOPE_DIMENSION_KEYS.org),
  geo: scopeContextKey(PRESET_SCOPE_DIMENSION_KEYS.geo),
};

export const isScopeContextKey = (ref: string): boolean =>
  ref.startsWith(SCOPE_CONTEXT_KEY_PREFIX)
  && ref.length > SCOPE_CONTEXT_KEY_PREFIX.length;

export const dimensionKeyFromScopeContextKey = (ref: string): string | null => {
  if (!isScopeContextKey(ref)) return null;
  const key = ref.slice(SCOPE_CONTEXT_KEY_PREFIX.length).trim();
  return key || null;
};

export const MAX_PREDICATE_AST_NODES = 64;
export const MAX_PREDICATE_AST_DEPTH = 8;
