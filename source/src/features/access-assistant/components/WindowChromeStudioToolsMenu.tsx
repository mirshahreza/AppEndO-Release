import React from 'react';
import { useOptionalStudioPageTools } from '../../../shared/ui/shell/studioPageToolsContext';
import { useStudioToolsGate } from '../hooks/useStudioToolsGate';
import { StudioToolsMenu } from './StudioToolsMenu';

/** Studio tools menu for floating panels and modal shells (same items as shell header). */
export const WindowChromeStudioToolsMenu: React.FC = () => {
  const gate = useStudioToolsGate();
  const pageTools = useOptionalStudioPageTools();

  if (!gate || !pageTools) {
    return null;
  }

  return (
    <StudioToolsMenu
      pageKey={pageTools.pageKey}
      pageTitle={pageTools.pageTitle}
      variant="window"
    />
  );
};
