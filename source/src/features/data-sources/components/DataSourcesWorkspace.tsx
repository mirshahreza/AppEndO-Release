import React from 'react';
import { useDataSourcesPage } from '../hooks/useDataSourcesPage';
import { useDataSourcesQuestionsShellHeader } from '../hooks/useDataSourcesQuestionsShellHeader';
import { DataSourcesPageView } from './DataSourcesPageView';

export const DataSourcesWorkspace: React.FC = () => {
  const page = useDataSourcesPage();
  useDataSourcesQuestionsShellHeader({
    enabled: Boolean(page.questionsIdFromUrl),
  });
  return <DataSourcesPageView page={page} />;
};
