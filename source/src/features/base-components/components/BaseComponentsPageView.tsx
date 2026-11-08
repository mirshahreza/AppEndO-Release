import React from 'react';
import type { BaseComponentsPageModel } from '../hooks/useBaseComponentsPage';
import { BASE_COMPONENTS_PAGE_SURFACE_CLASS } from '../baseComponentsVisualTokens';
import { BaseComponentsHeader } from './BaseComponentsHeader';
import { BaseComponentsMobileSectionPicker } from './BaseComponentsMobileSectionPicker';
import { BaseComponentsNav } from './BaseComponentsNav';
import { BaseComponentsPageHeaderProvider } from './BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewViewportProvider } from './BaseComponentsPreviewViewport';
import { BaseComponentsPropertiesDockProvider } from './BaseComponentsPropertiesDockContext';
import { BaseComponentsSectionContent } from './BaseComponentsSectionContent';

type BaseComponentsPageViewProps = {
  page: BaseComponentsPageModel;
};

export const BaseComponentsPageView: React.FC<BaseComponentsPageViewProps> = ({ page }) => {
  return (
    <BaseComponentsPageHeaderProvider>
      <BaseComponentsPropertiesDockProvider>
        <BaseComponentsPreviewViewportProvider>
          <div className={`relative flex h-full w-full flex-col ${BASE_COMPONENTS_PAGE_SURFACE_CLASS}`}>
            <BaseComponentsHeader page={page} />

            <BaseComponentsMobileSectionPicker page={page} />

            <div className="flex min-h-0 flex-1 items-stretch overflow-hidden">
              <BaseComponentsNav page={page} />
              <BaseComponentsSectionContent page={page} />
            </div>
          </div>
        </BaseComponentsPreviewViewportProvider>
      </BaseComponentsPropertiesDockProvider>
    </BaseComponentsPageHeaderProvider>
  );
};
