import React from 'react';
import { FeedbackInboxPageView } from './FeedbackInboxPageView';
import { useFeedbackInboxPage } from '../hooks/useFeedbackInboxPage';

type FeedbackInboxPanelProps = {
  mode: 'mine' | 'staff';
};

/** @deprecated Prefer `FeedbackInboxPage` — kept for embedded `mode="staff"` callers. */
export const FeedbackInboxPanel: React.FC<FeedbackInboxPanelProps> = ({ mode }) => {
  if (mode !== 'staff') {
    throw new Error('FeedbackInboxPanel only supports staff mode.');
  }
  const page = useFeedbackInboxPage();
  return <FeedbackInboxPageView page={page} />;
};
