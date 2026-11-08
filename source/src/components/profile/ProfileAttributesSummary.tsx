import React from 'react';
import { Tags } from 'lucide-react';
import { useCurrentUserAttributeSummaryQuery } from '../../shared/api/queries/profile';
import { useCultureT } from '../../core/culture/CultureContext';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';
import { resolveAttributeLabel } from '../../shared/lib/attributeLabelTranslations';
import { PROFILE_KV_LIST_CLASS, ProfileDrawerSection, ProfileKvRow } from './profileDrawerUi';

type ProfileAttributesSummaryProps = {
  userId?: number | null;
  enabled?: boolean;
};

export const ProfileAttributesSummary: React.FC<ProfileAttributesSummaryProps> = ({
  userId,
  enabled = true,
}) => {
  const t = useCultureT();
  const summaryQuery = useCurrentUserAttributeSummaryQuery(userId, enabled);
  const label = t(profileKey('sections.attributes'));

  if (summaryQuery.isLoading) {
    return (
      <ProfileDrawerSection icon={<Tags className="h-3.5 w-3.5" />} label={label} tone="cyan">
        <p className="py-2 text-xs text-slate-400">{t(profileKey('loading.attributes'))}</p>
      </ProfileDrawerSection>
    );
  }

  if (summaryQuery.isError) {
    return (
      <ProfileDrawerSection icon={<Tags className="h-3.5 w-3.5" />} label={label} tone="cyan">
        <p className="py-2 text-xs text-rose-600">{t(profileKey('errors.loadAttributes'))}</p>
      </ProfileDrawerSection>
    );
  }

  const items = summaryQuery.data ?? [];
  if (items.length === 0) {
    return null;
  }

  return (
    <ProfileDrawerSection icon={<Tags className="h-3.5 w-3.5" />} label={label} tone="cyan">
      <div className={PROFILE_KV_LIST_CLASS}>
        {items.map((item) => (
          <ProfileKvRow
            key={item.key}
            tone="cyan"
            label={resolveAttributeLabel({
              attributeKey: item.key,
              fallbackLabel: item.label,
              t,
            })}
            value={item.displayValue}
          />
        ))}
      </div>
    </ProfileDrawerSection>
  );
};
