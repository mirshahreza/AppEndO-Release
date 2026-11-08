import React from 'react';
import { MyApisPageView } from './components/MyApisPageView';
import { useMyApisPage } from './hooks/useMyApisPage';

export const MyApis: React.FC = () => {
  const page = useMyApisPage();
  return <MyApisPageView page={page} />;
};
