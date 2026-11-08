import React from 'react';
import { useRdpHubPage } from './hooks/useRdpHubPage';
import { RdpHubPageView } from './components/RdpHubPageView';

export const RdpHubWorkspace: React.FC = () => {
  const page = useRdpHubPage();
  return <RdpHubPageView page={page} />;
};
