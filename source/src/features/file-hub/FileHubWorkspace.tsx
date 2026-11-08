import React from 'react';
import { useFileHubPage } from './hooks/useFileHubPage';
import { FileHubPageView } from './components/FileHubPageView';

export const FileHubWorkspace: React.FC = () => {
  const page = useFileHubPage();
  return <FileHubPageView page={page} />;
};
