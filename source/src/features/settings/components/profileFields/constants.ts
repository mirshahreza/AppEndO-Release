import {
  DEFAULT_ATTRIBUTE_USER_EDIT_POLICY,
  type AttributeUserEditPolicy,
} from '../../../../shared/api/contracts/attributes/editPolicy';
import type { TranslationFn } from '../../../../core/culture/TranslationRuntime';
import { getUserEditPolicyOptions } from '../../settingsLabelsI18n';

export const buildUserEditPolicyOptions = (t: TranslationFn) => getUserEditPolicyOptions(t);

export const DEFAULT_PROFILE_FIELD_EDIT_POLICY: AttributeUserEditPolicy = DEFAULT_ATTRIBUTE_USER_EDIT_POLICY;

export type ProfileFieldDraftRow = {
  profileField: string;
  profileFieldLabel: string;
  labelEn: string;
  isActive: boolean;
  userEditPolicy: AttributeUserEditPolicy;
  viewOrder: number;
};

export const toDraftRow = (record: {
  profileField: string;
  profileFieldLabel: string;
  labelEn: string | null;
  isActive: boolean;
  userEditPolicy: AttributeUserEditPolicy;
  viewOrder: number;
}): ProfileFieldDraftRow => ({
  profileField: record.profileField,
  profileFieldLabel: record.profileFieldLabel,
  labelEn: record.labelEn ?? record.profileFieldLabel,
  isActive: record.isActive,
  userEditPolicy: record.userEditPolicy ?? DEFAULT_PROFILE_FIELD_EDIT_POLICY,
  viewOrder: record.viewOrder,
});

export const buildSavePayload = (rows: ProfileFieldDraftRow[]) => ({
  items: rows.map((row) => ({
    profileField: row.profileField,
    isActive: row.isActive,
    userEditPolicy: row.userEditPolicy,
    labelEn: row.labelEn.trim() || null,
  })),
});

export const isDirtyRows = (saved: ProfileFieldDraftRow[], draft: ProfileFieldDraftRow[]) =>
  JSON.stringify(saved) !== JSON.stringify(draft);
