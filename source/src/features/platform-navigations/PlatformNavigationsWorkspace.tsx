import React, { useEffect } from 'react';
import { NavigationsPageView } from './components/NavigationsPageView';
import { usePlatformNavigationsPage } from './hooks/usePlatformNavigationsPage';

export const PlatformNavigationsWorkspace: React.FC = () => {
  const page = usePlatformNavigationsPage();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Navigations';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return <NavigationsPageView page={page} />;
};
