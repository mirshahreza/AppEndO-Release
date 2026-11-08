import React from 'react';
import { MyFeedbackPageView } from './components/MyFeedbackPageView';
import { useMyFeedbackPage } from './hooks/useMyFeedbackPage';

export const MyFeedbackPage: React.FC = () => {
  const page = useMyFeedbackPage();
  return <MyFeedbackPageView page={page} />;
};
