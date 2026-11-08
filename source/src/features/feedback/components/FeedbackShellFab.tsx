import React from 'react';
import { FeedbackEntryButton } from './FeedbackSubmitDialog';

type FeedbackShellFabProps = {
  pageKey?: string | null;
};

export const FeedbackShellFab: React.FC<FeedbackShellFabProps> = ({ pageKey }) => (
  <FeedbackEntryButton pageKey={pageKey} variant="fab" />
);
