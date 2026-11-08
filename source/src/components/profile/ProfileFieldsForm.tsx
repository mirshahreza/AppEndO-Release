import React from 'react';
import { UiInput, UiSelect } from '../../components/ui/HeroFieldControls';
import type { ProfileFieldValueItem } from '../../shared/api/contracts/profile/profileFieldSettings';
import { isProfileFieldValueItemEditable } from '../../shared/api/queries/profileFieldValues';
import { useBaseInfoOptionsQuery } from '../../shared/api/queries/base-info';
import { buildDataUrlFromBase64 } from '../../shared/lib/fileFieldUtils';
import {
  encodeProfileImageFieldFromFile,
  PROFILE_IMAGE_ACCEPT,
  type ProfileImageFieldValue,
} from '../../shared/lib/profileImageField';
import { UiImageField } from '../../shared/ui/UiImageField';
import { useCultureT } from '../../core/culture/CultureContext';
import { groupProfileFieldItemsBySection } from './profileFormSections';
import {
  PROFILE_GENDER_BASE_INFO_ROOT,
  PROFILE_PERSON_TYPE_BASE_INFO_ROOT,
} from '../../shared/profile/profileBaseInfoRoots';
import { isProfileFieldVisibleForPersonType } from '../../shared/profile/personType';
import { useProfileFieldCultureLabel } from '../../shared/profile/profileFieldCultureLabelKey';

const resolveProfileImagePreviewSrc = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;

  const imageValue = value as ProfileImageFieldValue;
  const mime = imageValue.profileImageMime ?? imageValue.mime ?? 'image/jpeg';

  if (typeof imageValue.profileImageBodyXs === 'string' && imageValue.profileImageBodyXs.trim()) {
    return buildDataUrlFromBase64(imageValue.profileImageBodyXs, mime);
  }
  if (typeof imageValue.previewBase64 === 'string' && imageValue.previewBase64.trim()) {
    return buildDataUrlFromBase64(imageValue.previewBase64, mime);
  }

  return null;
};

const PROFILE_FIELD_BASE_INFO_ROOT: Record<string, string> = {
  gender_code: PROFILE_GENDER_BASE_INFO_ROOT,
  person_type_code: PROFILE_PERSON_TYPE_BASE_INFO_ROOT,
};

type ProfileFieldsFormProps = {
  items: ProfileFieldValueItem[];
  valuesByProfileField: Record<string, unknown>;
  onValueChange: (profileField: string, value: unknown) => void;
  disabled?: boolean;
};

const ProfileFieldControl: React.FC<{
  item: ProfileFieldValueItem;
  value: unknown;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  onValueChange: (profileField: string, value: unknown) => void;
}> = ({ item, value, disabled = false, readOnly = false, className, onValueChange }) => {
  const t = useCultureT();
  const fieldLabel = useProfileFieldCultureLabel(item.profileField, item.label);
  const baseInfoRootId = PROFILE_FIELD_BASE_INFO_ROOT[item.profileField] ?? null;
  const optionsQuery = useBaseInfoOptionsQuery(baseInfoRootId);
  const options = optionsQuery.data ?? [];
  const fieldDisabled = disabled || readOnly;
  const selectPlaceholder = t('users.common.select');

  if (item.dataType === 'image') {
    const previewSrc = resolveProfileImagePreviewSrc(value);
    const previewMimeType = (value && typeof value === 'object'
      ? (value as ProfileImageFieldValue).profileImageMime
        ?? (value as ProfileImageFieldValue).mime
      : null) ?? 'image/jpeg';

    return (
      <div className={`flex flex-col gap-[2px] ${className ?? ''}`}>
        <label className="text-[10px] font-normal uppercase text-slate-500 tracking-wider ps-[4px]">
          {fieldLabel}
        </label>
        <UiImageField
          accept={PROFILE_IMAGE_ACCEPT}
          previewSrc={previewSrc}
          previewMimeType={previewMimeType}
          disabled={fieldDisabled}
          ariaLabel={fieldLabel}
          editorTitle={t('users.profile.imageEditorTitle')}
          emptyHint={t('users.profile.imageEmptyHint')}
          onError={() => undefined}
          onChange={async (file) => {
            if (!file) {
              onValueChange(item.profileField, null);
              return;
            }

            onValueChange(item.profileField, await encodeProfileImageFieldFromFile(file));
          }}
        />
      </div>
    );
  }

  if (baseInfoRootId) {
    return (
      <div className={`flex flex-col gap-[2px] ${className ?? ''}`}>
        <label className="text-[10px] font-normal uppercase text-slate-500 tracking-wider ps-[4px]">
          {fieldLabel}
        </label>
        <UiSelect
          size="sm"
          value={value === null || value === undefined ? '' : String(value)}
          disabled={fieldDisabled || optionsQuery.isLoading}
          onChange={(e) => onValueChange(item.profileField, e.target.value || null)}
        >
          <option value="">{selectPlaceholder}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </UiSelect>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-[2px] ${className ?? ''}`}>
      <label className="text-[10px] font-normal uppercase text-slate-500 tracking-wider ps-[4px]">
        {fieldLabel}
      </label>
      <UiInput
        size="sm"
        value={value === null || value === undefined ? '' : String(value)}
        disabled={fieldDisabled}
        onChange={(e) => onValueChange(item.profileField, e.target.value)}
        inputMode={item.profileField === 'phone' ? 'tel' : undefined}
        autoComplete={item.profileField === 'phone' ? 'tel' : undefined}
        phoneContactActions={item.profileField === 'phone'}
        aria-label={fieldLabel}
      />
    </div>
  );
};

const renderProfileFieldControl = (
  item: ProfileFieldValueItem,
  valuesByProfileField: Record<string, unknown>,
  onValueChange: (profileField: string, value: unknown) => void,
  disabled: boolean,
  className?: string,
) => {
  const editable = isProfileFieldValueItemEditable(item);
  const currentValue = valuesByProfileField[item.profileField] ?? item.value;
  const personTypeLocked = item.profileField === 'person_type_code' && Boolean(currentValue);

  return (
    <ProfileFieldControl
      key={item.profileField}
      item={item}
      value={currentValue}
      disabled={disabled}
      readOnly={!editable || personTypeLocked}
      className={className}
      onValueChange={onValueChange}
    />
  );
};

export const ProfileFieldsForm: React.FC<ProfileFieldsFormProps> = ({
  items,
  valuesByProfileField,
  onValueChange,
  disabled = false,
}) => {
  const t = useCultureT();
  const personTypeCode = typeof valuesByProfileField.person_type_code === 'string'
    ? valuesByProfileField.person_type_code
    : null;
  const visibleItems = items.filter((item) => (
    isProfileFieldVisibleForPersonType(item.profileField, personTypeCode)
  ));
  const sections = groupProfileFieldItemsBySection(visibleItems, t);

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <section key={section.title} className="rounded-lg border border-slate-200 p-3 space-y-3">
          <p className="text-[10px] font-normal uppercase text-slate-500 tracking-wider ps-[4px]">
            {section.title}
          </p>
          {section.layout === 'profile-image' ? (
            <div className="flex justify-center">
              {section.items.map((item) => renderProfileFieldControl(item, valuesByProfileField, onValueChange, disabled, 'max-w-xs w-full'))}
            </div>
          ) : section.layout === 'birth-date' ? (
            <div className="grid grid-cols-3 gap-3">
              {section.items.map((item) => renderProfileFieldControl(item, valuesByProfileField, onValueChange, disabled))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.items.map((item) => renderProfileFieldControl(
                item,
                valuesByProfileField,
                onValueChange,
                disabled,
                item.profileField === 'person_type_code' ? 'sm:col-span-2' : undefined,
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
};
