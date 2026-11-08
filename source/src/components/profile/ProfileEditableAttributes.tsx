import React, { useState } from 'react';
import { Pencil, Settings2 } from 'lucide-react';
import {
  formatAttributeDisplayValue,
  useAttributeLabelMaps,
} from '../../features/attributes/utils/attributeDisplayValue';
import { isAttributeItemEditableByPolicy } from '../../shared/api/contracts/attributes/editPolicy';
import { isUiManagedUserAttributeKey } from '../../shared/api/contracts/attributes/builtInAttributes';
import { getAttributeFieldLabel } from '../../shared/api/queries/attributeValues';
import { useMyEditableAttributesQuery } from '../../shared/api/queries/profile';
import { AppButton } from '../../shared/ui';
import { useCultureT } from '../../core/culture/CultureContext';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_EDIT_CLASS } from '../../shared/ui/surfaceClasses';
import { PROFILE_KV_LIST_CLASS, ProfileDrawerSection, ProfileKvRow } from './profileDrawerUi';
import { ProfilePreferencesModal } from './ProfilePreferencesModal';

type ProfileEditableAttributesProps = {
  userId?: number | null;
  enabled?: boolean;
};

export const ProfileEditableAttributes: React.FC<ProfileEditableAttributesProps> = ({
  userId,
  enabled = true,
}) => {
  const t = useCultureT();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const editableQuery = useMyEditableAttributesQuery(userId, enabled);
  const items = (editableQuery.data ?? []).filter(
    (item) => !isUiManagedUserAttributeKey(item.settingsAttribute.key),
  );
  const labelByCode = useAttributeLabelMaps(items);
  const label = t(profileKey('sections.myPreferences'));

  if (editableQuery.isLoading) {
    return (
      <ProfileDrawerSection icon={<Settings2 className="h-3.5 w-3.5" />} label={label} tone="violet">
        <p className="py-2 text-xs text-slate-400">{t(profileKey('loading.preferences'))}</p>
      </ProfileDrawerSection>
    );
  }

  if (editableQuery.isError) {
    const errorMessage = editableQuery.error instanceof Error && editableQuery.error.message.trim()
      ? editableQuery.error.message
      : t(profileKey('errors.loadPreferences'));
    return (
      <ProfileDrawerSection icon={<Settings2 className="h-3.5 w-3.5" />} label={label} tone="violet">
        <p className="py-2 text-xs text-rose-600">{errorMessage}</p>
      </ProfileDrawerSection>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const hasEditableItems = items.some(isAttributeItemEditableByPolicy);

  return (
    <>
      <ProfileDrawerSection
        icon={<Settings2 className="h-3.5 w-3.5" />}
        label={label}
        tone="violet"
        action={
          hasEditableItems ? (
            <AppButton
              size="icon-sm"
              className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_EDIT_CLASS}`}
              onClick={() => setIsEditOpen(true)}
              title={t(profileKey('actions.editPreferences'))}
              aria-label={t(profileKey('actions.editPreferences'))}
            >
              <Pencil className="h-3.5 w-3.5" />
            </AppButton>
          ) : undefined
        }
      >
        <div className={PROFILE_KV_LIST_CLASS}>
          {items.map((item) => (
            <ProfileKvRow
              key={item.settingsAttribute.id}
              tone="violet"
              label={getAttributeFieldLabel(item, t)}
              value={formatAttributeDisplayValue(item, labelByCode)}
            />
          ))}
        </div>
      </ProfileDrawerSection>

      <ProfilePreferencesModal
        open={isEditOpen}
        items={items}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  );
};
