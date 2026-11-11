import React from 'react';
import { useCultureT } from '@/core/culture/CultureContext';
import { profileKey } from '@/core/culture/translations/cultureKeyHelpers';
import { PROFILE_IMAGE_ACCEPT } from '@/shared/lib/profileImageField';
import type { BaseInfoOption } from '@/shared/api/queries/users';
import { UiImageField, UiInput, UiSelect } from '@/shared/ui';
import { UserFormField, UserFormSection } from './userFormLayout';

export type UserProfileFieldValues = {
  firstName: string;
  lastName: string;
  fatherName: string;
  grandfatherName: string;
  nickname: string;
  nationalCode: string;
  genderCode: string;
  personTypeCode: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
};

type UserProfileFieldsProps = {
  values: UserProfileFieldValues;
  onChange: (patch: Partial<UserProfileFieldValues>) => void;
  genderOptions: BaseInfoOption[];
  personTypeOptions: BaseInfoOption[];
  profileImage?: {
    previewSrc?: string | null;
    previewMimeType?: string;
    onChange: (file?: File | null) => Promise<void>;
    onError: () => void;
  };
};

export const UserProfileFields: React.FC<UserProfileFieldsProps> = ({
  values,
  onChange,
  genderOptions,
  personTypeOptions,
  profileImage,
}) => {
  const t = useCultureT();

  return (
    <div className="space-y-1">
      {profileImage ? (
        <UserFormSection
          title={t(profileKey('sections.profileImage'))}
          tone="sky"
          description={t('users.profile.imageDescription')}
        >
          <div className="flex flex-col items-center gap-[2px] pb-1">
            <UiImageField
              accept={PROFILE_IMAGE_ACCEPT}
              previewSrc={profileImage.previewSrc}
              previewMimeType={profileImage.previewMimeType}
              openEditorOnPick={false}
              showFileName={false}
              ariaLabel={t('users.profile.imageUploadAria')}
              editorTitle={t('users.profile.imageEditorTitle')}
              emptyHint={t('users.profile.imageEmptyHint')}
              onChange={async (file) => {
                try {
                  await profileImage.onChange(file);
                } catch {
                  profileImage.onError();
                }
              }}
              onError={() => profileImage.onError()}
            />
          </div>
        </UserFormSection>
      ) : null}

      <UserFormSection
        title={t(profileKey('sections.personalInformation'))}
        tone="sky"
        divided={Boolean(profileImage)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UserFormField label={t(profileKey('fields.firstName'))}>
            <UiInput
              size="sm"
              value={values.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
              placeholder={t('users.profile.placeholder.firstName')}
            />
          </UserFormField>
          <UserFormField label={t(profileKey('fields.lastName'))}>
            <UiInput
              size="sm"
              value={values.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              placeholder={t('users.profile.placeholder.lastName')}
            />
          </UserFormField>
          <UserFormField label={t(profileKey('fields.fatherName'))}>
            <UiInput
              size="sm"
              value={values.fatherName}
              onChange={(e) => onChange({ fatherName: e.target.value })}
              placeholder={t('users.profile.placeholder.fatherName')}
            />
          </UserFormField>
          <UserFormField label={t(profileKey('fields.grandfatherName'))}>
            <UiInput
              size="sm"
              value={values.grandfatherName}
              onChange={(e) => onChange({ grandfatherName: e.target.value })}
              placeholder={t('users.profile.placeholder.grandfatherName')}
            />
          </UserFormField>
          <UserFormField label={t(profileKey('fields.nickname'))}>
            <UiInput
              size="sm"
              value={values.nickname}
              onChange={(e) => onChange({ nickname: e.target.value })}
              placeholder={t('users.profile.placeholder.nickname')}
            />
          </UserFormField>
        </div>
      </UserFormSection>

      <UserFormSection title={t(profileKey('sections.identity'))} tone="sky" divided>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UserFormField label={t(profileKey('fields.nationalCode'))}>
            <UiInput
              size="sm"
              value={values.nationalCode}
              onChange={(e) => onChange({ nationalCode: e.target.value })}
              placeholder={t('users.profile.placeholder.nationalCode')}
            />
          </UserFormField>
          <UserFormField label={t(profileKey('fields.gender'))}>
            <UiSelect size="sm" value={values.genderCode} onChange={(e) => onChange({ genderCode: e.target.value })}>
              <option value="">{t('users.common.select')}</option>
              {genderOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </UiSelect>
          </UserFormField>
          <UserFormField label={t(profileKey('fields.personType'))} className="sm:col-span-2">
            <UiSelect size="sm" value={values.personTypeCode} onChange={(e) => onChange({ personTypeCode: e.target.value })}>
              <option value="">{t('users.common.select')}</option>
              {personTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </UiSelect>
          </UserFormField>
        </div>
      </UserFormSection>

      <UserFormSection title={t(profileKey('sections.birthDate'))} tone="sky" divided>
        <div className="grid grid-cols-3 gap-3">
          <UserFormField label={t(profileKey('fields.year'))}>
            <UiInput
              size="sm"
              value={values.birthYear}
              onChange={(e) => onChange({ birthYear: e.target.value })}
              placeholder={t('users.profile.placeholder.birthYear')}
            />
          </UserFormField>
          <UserFormField label={t(profileKey('fields.month'))}>
            <UiInput
              size="sm"
              value={values.birthMonth}
              onChange={(e) => onChange({ birthMonth: e.target.value })}
              placeholder={t('users.profile.placeholder.birthMonth')}
            />
          </UserFormField>
          <UserFormField label={t(profileKey('fields.day'))}>
            <UiInput
              size="sm"
              value={values.birthDay}
              onChange={(e) => onChange({ birthDay: e.target.value })}
              placeholder={t('users.profile.placeholder.birthDay')}
            />
          </UserFormField>
        </div>
      </UserFormSection>
    </div>
  );
};
