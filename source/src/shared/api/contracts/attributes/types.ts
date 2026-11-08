import type { AttributeUserEditPolicy } from './editPolicy';

export type { AttributeUserEditPolicy } from './editPolicy';

export type AttributeScope = 'USER' | 'ROLE';
export type AttributeSourceType = 'BASE_INFO' | 'CUSTOM';
export type AttributeDataType = 'string' | 'number' | 'boolean' | 'json' | 'base_info_code';
export type AttributeCardinality = 'single' | 'multi';
export type AttributeVisibility = 'SERVER' | 'CLIENT' | 'BOTH' | 'NONE';

export type SettingsAttributeRecord = {
  id: number;
  key: string;
  label: string | null;
  scope: AttributeScope;
  source_type: AttributeSourceType;
  base_info_root_id: string | null;
  profile_field: string | null;
  data_type: AttributeDataType | null;
  cardinality: AttributeCardinality;
  min_selections: number | null;
  max_selections: number | null;
  visibility: AttributeVisibility;
  is_required: boolean;
  is_active: boolean;
  is_builtin: boolean;
  user_editable: boolean;
  user_edit_policy: AttributeUserEditPolicy;
  view_order: number;
  created_at: string;
  created_by?: number | null;
  created_by_username?: string | null;
  updated_at?: string;
  updated_by?: number | null;
  updated_by_username?: string | null;
};

export type SettingsAttributePayload = {
  key: string;
  label?: string | null;
  scope: AttributeScope;
  sourceType: AttributeSourceType;
  baseInfoRootId?: string | null;
  profileField?: string | null;
  dataType?: AttributeDataType | null;
  cardinality: AttributeCardinality;
  minSelections?: number | null;
  maxSelections?: number | null;
  visibility: AttributeVisibility;
  isRequired?: boolean;
  isActive?: boolean;
  userEditable?: boolean;
  userEditPolicy?: AttributeUserEditPolicy;
  viewOrder?: number;
};

export type UpdateSettingsAttributePayload = Omit<SettingsAttributePayload, 'scope'>;

export type SettingsAttributeSummary = Pick<
  SettingsAttributeRecord,
  | 'id'
  | 'key'
  | 'label'
  | 'scope'
  | 'source_type'
  | 'base_info_root_id'
  | 'profile_field'
  | 'data_type'
  | 'cardinality'
  | 'min_selections'
  | 'max_selections'
  | 'visibility'
  | 'is_required'
  | 'is_active'
  | 'user_editable'
  | 'user_edit_policy'
  | 'view_order'
>;

export type {
  ProfileFieldSettingRecord,
  ProfileFieldSettingPayloadEntry,
  ProfileFieldValueItem,
  ProfileFieldValuesResponse,
  UpdateProfileFieldSettingsPayload,
  UpdateProfileFieldValuesPayload,
} from '../profile/profileFieldSettings';

export type AttributeValueItem = {
  settingsAttribute: SettingsAttributeSummary;
  value_id: number | null;
  value: unknown;
  isCurrentlyEditable?: boolean;
};

export type AttributeValuesResponse = {
  success: boolean;
  user_id?: number;
  role_id?: number;
  role_name?: string;
  items: AttributeValueItem[];
};

export type AttributeValuePayloadEntry = {
  settingsAttributeId: number;
  value: unknown | null;
};

export type UpdateAttributeValuesPayload = {
  values: AttributeValuePayloadEntry[];
};

export type SessionContextMap = Record<string, unknown>;

export type SessionContextResponse = {
  success: boolean;
  clientContext: SessionContextMap;
  serverContext?: SessionContextMap;
};

export type SessionPreviewResponse = {
  success: boolean;
  user_id: number;
  roles: string[];
  serverContext: SessionContextMap;
  clientContext: SessionContextMap;
};

export type MissingRequiredAttribute = {
  settingsAttributeId: number;
  key: string;
  scope: AttributeScope;
  sourceType: AttributeSourceType;
  contextKey: string;
  label: string | null;
};

export const REQUIRED_ATTRIBUTES_MISSING_CODE = 'REQUIRED_ATTRIBUTES_MISSING' as const;

export type AttributeSummaryItem = {
  key: string;
  label: string;
  displayValue: string;
  view_order: number;
};

export type AttributeSummaryResponse = {
  success: boolean;
  items: AttributeSummaryItem[];
};
