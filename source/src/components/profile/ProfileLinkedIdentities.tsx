import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { apiGet } from '../../shared/api/client';
import { useCultureT } from '../../core/culture/CultureContext';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';
import { PROFILE_KV_LIST_CLASS, ProfileDrawerSection } from './profileDrawerUi';

type LinkedIdentity = {
  providerId: string;
  providerKind: string;
  providerLabel: string;
  linkedAt: string;
};

type LinkedIdentitiesResponse = {
  success: boolean;
  identities: LinkedIdentity[];
};

async function fetchLinkedIdentities(): Promise<LinkedIdentity[]> {
  const { data, response } = await apiGet<LinkedIdentitiesResponse>('/api/profile/me/linked-identities');
  if (!response.ok || !data.success) {
    return [];
  }
  return data.identities ?? [];
}

type Props = {
  enabled: boolean;
};

export const ProfileLinkedIdentities: React.FC<Props> = ({ enabled }) => {
  const t = useCultureT();
  const query = useQuery({
    queryKey: ['profile', 'linked-identities'],
    queryFn: fetchLinkedIdentities,
    enabled,
  });

  if (!enabled || query.isLoading || (query.data?.length ?? 0) === 0) {
    return null;
  }

  return (
    <ProfileDrawerSection
      icon={<Link2 className="h-3.5 w-3.5" />}
      label={t(profileKey('sections.connectedAccounts'))}
      tone="emerald"
    >
      <ul className={PROFILE_KV_LIST_CLASS}>
        {query.data?.map((identity) => (
          <li
            key={`${identity.providerId}-${identity.linkedAt}`}
            className="flex items-baseline justify-between gap-4 py-2 first:pt-1 last:pb-1"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">{identity.providerLabel}</p>
              <p className="text-xs text-emerald-700">{identity.providerKind}</p>
            </div>
            <p className="shrink-0 text-xs text-slate-400">
              {identity.linkedAt.slice(0, 10)}
            </p>
          </li>
        ))}
      </ul>
    </ProfileDrawerSection>
  );
};
