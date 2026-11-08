import {
  isPresetScopeDimensionKey,
  PRESET_SCOPE_DIMENSION_KEYS,
  PRESET_SCOPE_DIMENSION_LABELS,
  PRESET_SCOPE_DIMENSION_ROOTS,
  type ScopeDimensionDef,
} from '../../../shared/api/contracts/record-policy';

/** Built-in axes only — org / geo. No workspace custom dimensions. */
export const listBuiltInScopeDimensions = (): ScopeDimensionDef[] => ([
  {
    key: PRESET_SCOPE_DIMENSION_KEYS.org,
    label: PRESET_SCOPE_DIMENSION_LABELS.org,
    topology: 'tree',
    baseInfoRootId: PRESET_SCOPE_DIMENSION_ROOTS.org,
    enabled: true,
    preset: PRESET_SCOPE_DIMENSION_KEYS.org,
  },
  {
    key: PRESET_SCOPE_DIMENSION_KEYS.geo,
    label: PRESET_SCOPE_DIMENSION_LABELS.geo,
    topology: 'tree',
    baseInfoRootId: PRESET_SCOPE_DIMENSION_ROOTS.geo,
    enabled: true,
    preset: PRESET_SCOPE_DIMENSION_KEYS.geo,
  },
]);

export const listScopeDimensions = (): ScopeDimensionDef[] => listBuiltInScopeDimensions();

export const getScopeDimension = (key: string): ScopeDimensionDef | null => {
  const trimmed = String(key || '').trim();
  if (!trimmed || !isPresetScopeDimensionKey(trimmed)) {
    return null;
  }
  return listBuiltInScopeDimensions().find((item) => item.key === trimmed) ?? null;
};
