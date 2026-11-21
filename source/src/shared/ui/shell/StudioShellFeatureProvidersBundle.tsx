import React from 'react';
import { StudioToolsHostProviders } from '../../../features/access-assistant/components/StudioToolsHostProviders';
import { FeedbackWindowChromeHostProviders } from '../../../features/feedback/components/FeedbackWindowChromeHostProviders';

export type StudioShellFeatureProvidersBundleProps = {
  pageKey: string | null | undefined;
  pageTitle: string;
  children: React.ReactNode;
};

/**
 * Eager subtree kept in its own async chunk — not in AdminLayout / AppShell / designer shell chrome.
 */
export function StudioShellFeatureProvidersBundle({
  pageKey,
  pageTitle,
  children,
}: StudioShellFeatureProvidersBundleProps): React.ReactElement {
  return (
    <StudioToolsHostProviders pageKey={pageKey} pageTitle={pageTitle}>
      <FeedbackWindowChromeHostProviders>
        {children}
      </FeedbackWindowChromeHostProviders>
    </StudioToolsHostProviders>
  );
}