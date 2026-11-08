export type AttributeUserEditPolicy = 'NONE' | 'WHEN_EMPTY' | 'ALWAYS';

export const ATTRIBUTE_USER_EDIT_POLICIES: AttributeUserEditPolicy[] = ['NONE', 'WHEN_EMPTY', 'ALWAYS'];

export const DEFAULT_ATTRIBUTE_USER_EDIT_POLICY: AttributeUserEditPolicy = 'WHEN_EMPTY';

export const USER_EDIT_POLICY_LABELS: Record<AttributeUserEditPolicy, string> = {
  NONE: 'Not editable',
  WHEN_EMPTY: 'Editable only when empty',
  ALWAYS: 'Always editable',
};

export const isEditablePolicy = (policy: AttributeUserEditPolicy): boolean => policy !== 'NONE';

export const isAttributeItemEditableByPolicy = (
  item: { settingsAttribute: { user_edit_policy: AttributeUserEditPolicy } },
): boolean => isEditablePolicy(item.settingsAttribute.user_edit_policy);

export const deriveUserEditableFromPolicy = (policy: AttributeUserEditPolicy): boolean =>
  policy !== 'NONE';

export const normalizeUserEditPolicy = (
  value: unknown,
  fallback: AttributeUserEditPolicy = DEFAULT_ATTRIBUTE_USER_EDIT_POLICY,
): AttributeUserEditPolicy => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NONE' || normalized === 'WHEN_EMPTY' || normalized === 'ALWAYS') {
    return normalized;
  }
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return DEFAULT_ATTRIBUTE_USER_EDIT_POLICY;
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return 'NONE';
  }
  return fallback;
};

export const hasAttributeDisplayValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export const isFieldCurrentlyEditable = (
  policy: AttributeUserEditPolicy,
  currentValue: unknown,
): boolean => {
  if (policy === 'NONE') return false;
  if (policy === 'ALWAYS') return true;
  return !hasAttributeDisplayValue(currentValue);
};

export const isAttributeValueItemEditable = (
  item: { isCurrentlyEditable?: boolean; settingsAttribute: { user_edit_policy: AttributeUserEditPolicy }; value: unknown },
): boolean => {
  if (item.isCurrentlyEditable === false) return false;
  if (item.isCurrentlyEditable === true) return true;
  return isFieldCurrentlyEditable(item.settingsAttribute.user_edit_policy, item.value);
};

export const isProfileFieldAttributeItem = (
  item: { settingsAttribute: { source_type: string; profile_field: string | null } },
): boolean =>
  item.settingsAttribute.source_type === 'PROFILE' && Boolean(item.settingsAttribute.profile_field);
