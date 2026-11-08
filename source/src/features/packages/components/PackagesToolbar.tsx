import React from 'react';
import { PackagePlus, Store, Upload } from 'lucide-react';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroup,
  ToolbarSearchInput,
  ToolbarFilterCheckbox,
  ToolbarFilterSelect,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import type { PackageStatusFilter } from '../types';

export type PluginsToolbarProps = {
  statusFilter: PackageStatusFilter;
  onStatusFilterChange: (value: PackageStatusFilter) => void;
  nameFilter: string;
  onNameFilterChange: (value: string) => void;
  showOlderVersions: boolean;
  onShowOlderVersionsChange: (value: boolean) => void;
  onUpload: () => void;
  isUploading: boolean;
  onNewPackage: () => void;
  isBuilderEnabled: boolean;
};

export const PackagesToolbar: React.FC<PluginsToolbarProps> = ({
  statusFilter,
  onStatusFilterChange,
  nameFilter,
  onNameFilterChange,
  showOlderVersions,
  onShowOlderVersionsChange,
  onUpload,
  isUploading,
  onNewPackage,
  isBuilderEnabled,
}) => (
  <ListPageToolbarFrame>

    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={nameFilter}
        onChange={onNameFilterChange}
        placeholder="package name"
        ariaLabel="Search packages"
      />
      <ToolbarFilterSelect
        value={statusFilter === 'all' ? '' : statusFilter}
        options={[
          { value: 'installed', label: 'Installed' },
          { value: 'not_installed', label: 'Not Installed' },
          { value: 'failed', label: 'Failed' },
          { value: 'busy', label: 'Busy' },
        ]}
        onChange={(next) => onStatusFilterChange((next || 'all') as PackageStatusFilter)}
        ariaLabel="Filter by status"
        allLabel="All Statuses"
        hint={PAGE_GUIDE_EN['pageGuide.page.filter.hint']}
      />
      <ToolbarFilterCheckbox
        id="packages-show-older-versions"
        checked={showOlderVersions}
        onChange={onShowOlderVersionsChange}
        hint={PAGE_GUIDE_EN['pageGuide.page.packages.older.hint']}
      >
        <span className="sm:hidden">Older versions</span>
        <span className="hidden sm:inline">Show older versions</span>
      </ToolbarFilterCheckbox>
    </div>

    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <ToolbarActionGroup
        actions={[
          {
            id: 'marketplace',
            label: 'Market Place',
            icon: <Store className="w-3.5 h-3.5" />,
            intent: 'secondary',
            disabled: true,
            onClick: () => undefined,
            title: 'Coming soon',
          },
          {
            id: 'upload',
            label: 'Upload',
            icon: <Upload className="w-3.5 h-3.5" />,
            intent: 'secondary',
            disabled: isUploading,
            loading: isUploading,
            onClick: () => void onUpload(),
            guideHint: PAGE_GUIDE_EN['pageGuide.page.packages.upload.hint'],
          },
          {
            id: 'builder',
            label: 'Package Builder',
            icon: <PackagePlus className="w-3.5 h-3.5" />,
            intent: 'create',
            disabled: !isBuilderEnabled,
            onClick: onNewPackage,
            title: isBuilderEnabled ? 'Build a new package' : 'Package Builder is disabled',
            primary: true,
            guideHint: PAGE_GUIDE_EN['pageGuide.page.packages.builder.hint'],
          },
        ]}
      />
    </div>
  </ListPageToolbarFrame>
);
