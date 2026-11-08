import React from 'react';
import { useOptionalActiveStudioPageKey } from '../../../shared/context/ActiveStudioPageKeyContext';
import { useOptionalStudioPageTools } from '../../../shared/ui/shell/studioPageToolsContext';
import { FeedbackEntryButton } from './FeedbackSubmitDialog';

/** Feedback trigger for floating panels and modal shells (same policy as shell header). */
export const WindowChromeFeedbackButton: React.FC = () => {
  const pageTools = useOptionalStudioPageTools();
  const activePageKey = useOptionalActiveStudioPageKey();
  const pageKey = pageTools?.pageKey ?? activePageKey;

  return <FeedbackEntryButton pageKey={pageKey} variant="header" />;
};
