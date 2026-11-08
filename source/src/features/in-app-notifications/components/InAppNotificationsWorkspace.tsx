import React from 'react';
import { useInAppNotificationsAdminPage } from '../hooks/useInAppNotificationsAdminPage';
import { InAppNotificationsPageView } from './InAppNotificationsPageView';

export const InAppNotificationsWorkspace: React.FC = () => {
  const page = useInAppNotificationsAdminPage();
  return <InAppNotificationsPageView page={page} />;
};
