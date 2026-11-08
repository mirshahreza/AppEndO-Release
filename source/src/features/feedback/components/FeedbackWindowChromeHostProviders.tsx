import React from 'react';
import { RegisteredWindowChromeFeedbackProvider } from '../../../shared/ui/shell/registeredWindowChromeFeedback';
import { WindowChromeFeedbackButton } from './WindowChromeFeedbackButton';

export type FeedbackWindowChromeHostProvidersProps = {
  children: React.ReactNode;
};

/** Registers feedback entry for modal / floating window headers under this subtree. */
export function FeedbackWindowChromeHostProviders({
  children,
}: FeedbackWindowChromeHostProvidersProps): React.ReactElement {
  return (
    <RegisteredWindowChromeFeedbackProvider component={WindowChromeFeedbackButton}>
      {children}
    </RegisteredWindowChromeFeedbackProvider>
  );
}
