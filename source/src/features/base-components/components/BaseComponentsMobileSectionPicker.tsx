import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { buildMountAbsolutePath } from '../../../app/platform/platformConfigHelpers';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import { AppSearchBox } from '../../../shared/ui';
import { UiSelect } from '../../../shared/ui/HeroFieldControls';
import type { BaseComponentsPageModel } from '../hooks/useBaseComponentsPage';
import { useBaseComponentsNavSearch } from '../hooks/useBaseComponentsNavSearch';
import { buildBaseComponentsSectionRelativePath } from '../baseComponentsRoute';
import { BASE_COMPONENTS_NAV_SECTIONS } from '../baseComponentsSections';

type BaseComponentsMobileSectionPickerProps = {
  page: BaseComponentsPageModel;
};

export const BaseComponentsMobileSectionPicker: React.FC<BaseComponentsMobileSectionPickerProps> = ({ page }) => {
  const navigate = useNavigate();
  const mount = useOptionalPlatformMount();
  const mountId = mount?.id ?? STUDIO_MOUNT_ID;
  const toMountPath = useCallback((relativePath: string) => (
    buildMountAbsolutePath(mount?.pathPrefix || `/${STUDIO_PORTAL_SEGMENT}`, relativePath)
  ), [mount?.pathPrefix]);
  const { query, setQuery, groups, matchCount } = useBaseComponentsNavSearch();
  const filteredSections = groups.flatMap((group) => group.sections);
  const options = filteredSections.some((section) => section.id === page.activeSection)
    ? filteredSections
    : [
        ...BASE_COMPONENTS_NAV_SECTIONS.filter((section) => section.id === page.activeSection),
        ...filteredSections,
      ];

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white md:hidden">
      <AppSearchBox
        value={query}
        onChange={setQuery}
        placeholder="components…"
        ariaLabel="Search base components"
      />
      <div className="px-3 py-2.5">
        {matchCount === 0 ? (
          <p className="text-[11px] text-slate-500">
            {`No components match “${query.trim()}”.`}
          </p>
        ) : (
          <label className="flex flex-col gap-[2px] ps-[4px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Section
            </span>
            <UiSelect
              size="sm"
              value={page.activeSection}
              onChange={(event) => {
                const nextSection = event.target.value as BaseComponentsPageModel['activeSection'];
                navigate(toMountPath(buildBaseComponentsSectionRelativePath(nextSection, mountId)));
              }}
              className="w-full"
              ariaLabel="BaseComponents section"
            >
              {options.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </UiSelect>
          </label>
        )}
      </div>
    </div>
  );
};
