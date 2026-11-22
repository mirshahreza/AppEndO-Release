import React from 'react';
import { InlineTranslationProvider } from '../../features/access-assistant/inlineTranslation/InlineTranslationProvider';
import { ExtxGeoResponsibilityInlineListDialogHost } from '../../oss/excludedModuleStub';

export type ExperienceMountRuntimeProvidersBundleProps = {
  children: React.ReactNode;
  includePortalxGeoDialogHost: boolean;
};

/**
 * Studio mount runtime hosts (inline translation, optional Portalx geo dialog) in a dedicated chunk.
 */
export function ExperienceMountRuntimeProvidersBundle({
  children,
  includePortalxGeoDialogHost,
}: ExperienceMountRuntimeProvidersBundleProps): React.ReactElement {
  const inner = includePortalxGeoDialogHost ? (
    <ExtxGeoResponsibilityInlineListDialogHost>
      {children}
    </ExtxGeoResponsibilityInlineListDialogHost>
  ) : (
    children
  );

  return (
    <InlineTranslationProvider>
      {inner}
    </InlineTranslationProvider>
  );
}