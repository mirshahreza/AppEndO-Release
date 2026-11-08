import React from 'react';
import { FeedbackInboxPageView } from './components/FeedbackInboxPageView';
import { useFeedbackInboxPage } from './hooks/useFeedbackInboxPage';

export const FeedbackInboxPage: React.FC = () => {
  const page = useFeedbackInboxPage();
  return <FeedbackInboxPageView page={page} />;
};
