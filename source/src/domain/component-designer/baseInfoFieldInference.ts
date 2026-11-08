/**
 * Maps API/body field names that store base_info codes to their list-root ids.
 * Used by auto-form scaffolding to pick Select + /api/base-info/options LOV wiring.
 */
export const BASE_INFO_FIELD_ROOT_BY_NAME: Record<string, string> = {
  gender_code: '100.1',
  person_type_code: '100.2',
  type: '100.3',
  subject_id: '100.3',
  feedback_subject: '100.3',
};

export const resolveBaseInfoRootForField = (fieldName: string): string | null => {
  const normalized = fieldName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return BASE_INFO_FIELD_ROOT_BY_NAME[normalized] ?? null;
};

export const buildBaseInfoOptionsEndpoint = (rootId: string, lang = 'fa'): string => (
  `/api/base-info/options?root=${encodeURIComponent(rootId)}&lang=${encodeURIComponent(lang)}`
);

export const lovIdForBaseInfoField = (fieldName: string): string => {
  const normalized = fieldName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `${normalized || 'baseInfo'}Options`;
};

export const isBaseInfoCodeField = (fieldName: string): boolean =>
  resolveBaseInfoRootForField(fieldName) !== null;
