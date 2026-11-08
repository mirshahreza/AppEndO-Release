import React, { useState } from 'react';
import { AtSign, Contact, Mail, MoreHorizontal, Pencil, Phone, User } from 'lucide-react';
import type { UserProfileRecord } from '../../shared/api/queries/profile';
import {
  isProfileFieldValueItemEditable,
  useMyEditableProfileFieldsQuery,
} from '../../shared/api/queries/profileFieldValues';
import { AppButton } from '../../shared/ui';
import { useCultureT } from '../../core/culture/CultureContext';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_EDIT_CLASS } from '../../shared/ui/surfaceClasses';
import { ProfileFieldsEditModal } from './ProfileAccountModals';
import {
  PROFILE_KV_LIST_CLASS,
  ProfileDrawerSection,
  ProfileKvRow,
  type ProfileDrawerTone,
} from './profileDrawerUi';

type DetailRow = {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: ProfileDrawerTone;
  phoneContactActions?: boolean;
};

type ProfilePersonalDetailsProps = {
  profile: UserProfileRecord | null;
  userId?: number | null;
  enabled?: boolean;
  onOpenMore: () => void;
};

export const ProfilePersonalDetails: React.FC<ProfilePersonalDetailsProps> = ({
  profile,
  userId,
  enabled = true,
  onOpenMore,
}) => {
  const t = useCultureT();
  const emptyValue = t(profileKey('emptyValue'));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const editableQuery = useMyEditableProfileFieldsQuery(userId, enabled);
  const profileFieldItems = editableQuery.data ?? [];
  const canEditProfileFields = profileFieldItems.some(isProfileFieldValueItemEditable);

  const personalDetails: DetailRow[] = [
    {
      icon: <AtSign className="h-3.5 w-3.5" />,
      tone: 'indigo',
      label: t(profileKey('fields.username')),
      value: profile?.username || emptyValue,
    },
    {
      icon: <Mail className="h-3.5 w-3.5" />,
      tone: 'cyan',
      label: t(profileKey('fields.email')),
      value: profile?.email || emptyValue,
    },
    {
      icon: <User className="h-3.5 w-3.5" />,
      tone: 'violet',
      label: t(profileKey('fields.firstName')),
      value: profile?.firstname || emptyValue,
    },
    {
      icon: <User className="h-3.5 w-3.5" />,
      tone: 'violet',
      label: t(profileKey('fields.lastName')),
      value: profile?.lastname || emptyValue,
    },
    {
      icon: <Phone className="h-3.5 w-3.5" />,
      tone: 'emerald',
      label: t(profileKey('fields.phone')),
      value: profile?.phone || emptyValue,
      phoneContactActions: true,
    },
  ];

  return (
    <>
      <ProfileDrawerSection
        icon={<Contact className="h-3.5 w-3.5" />}
        label={t(profileKey('sections.personalDetails'))}
        tone="indigo"
        pattern
        defaultExpanded
        action={
          canEditProfileFields ? (
            <AppButton
              size="icon-sm"
              className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_EDIT_CLASS}`}
              onClick={() => setIsEditOpen(true)}
              title={t(profileKey('actions.editProfileFields'))}
              aria-label={t(profileKey('actions.editProfileFields'))}
            >
              <Pencil className="h-3.5 w-3.5" />
            </AppButton>
          ) : undefined
        }
      >
        <div className={PROFILE_KV_LIST_CLASS}>
          {personalDetails.map((detail) => (
            <ProfileKvRow
              key={detail.label}
              icon={detail.icon}
              tone={detail.tone}
              label={detail.label}
              value={detail.value}
              phoneContactActions={detail.phoneContactActions}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenMore}
          className="inline-flex items-center gap-1.5 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:text-indigo-800"
        >
          {t(profileKey('actions.more'))}
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </ProfileDrawerSection>

      <ProfileFieldsEditModal
        open={isEditOpen}
        items={profileFieldItems}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  );
};
