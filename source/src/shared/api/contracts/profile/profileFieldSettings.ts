import type { AttributeUserEditPolicy } from '../attributes/editPolicy';
import type { AttributeVisibility } from '../attributes/types';

export type { AttributeUserEditPolicy } from '../attributes/editPolicy';

export type ProfileFieldSettingRecord = {
  profileField: string;
  profileFieldLabel: string;
  labelEn: string | null;
  isActive: boolean;
  userEditPolicy: AttributeUserEditPolicy;
  viewOrder: number;
};

export type ProfileFieldSettingPayloadEntry = {
  profileField: string;
  isActive: boolean;
  userEditPolicy: AttributeUserEditPolicy;
  labelEn?: string | null;
};

export type UpdateProfileFieldSettingsPayload = {
  items: ProfileFieldSettingPayloadEntry[];
};

export type ProfileFieldDataType = 'string' | 'base_info_code' | 'image';

export type ProfileFieldValueItem = {
  profileField: string;
  label: string;
  dataType: ProfileFieldDataType;
  value: unknown;
  isCurrentlyEditable: boolean;
};

export type ProfileFieldValuesResponse = {
  success: boolean;
  user_id?: number;
  items: ProfileFieldValueItem[];
};

export type UpdateProfileFieldValuesPayload = {
  fields: Array<{
    profileField: string;
    value: unknown | null;
  }>;
};

export type ActiveProfileFieldSettingRow = {
  profile_field: string;
  context_key: string;
  label_en: string | null;
  label: string | null;
  visibility: AttributeVisibility;
  user_edit_policy: AttributeUserEditPolicy;
  view_order: number;
};
