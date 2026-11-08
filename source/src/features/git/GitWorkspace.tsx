import React from 'react';
import { useGitPage } from './hooks/useGitPage';
import { GitPageView } from './components/GitPageView';

export const GitWorkspace: React.FC = () => {
  const page = useGitPage();
  return <GitPageView page={page} />;
};
