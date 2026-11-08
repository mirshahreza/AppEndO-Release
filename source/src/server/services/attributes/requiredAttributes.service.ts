import {
  listUserAttributeRows,
  type SettingsAttributeWithValueRow,
} from '../../domain/attributes/valueRepository';
import {
  flattenMultiRoleRows,
  loadRoleRowsForRoles,
} from './sessionContext.service';
import { parseStoredAttributeValue } from './valueValidation';

export type MissingRequiredAttribute = {
  settingsAttributeId: number;
  key: string;
  scope: 'USER' | 'ROLE';
  sourceType: 'BASE_INFO' | 'CUSTOM';
  contextKey: string;
  label: string | null;
};

export const REQUIRED_ATTRIBUTES_MISSING_CODE = 'REQUIRED_ATTRIBUTES_MISSING';

/** ADMIN accounts skip required-attribute enforcement so operators can sign in to fix data. */
export const ADMIN_BYPASS_ROLES = ['ADMIN'] as const;

export const isEmptyResolvedValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const hasResolvedValue = (value: unknown): value is NonNullable<unknown> =>
  !isEmptyResolvedValue(value);

export const shouldBypassRequiredAttributes = (roles: string[]): boolean =>
  roles.some((role) => ADMIN_BYPASS_ROLES.includes(role as (typeof ADMIN_BYPASS_ROLES)[number]));

export const resolveUserScopedAttributeValue = (
  userRow: SettingsAttributeWithValueRow,
  roleRowsByKey: Map<string, SettingsAttributeWithValueRow>,
): unknown | null => {
  const userValue = parseStoredAttributeValue(userRow.value_text);
  if (hasResolvedValue(userValue)) {
    return userValue;
  }

  const roleRow = roleRowsByKey.get(userRow.key);
  if (!roleRow) {
    return null;
  }

  const roleValue = parseStoredAttributeValue(roleRow.value_text);
  return hasResolvedValue(roleValue) ? roleValue : null;
};

export const findMissingRequiredFromRows = (
  userRows: SettingsAttributeWithValueRow[],
  roleRows: SettingsAttributeWithValueRow[],
): MissingRequiredAttribute[] => {
  const missing: MissingRequiredAttribute[] = [];
  const roleRowsByKey = new Map(roleRows.map((row) => [row.key, row]));

  for (const row of userRows) {
    if (!row.is_required) continue;

    const resolved = resolveUserScopedAttributeValue(row, roleRowsByKey);
    if (hasResolvedValue(resolved)) continue;

    missing.push({
      settingsAttributeId: row.id,
      key: row.key,
      scope: 'USER',
      sourceType: row.source_type,
      contextKey: `user.${row.key}`,
      label: row.label,
    });
  }

  for (const row of roleRows) {
    if (!row.is_required) continue;

    const value = parseStoredAttributeValue(row.value_text);
    if (hasResolvedValue(value)) continue;

    missing.push({
      settingsAttributeId: row.id,
      key: row.key,
      scope: 'ROLE',
      sourceType: row.source_type as 'BASE_INFO' | 'CUSTOM',
      contextKey: `role.${row.key}`,
      label: row.label,
    });
  }

  return missing.sort((left, right) => {
    const scopeOrder = left.scope.localeCompare(right.scope);
    if (scopeOrder !== 0) return scopeOrder;
    return left.key.localeCompare(right.key);
  });
};

export async function resolveMissingRequiredAttributes(
  userId: number,
  roles: string[],
): Promise<MissingRequiredAttribute[]> {
  if (shouldBypassRequiredAttributes(roles)) {
    return [];
  }

  const orderedRoles = roles.length > 0 ? roles : ['USER'];
  const [userRows, roleRowsByPriority] = await Promise.all([
    listUserAttributeRows(userId),
    loadRoleRowsForRoles(orderedRoles),
  ]);
  const roleRows = flattenMultiRoleRows(roleRowsByPriority);

  return findMissingRequiredFromRows(userRows, roleRows);
}

export const formatMissingRequiredAttributesMessage = (
  missing: MissingRequiredAttribute[],
): string => {
  if (missing.length === 0) {
    return 'Required attributes are missing.';
  }

  const labels = missing.map((item) => item.label || item.key);
  if (labels.length === 1) {
    return `Required attribute "${labels[0]}" is missing. Contact an administrator to complete your account.`;
  }

  return `Required attributes are missing (${labels.join(', ')}). Contact an administrator to complete your account.`;
};
