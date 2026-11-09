import React from 'react';
import { CatalogSpecimenCodeBadge, PageHeaderToolbar, formatStudioBcSpecimenCode } from '../../../shared/ui';
import type { BaseComponentsPageModel } from '../hooks/useBaseComponentsPage';
import { BaseComponentsSectionIcon } from '../baseComponentsSectionIcons';
import { getBaseComponentsSectionGuideHint, getBaseComponentsSectionLabel } from '../baseComponentsSections';
import { getBaseComponentsSectionTheme } from '../baseComponentsSectionTheme';
import { BASE_COMPONENTS_TITLE_CLASS } from '../baseComponentsVisualTokens';
import { useBaseComponentsPageHeader } from './BaseComponentsPageHeaderContext';

type BaseComponentsHeaderProps = {
  page: BaseComponentsPageModel;
};

export const BaseComponentsHeader: React.FC<BaseComponentsHeaderProps> = ({ page }) => {
  const { actions } = useBaseComponentsPageHeader();
  const theme = getBaseComponentsSectionTheme(page.activeSection);
  const sectionLabel = getBaseComponentsSectionLabel(page.activeSection);

  const sectionSpecimenCode = formatStudioBcSpecimenCode(page.activeSection);

  return (
    <PageHeaderToolbar
      icon={<BaseComponentsSectionIcon sectionId={page.activeSection} className={theme.iconClass} />}
      title={sectionLabel}
      titleClassName={BASE_COMPONENTS_TITLE_CLASS}
      description={getBaseComponentsSectionGuideHint(page.activeSection)}
      actions={(
        <span className="flex flex-wrap items-center gap-2">
          <CatalogSpecimenCodeBadge code={sectionSpecimenCode} />
          {actions}
        </span>
      )}
    />
  );
};
