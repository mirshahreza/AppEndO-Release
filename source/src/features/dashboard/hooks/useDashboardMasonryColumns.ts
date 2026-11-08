import { useEffect, useState } from 'react';

const DASHBOARD_MASONRY_TWO_COLUMN_QUERY = '(min-width: 1024px)';

const readTwoColumnMatch = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(DASHBOARD_MASONRY_TWO_COLUMN_QUERY).matches;
};

export const useDashboardMasonryColumns = (): boolean => {
  const [twoColumns, setTwoColumns] = useState(readTwoColumnMatch);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia(DASHBOARD_MASONRY_TWO_COLUMN_QUERY);
    const handleChange = () => setTwoColumns(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return twoColumns;
};
