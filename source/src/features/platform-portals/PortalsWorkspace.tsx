import React, { useEffect } from 'react';
import { PortalsPageView } from './components/PortalsPageView';
import { usePortalsPage } from './hooks/usePortalsPage';

export const PortalsWorkspace: React.FC = () => {
  const page = usePortalsPage();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Portals';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return <PortalsPageView page={page} />;
};
