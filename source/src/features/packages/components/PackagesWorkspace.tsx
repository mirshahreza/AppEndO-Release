import React from 'react';
import { usePackagesPage } from '../hooks/usePackagesPage';
import { PackagesPageView } from './PackagesPageView';

export const PackagesWorkspace: React.FC = () => {
  const page = usePackagesPage();
  return <PackagesPageView page={page} />;
};
