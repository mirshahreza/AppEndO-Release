import React from 'react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { profileKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { PROFILE_IMAGE_ACCEPT } from '../../../shared/lib/profileImageField';
import type { BaseInfoOption } from '../../../shared/api/queries/users';
import {
  isCompanyPersonType,
  isIndividualPersonType,
} from '../../../shared/profile/personType';
import {
  RecordEventHistoryIcon,
  UiImageField,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
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
  companyName: string;
  registrationNumber: string;
  website: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
};

export type UserProfileHistoryChrome = {
  available: boolean;
  onOpenField: (formField: string) => void;
};

type UserProfileFieldsProps = {
  values: UserProfileFieldValues;
  onChange: (patch: Partial<UserProfileFieldValues>) => void;
  /** When set (create toolbar choice or edit record), drives which field groups render. */
  layoutPersonTypeCode?: string;
  personTypeOptions?: BaseInfoOption[];
  genderOptions: BaseInfoOption[];
  history?: UserProfileHistoryChrome;
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
  layoutPersonTypeCode,
  personTypeOptions,
  genderOptions,
  history,
  profileImage,
}) => {
  const t = useCultureT();
  const resolvedPersonTypeCode = layoutPersonTypeCode?.trim()
    || values.personTypeCode.trim()
    || '';
  const isIndividual = isIndividualPersonType(resolvedPersonTypeCode);
  const isCompany = isCompanyPersonType(resolvedPersonTypeCode);
  const personTypeLabel = personTypeOptions?.find((opt) => opt.id === resolvedPersonTypeCode)?.label
    ?? '';
  const historyExtra = (formField: string) => (
    history?.available
      ? <RecordEventHistoryIcon onClick={() => history.onOpenField(formField)} />
      : undefined
  );

  return (
    <div className="space-y-1">
      {(isIndividual || isCompany) && personTypeLabel ? (
        <UserFormSection
          title={t(profileKey('sections.identity'))}
          tone="indigo"
          divided={false}
        >
          <UserFormField
            label={t(profileKey('fields.personType'))}
            hint={t('users.profile.personTypeLockedHint')}
          >
            <UiInput size="sm" value={personTypeLabel} disabled aria-readonly />
          </UserFormField>
        </UserFormSection>
      ) : null}

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

      {isCompany ? (
        <UserFormSection
          title={t(profileKey('sections.companyInformation'))}
          tone="sky"
          divided
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UserFormField
              label={t(profileKey('fields.companyName'))}
              className="sm:col-span-2"
              labelExtra={historyExtra('companyName')}
            >
              <UiInput
                size="sm"
                value={values.companyName}
                onChange={(e) => onChange({ companyName: e.target.value })}
                placeholder={t('users.profile.placeholder.companyName')}
              />
            </UserFormField>
            <UserFormField
              label={t(profileKey('fields.registrationNumber'))}
              labelExtra={historyExtra('registrationNumber')}
            >
              <UiInput
                size="sm"
                value={values.registrationNumber}
                onChange={(e) => onChange({ registrationNumber: e.target.value })}
                placeholder={t('users.profile.placeholder.registrationNumber')}
              />
            </UserFormField>
            <UserFormField
              label={t(profileKey('fields.website'))}
              labelExtra={historyExtra('website')}
            >
              <UiInput
                size="sm"
                value={values.website}
                onChange={(e) => onChange({ website: e.target.value })}
                placeholder={t('users.profile.placeholder.website')}
              />
            </UserFormField>
            <UserFormField
              label={t(profileKey('fields.nationalCode'))}
              className="sm:col-span-2"
              labelExtra={historyExtra('nationalCode')}
            >
              <UiInput
                size="sm"
                value={values.nationalCode}
                onChange={(e) => onChange({ nationalCode: e.target.value })}
                placeholder={t('users.profile.placeholder.companyNationalCode')}
              />
            </UserFormField>
            <UserFormField
              label={t(profileKey('fields.nickname'))}
              labelExtra={historyExtra('nickname')}
            >
              <UiInput
                size="sm"
                value={values.nickname}
                onChange={(e) => onChange({ nickname: e.target.value })}
                placeholder={t('users.profile.placeholder.nickname')}
              />
            </UserFormField>
          </div>
        </UserFormSection>
      ) : null}

      {isIndividual ? (
        <>
          <UserFormSection
            title={t(profileKey('sections.personalInformation'))}
            tone="sky"
            divided
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <UserFormField
                label={t(profileKey('fields.firstName'))}
                labelExtra={historyExtra('firstName')}
              >
                <UiInput
                  size="sm"
                  value={values.firstName}
                  onChange={(e) => onChange({ firstName: e.target.value })}
                  placeholder={t('users.profile.placeholder.firstName')}
                />
              </UserFormField>
              <UserFormField
                label={t(profileKey('fields.lastName'))}
                labelExtra={historyExtra('lastName')}
              >
                <UiInput
                  size="sm"
                  value={values.lastName}
                  onChange={(e) => onChange({ lastName: e.target.value })}
                  placeholder={t('users.profile.placeholder.lastName')}
                />
              </UserFormField>
              <UserFormField
                label={t(profileKey('fields.fatherName'))}
                labelExtra={historyExtra('fatherName')}
              >
                <UiInput
                  size="sm"
                  value={values.fatherName}
                  onChange={(e) => onChange({ fatherName: e.target.value })}
                  placeholder={t('users.profile.placeholder.fatherName')}
                />
              </UserFormField>
              <UserFormField
                label={t(profileKey('fields.grandfatherName'))}
                labelExtra={historyExtra('grandfatherName')}
              >
                <UiInput
                  size="sm"
                  value={values.grandfatherName}
                  onChange={(e) => onChange({ grandfatherName: e.target.value })}
                  placeholder={t('users.profile.placeholder.grandfatherName')}
                />
              </UserFormField>
              <UserFormField
                label={t(profileKey('fields.nickname'))}
                labelExtra={historyExtra('nickname')}
              >
                <UiInput
                  size="sm"
                  value={values.nickname}
                  onChange={(e) => onChange({ nickname: e.target.value })}
                  placeholder={t('users.profile.placeholder.nickname')}
                />
              </UserFormField>
              <UserFormField
                label={t(profileKey('fields.nationalCode'))}
                labelExtra={historyExtra('nationalCode')}
              >
                <UiInput
                  size="sm"
                  value={values.nationalCode}
                  onChange={(e) => onChange({ nationalCode: e.target.value })}
                  placeholder={t('users.profile.placeholder.nationalCode')}
                />
              </UserFormField>
              <UserFormField
                label={t(profileKey('fields.gender'))}
                labelExtra={historyExtra('genderCode')}
              >
                <UiSelect size="sm" value={values.genderCode} onChange={(e) => onChange({ genderCode: e.target.value })}>
                  <option value="">{t('users.common.select')}</option>
                  {genderOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </UiSelect>
              </UserFormField>
            </div>
          </UserFormSection>

          <UserFormSection title={t(profileKey('sections.birthDate'))} tone="sky" divided>
            <div className="grid grid-cols-3 gap-3">
              <UserFormField
                label={t(profileKey('fields.year'))}
                labelExtra={historyExtra('birthYear')}
              >
                <UiInput
                  size="sm"
                  value={values.birthYear}
                  onChange={(e) => onChange({ birthYear: e.target.value })}
                  placeholder={t('users.profile.placeholder.birthYear')}
                />
              </UserFormField>
              <UserFormField
                label={t(profileKey('fields.month'))}
                labelExtra={historyExtra('birthMonth')}
              >
                <UiInput
                  size="sm"
                  value={values.birthMonth}
                  onChange={(e) => onChange({ birthMonth: e.target.value })}
                  placeholder={t('users.profile.placeholder.birthMonth')}
                />
              </UserFormField>
              <UserFormField
                label={t(profileKey('fields.day'))}
                labelExtra={historyExtra('birthDay')}
              >
                <UiInput
                  size="sm"
                  value={values.birthDay}
                  onChange={(e) => onChange({ birthDay: e.target.value })}
                  placeholder={t('users.profile.placeholder.birthDay')}
                />
              </UserFormField>
            </div>
          </UserFormSection>
        </>
      ) : null}
    </div>
  );
};
