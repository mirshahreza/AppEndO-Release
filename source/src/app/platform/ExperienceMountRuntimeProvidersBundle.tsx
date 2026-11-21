import React from 'react';
import { InlineTranslationProvider } from '../../features/access-assistant/inlineTranslation/InlineTranslationProvider';
import { VxGeoResponsibilityInlineListDialogHost } from '../../features/vx-geo-responsibility/VxGeoResponsibilityInlineListDialogHost';

export type ExperienceMountRuntimeProvidersBundleProps = {
  children: React.ReactNode;
  includeVerticalGeoDialogHost: boolean;
};

/**
 * Studio mount runtime hosts (inline translation, optional Vertical geo dialog) in a dedicated chunk.
 */
export function ExperienceMountRuntimeProvidersBundle({
  children,
  includeVerticalGeoDialogHost,
}: ExperienceMountRuntimeProvidersBundleProps): React.ReactElement {
  const inner = includeVerticalGeoDialogHost ? (
    <VxGeoResponsibilityInlineListDialogHost>
      {children}
    </VxGeoResponsibilityInlineListDialogHost>
  ) : (
    children
  );

  return (
    <InlineTranslationProvider>
      {inner}
    </InlineTranslationProvider>
  );
}