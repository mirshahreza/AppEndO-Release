import React from 'react';
import { Tooltip } from '@heroui/react';
import { ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  ToolbarRefreshButton,
  ToolbarSearchInput,
  UiSelect,
} from '@/src/shared/ui';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';

type BaseInfoToolbarProps = {
  page: BaseInfoPageModel;
};

const TOOLBAR_HINT_CLASS =
  'z-[9999] border border-slate-700/80 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 shadow-md';

type TreeToolbarHintButtonProps = {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

const TreeToolbarHintButton: React.FC<TreeToolbarHintButtonProps> = ({ label, onClick, children }) => (
  <Tooltip.Root delay={120} closeDelay={0}>
    <Tooltip.Trigger>
      <AppButton size="icon-md" intent="utility" aria-label={label} onClick={onClick}>
        {children}
      </AppButton>
    </Tooltip.Trigger>
    <Tooltip.Content showArrow offset={8} className={TOOLBAR_HINT_CLASS}>
      {label}
    </Tooltip.Content>
  </Tooltip.Root>
);

export const BaseInfoToolbar: React.FC<BaseInfoToolbarProps> = ({ page }) => (
  <div className={`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between`}>
    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <div className="w-full min-w-0 sm:w-36">
        <UiSelect size="sm" value={page.lang} onChange={(e) => page.setLang(e.target.value)}>
          <option value="en">English</option>
          <option value="fa">Persian</option>
          <option value="ar">Arabic</option>
        </UiSelect>
      </div>
      <ToolbarSearchInput
        value={page.search}
        onChange={page.setSearch}
        placeholder="id or title"
        ariaLabel="Search base info"
      />
    </div>

    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <AppButton intent="create" size="sm" onClick={page.openCreateModal}>
        <Plus className="w-3.5 h-3.5" />
        Create
      </AppButton>
      <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      <TreeToolbarHintButton label="Expand all" onClick={page.expandAll}>
        <ChevronsUpDown className="h-3.5 w-3.5" />
      </TreeToolbarHintButton>
      <TreeToolbarHintButton label="Collapse all" onClick={page.collapseAll}>
        <ChevronsDownUp className="h-3.5 w-3.5" />
      </TreeToolbarHintButton>
      <ToolbarRefreshButton onClick={() => void page.load()} isRefreshing={page.isLoading} />
    </div>
  </div>
);
