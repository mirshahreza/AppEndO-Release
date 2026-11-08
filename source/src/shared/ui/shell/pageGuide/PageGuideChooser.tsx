import React from 'react';
import { LayoutDashboard, PanelLeft, UserRoundCog } from 'lucide-react';
import { UiOptionCardGroup } from '../../UiOptionCardGroup';
import type { PageGuideTopic } from './pageGuide.types';

export type PageGuideChooserCopy = {
  title: string;
  hint: string;
  aria: string;
  pageTitle: string;
  pageHint: string;
  navigationTitle: string;
  navigationHint: string;
  capabilitiesTitle: string;
  capabilitiesHint: string;
};

export type PageGuideChooserProps = {
  copy: PageGuideChooserCopy;
  available: Record<PageGuideTopic, boolean>;
  onChoose: (topic: PageGuideTopic) => void;
};

export const PageGuideChooser: React.FC<PageGuideChooserProps> = ({
  copy,
  available,
  onChoose,
}) => (
  <UiOptionCardGroup
    value=""
    onChange={(value) => onChoose(value as PageGuideTopic)}
    ariaLabel={copy.aria}
    columns={1}
    density="compact"
    options={[
      {
        value: 'page',
        title: copy.pageTitle,
        description: copy.pageHint,
        icon: LayoutDashboard,
        tone: 'indigo',
        disabled: !available.page,
      },
      {
        value: 'navigation',
        title: copy.navigationTitle,
        description: copy.navigationHint,
        icon: PanelLeft,
        tone: 'cyan',
        disabled: !available.navigation,
      },
      {
        value: 'capabilities',
        title: copy.capabilitiesTitle,
        description: copy.capabilitiesHint,
        icon: UserRoundCog,
        tone: 'emerald',
        disabled: !available.capabilities,
      },
    ]}
  />
);
