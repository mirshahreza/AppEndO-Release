import React from 'react';
import { useRecordEventsPage } from '../hooks/useRecordEventsPage';
import { RecordEventsPageView } from './RecordEventsPageView';

export const RecordEventsWorkspace: React.FC = () => {
  const page = useRecordEventsPage();
  return <RecordEventsPageView page={page} />;
};
