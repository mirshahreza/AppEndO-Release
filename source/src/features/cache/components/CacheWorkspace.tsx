import React from 'react';
import { useCachePage } from '../hooks/useCachePage';
import { CachePageView } from './CachePageView';

export const CacheWorkspace: React.FC = () => {
  const page = useCachePage();
  return <CachePageView page={page} />;
};
