import type { ProfileFieldValueItem } from '../../shared/api/contracts/profile/profileFieldSettings';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';

export type ProfileFormSectionLayout = 'grid' | 'birth-date' | 'profile-image';

export type ProfileFormSectionConfig = {
  sectionKey: string;
  fields: readonly string[];
  layout?: ProfileFormSectionLayout;
};

export const PROFILE_FIELD_FORM_SECTIONS: ProfileFormSectionConfig[] = [
  {
    sectionKey: 'profileImage',
    fields: ['profile_image'],
    layout: 'profile-image',
  },
  {
    sectionKey: 'contact',
    fields: ['phone'],
  },
  {
    sectionKey: 'personalInformation',
    fields: ['firstname', 'lastname', 'fathername', 'grandfathername', 'nickname'],
  },
  {
    sectionKey: 'identity',
    fields: ['national_code', 'gender_code', 'person_type_code'],
  },
  {
    sectionKey: 'birthDate',
    fields: ['birth_year', 'birth_month', 'birth_day'],
    layout: 'birth-date',
  },
];

export type GroupedProfileFieldSection = {
  title: string;
  layout: ProfileFormSectionLayout;
  items: ProfileFieldValueItem[];
};

export function resolveProfileSectionTitle(t: TranslationFn, sectionKey: string): string {
  return t(profileKey(`sections.${sectionKey}`));
}

export function groupProfileFieldItemsBySection(
  items: ProfileFieldValueItem[],
  t?: TranslationFn,
): GroupedProfileFieldSection[] {
  const itemsByField = new Map(items.map((item) => [item.profileField, item]));
  const usedFields = new Set<string>();
  const groups: GroupedProfileFieldSection[] = [];

  for (const section of PROFILE_FIELD_FORM_SECTIONS) {
    const sectionItems = section.fields
      .map((field) => itemsByField.get(field))
      .filter((item): item is ProfileFieldValueItem => Boolean(item));

    sectionItems.forEach((item) => usedFields.add(item.profileField));

    if (sectionItems.length > 0) {
      groups.push({
        title: t ? resolveProfileSectionTitle(t, section.sectionKey) : section.sectionKey,
        layout: section.layout ?? 'grid',
        items: sectionItems,
      });
    }
  }

  const remainingItems = items.filter((item) => !usedFields.has(item.profileField));
  if (remainingItems.length > 0) {
    groups.push({
      title: t ? resolveProfileSectionTitle(t, 'other') : 'Other',
      layout: 'grid',
      items: remainingItems,
    });
  }

  return groups;
}
