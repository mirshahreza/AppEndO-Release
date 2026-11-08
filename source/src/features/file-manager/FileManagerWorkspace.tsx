import React from 'react';
import { useFileManagerPage } from './hooks/useFileManagerPage';
import { FileManagerPageView } from './components/FileManagerPageView';

export const FileManagerWorkspace: React.FC = () => {
  const page = useFileManagerPage();
  return <FileManagerPageView page={page} />;
};
