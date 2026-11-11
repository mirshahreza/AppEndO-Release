import React from 'react';
import { useLogsPage } from '../hooks/useLogsPage';
import { LogsPageView } from './LogsPageView';

export const LogsWorkspace: React.FC = () => {
  const page = useLogsPage();
  return <LogsPageView page={page} />;
};
