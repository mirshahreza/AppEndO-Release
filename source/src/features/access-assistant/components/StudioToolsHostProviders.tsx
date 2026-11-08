import React from 'react';
import { RegisteredStudioToolsMenuProvider } from '../../../shared/ui/shell/registeredStudioToolsMenu';
import { StudioPageToolsProvider } from '../../../shared/ui/shell/studioPageToolsContext';
import { WindowChromeStudioToolsMenu } from './WindowChromeStudioToolsMenu';

export type StudioToolsHostProvidersProps = {
  pageKey: string | null | undefined;
  pageTitle: string;
  children: React.ReactNode;
};

/** Registers page context + Studio tools menu for modal/floating window headers under this subtree. */
export function StudioToolsHostProviders({
  pageKey,
  pageTitle,
  children,
}: StudioToolsHostProvidersProps): React.ReactElement {
  return (
    <StudioPageToolsProvider pageKey={pageKey} pageTitle={pageTitle}>
      <RegisteredStudioToolsMenuProvider component={WindowChromeStudioToolsMenu}>
        {children}
      </RegisteredStudioToolsMenuProvider>
    </StudioPageToolsProvider>
  );
}
