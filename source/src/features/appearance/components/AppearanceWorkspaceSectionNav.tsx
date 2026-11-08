import React from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { UiSegmentedControl } from '../../../shared/ui';
import { appearanceLabel } from '../lib/appearanceCulture';

export type AppearanceWorkspaceSection = 'shell' | 'atmosphere';

export type AppearanceWorkspaceSectionNavProps = {
  section: AppearanceWorkspaceSection;
  onSectionChange: (section: AppearanceWorkspaceSection) => void;
};

export const AppearanceWorkspaceSectionNav: React.FC<AppearanceWorkspaceSectionNavProps> = ({
  section,
  onSectionChange,
}) => {
  const culture = useOptionalCulture();
  const t = culture?.t;

  return (
  <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur-sm">
    <UiSegmentedControl
      ariaLabel={appearanceLabel(t, 'sections.ariaLabel', 'Appearance sections')}
      width="fit"
      items={[
        { id: 'shell', label: appearanceLabel(t, 'sections.shell', 'Shell & layout') },
        { id: 'atmosphere', label: appearanceLabel(t, 'sections.atmosphere', 'Atmosphere tokens') },
      ]}
      selectedKey={section}
      onSelectionChange={(key) => {
        if (key === 'shell' || key === 'atmosphere') {
          onSectionChange(key);
        }
      }}
    />
  </div>
  );
};
