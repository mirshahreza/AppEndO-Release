import React from 'react';
import type { PersonalInboxKindFilter } from '../../../shared/api/contracts/personal-inbox/types';
import type { PersonalInboxListUiFilters } from '../lib/personalInboxSearchParams';
import { PersonalInboxWorkspace } from './PersonalInboxWorkspace';

export type PersonalInboxPageProps = {
  initialKind?: PersonalInboxKindFilter;
  initialFolder?: string;
  initialListUiFilters?: PersonalInboxListUiFilters;
  composeToolbarAction?: React.ReactNode;
};

/** Unified personal inbox — `/studio/my-inbox` when no work-item detail deep link. */
export const PersonalInboxPage: React.FC<PersonalInboxPageProps> = ({
  initialKind = 'all',
  initialFolder = '',
  initialListUiFilters,
  composeToolbarAction = null,
}) => (
  <PersonalInboxWorkspace
    initialKind={initialKind}
    initialFolder={initialFolder}
    initialListUiFilters={initialListUiFilters}
    composeToolbarAction={composeToolbarAction}
  />
);
