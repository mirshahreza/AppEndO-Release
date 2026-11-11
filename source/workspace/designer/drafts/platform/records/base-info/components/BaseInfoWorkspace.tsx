import React from 'react';
import { useBaseInfoPage } from '../hooks/useBaseInfoPage';
import { BaseInfoPageView } from './BaseInfoPageView';

export const BaseInfoWorkspace: React.FC = () => {
  const page = useBaseInfoPage();
  return <BaseInfoPageView page={page} />;
};
