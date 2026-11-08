import { listBaseInfoOptionsRows } from '../../domain/base-info/treeRepository';
import {
  listUserAttributeRows,
  type SettingsAttributeWithValueRow,
} from '../../domain/attributes/valueRepository';
import { listActiveProfileFieldSettingRows } from '../../domain/profile/profileFieldSettingsRepository';
import type { AttributeSummaryItem } from '../../../shared/api/contracts/attributes/types';
import { isEditablePolicy } from '../../../shared/api/contracts/attributes/editPolicy';
import { isSystemManagedUserAttributeKey } from '../../../shared/api/contracts/attributes/builtInAttributes';
import { resolveBaseInfoCultureIdFromQuery } from '../../utils/baseInfoHelpers';
import { BASE_INFO_ROOT_GENDER, BASE_INFO_ROOT_PERSON_TYPE } from '../../utils/profilePayload';
import { getSessionContextForUser } from './sessionContext.service';
import type { AllowedProfileField } from './profileFields';

const PROFILE_FIELDS_SHOWN_IN_PERSONAL_DETAILS = new Set<AllowedProfileField>([
  'firstname',
  'lastname',
  'phone',
]);

const PROFILE_FIELD_BASE_INFO_ROOT: Partial<Record<AllowedProfileField, string>> = {
  gender_code: BASE_INFO_ROOT_GENDER,
  person_type_code: BASE_INFO_ROOT_PERSON_TYPE,
};

const getDefinitionLabel = (row: {
  label: string | null;
  key: string;
}): string => row.label || row.key;

const hasDisplayValue = (value: unknown): value is NonNullable<unknown> => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
};

const formatBooleanValue = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'true' || value === 1 || value === '1') return 'Yes';
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

const buildBaseInfoLabelMap = async (rootIds: string[]): Promise<Map<string, string>> => {
  const cultureId = resolveBaseInfoCultureIdFromQuery('en');
  const labelByCode = new Map<string, string>();

  await Promise.all(rootIds.map(async (rootId) => {
    const rows = await listBaseInfoOptionsRows(
      cultureId,
      'AND i.is_active = TRUE',
      'AND (i.id = ? OR i.parent_id = ?)',
      [rootId, rootId],
    );

    for (const row of rows) {
      const code = String(row.id ?? '').trim();
      const label = String(row.label ?? row.title ?? code).trim();
      if (code) {
        labelByCode.set(code, label || code);
      }
    }
  }));

  return labelByCode;
};

const formatBaseInfoValue = (
  value: unknown,
  cardinality: SettingsAttributeWithValueRow['cardinality'],
  labelByCode: Map<string, string>,
): string => {
  const codes = cardinality === 'multi' ? toStringArray(value) : [String(value)];
  const labels = codes
    .map((code) => labelByCode.get(code) || code)
    .filter(Boolean);

  return labels.length > 0 ? labels.join(', ') : String(value);
};

const formatDisplayValue = (
  settingsAttribute: Pick<
    SettingsAttributeWithValueRow,
    'source_type' | 'data_type' | 'cardinality' | 'base_info_root_id'
  >,
  value: unknown,
  labelByCode: Map<string, string>,
): string => {
  if (settingsAttribute.source_type === 'BASE_INFO') {
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

export async function getClientAttributeSummary(userId: number): Promise<AttributeSummaryItem[]> {
  const [sessionContext, userDefinitions, profileFieldSettings] = await Promise.all([
    getSessionContextForUser(userId),
    listUserAttributeRows(userId),
    listActiveProfileFieldSettingRows(),
  ]);

  const displayContext = {
    ...sessionContext.serverContext,
    ...sessionContext.clientContext,
  };
  const baseInfoRootIds = Array.from(new Set([
    ...userDefinitions
      .filter((row) => row.source_type === 'BASE_INFO' && row.base_info_root_id)
      .map((row) => String(row.base_info_root_id)),
    BASE_INFO_ROOT_GENDER,
    BASE_INFO_ROOT_PERSON_TYPE,
  ]));

  const labelByCode = await buildBaseInfoLabelMap(baseInfoRootIds);

  const summaryItems: AttributeSummaryItem[] = [];

  for (const definition of userDefinitions) {
    if (isEditablePolicy(definition.user_edit_policy)) continue;
    if (isSystemManagedUserAttributeKey(definition.key)) continue;

    const contextKey = `user.${definition.key}`;
    const value = displayContext[contextKey];
    if (!hasDisplayValue(value)) continue;

    summaryItems.push({
      key: definition.key,
      label: getDefinitionLabel(definition),
      displayValue: formatDisplayValue(definition, value, labelByCode),
      view_order: Number(definition.view_order) || 0,
    });
  }

  for (const setting of profileFieldSettings) {
    if (isEditablePolicy(setting.user_edit_policy)) continue;

    const profileField = setting.profile_field as AllowedProfileField;
    if (PROFILE_FIELDS_SHOWN_IN_PERSONAL_DETAILS.has(profileField)) continue;

    const contextKey = `user.${setting.context_key}`;
    const value = displayContext[contextKey];
    if (!hasDisplayValue(value)) continue;

    const baseInfoRoot = PROFILE_FIELD_BASE_INFO_ROOT[profileField];
    const displayValue = profileField === 'profile_image'
      ? (value ? 'Uploaded' : '')
      : baseInfoRoot
        ? formatBaseInfoValue(value, 'single', labelByCode)
        : String(value);

    summaryItems.push({
      key: setting.context_key,
      label: setting.label_en || setting.context_key,
      displayValue,
      view_order: Number(setting.view_order) || 0,
    });
  }

  return summaryItems.sort((left, right) => {
    const orderDiff = left.view_order - right.view_order;
    if (orderDiff !== 0) return orderDiff;
    return left.label.localeCompare(right.label);
  });
}
