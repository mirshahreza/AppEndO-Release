import type { SettingsAttributeRecord } from '../../../../shared/api/contracts/attributes/types';
import { resolveAttributeLabel } from '../../../../shared/lib/attributeLabelTranslations';

import { formatDisplayDateYmd } from '../../../../shared/lib/gridDateFormat';

export const formatDateYmd = (value: string) => formatDisplayDateYmd(value);

export const getMutationError = (
  data: { success?: boolean; error?: string },
  fallback: string,
): string | null => {
  if (data.success) {
    return null;
  }
  return typeof data.error === 'string' ? data.error : fallback;
};

export const displayLabel = (record: SettingsAttributeRecord, t?: (key: string) => string) =>
  resolveAttributeLabel({
    attributeKey: record.key,
    fallbackLabel: record.label,
    t,
  });

export const displaySource = (record: SettingsAttributeRecord) => {
  if (record.source_type === 'BASE_INFO') {
    return record.base_info_root_id ? `Base Info (${record.base_info_root_id})` : 'Base Info';
  }
  return record.data_type ?? 'Custom';
};

export const toPayloadNumbers = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
};

export const isDbManagedSettingsSection = (sectionId: string) =>
  sectionId === 'user-attributes' || sectionId === 'role-attributes';

const ATTRIBUTE_KEY_ALLOWED_PATTERN = /[^a-z0-9._-]/g;

export const sanitizeAttributeKeyInput = (value: string) =>
  value.toLowerCase().replace(ATTRIBUTE_KEY_ALLOWED_PATTERN, '');

export const isValidAttributeKey = (value: string) =>
  /^[a-z0-9._-]+$/.test(value.trim());

export const displaySourceTypeLabel = (sourceType: SettingsAttributeRecord['source_type']) => {
  if (sourceType === 'BASE_INFO') return 'Base Info';
  return 'Custom';
};
