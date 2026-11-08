import type {
  AttributeCardinality,
  SettingsAttributeRecord,
  AttributeScope,
  AttributeSourceType,
  AttributeUserEditPolicy,
  AttributeVisibility,
} from '../../../../shared/api/contracts/attributes/types';
import type { EMPTY_SETTINGS_ATTRIBUTE_FORM } from './constants';

export type SettingsAttributeSortField = 'view_order' | 'key' | 'created_at';
export type ActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export type SettingsAttributeFormState = {
  key: string;
  label: string;
  sourceType: AttributeSourceType;
  baseInfoRootId: string;
  profileField: string;
  dataType: 'string' | 'number' | 'boolean' | 'json';
  cardinality: AttributeCardinality;
  minSelections: string;
  maxSelections: string;
  visibility: AttributeVisibility;
  isRequired: boolean;
  isActive: boolean;
  userEditable: boolean;
  userEditPolicy: AttributeUserEditPolicy;
  viewOrder: string;
};

export type ToastState = { type: 'success' | 'error'; text: string };

export type SettingsAttributesSectionProps = {
  scope: AttributeScope;
  title: string;
};

export const formFromRecord = (record: SettingsAttributeRecord): SettingsAttributeFormState => ({
  key: record.key,
  label: record.label ?? '',
  sourceType: record.source_type,
  baseInfoRootId: record.base_info_root_id ?? '',
  profileField: record.profile_field ?? '',
  dataType: record.data_type === 'base_info_code' || !record.data_type ? 'string' : record.data_type,
  cardinality: record.cardinality,
  minSelections: record.min_selections === null || record.min_selections === undefined ? '' : String(record.min_selections),
  maxSelections: record.max_selections === null || record.max_selections === undefined ? '' : String(record.max_selections),
  visibility: record.visibility,
  isRequired: record.is_required,
  isActive: record.is_active,
  userEditable: record.user_editable,
  userEditPolicy: record.user_edit_policy ?? (record.user_editable ? 'WHEN_EMPTY' : 'NONE'),
  viewOrder: String(record.view_order ?? 0),
});

export type EmptyForm = typeof EMPTY_SETTINGS_ATTRIBUTE_FORM;
