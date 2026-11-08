import React from 'react';
import { useSshHubPage } from './hooks/useSshHubPage';
import { SshHubPageView } from './components/SshHubPageView';

export const SshHubWorkspace: React.FC = () => {
  const page = useSshHubPage();
  return <SshHubPageView page={page} />;
};
