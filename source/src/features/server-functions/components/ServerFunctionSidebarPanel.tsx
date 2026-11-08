import React from 'react';
import type { ServerFunctionsPageState } from '../hooks/useServerFunctionsPage';
import { FunctionListSidebar } from './FunctionListSidebar';

export type ServerFunctionSidebarPanelProps = {
  page: ServerFunctionsPageState;
  layout?: 'page' | 'sidebar';
  onOpenUnusedFunctions?: () => void;
};

export const ServerFunctionSidebarPanel: React.FC<ServerFunctionSidebarPanelProps> = ({
  page,
  layout = 'page',
  onOpenUnusedFunctions,
}) => (
  <FunctionListSidebar
    layout={layout}
    isLargeScreen={page.isLargeScreen}
    sidebarWidth={page.sidebarWidth}
    activeId={page.activeId}
    onLoadFunction={page.loadFunctionFromList}
    builtInFilter={page.builtInFilter}
    onBuiltInFilterChange={page.setBuiltInFilter}
    searchQuery={page.searchQuery}
    setSearchQuery={page.setSearchQuery}
    methodFilter={page.methodFilter}
    setMethodFilter={page.setMethodFilter}
    groups={page.groups}
    isCatalogLoading={page.isCatalogLoading}
    isCatalogFetching={page.isCatalogFetching}
    onRefreshCatalog={page.refreshCatalog}
    onCreateScript={page.openCreateDialog}
    onDuplicateFunction={page.openDuplicateDialog}
    onRenameFunction={page.openRenameDialog}
    onConfigureAccess={page.openAccessDialog}
    onConfigureSettings={page.openSettingsDialog}
    onDeleteFunction={page.handleDeleteFunction}
    onOpenUnusedFunctions={onOpenUnusedFunctions}
    isFunctionActionBusy={page.isDuplicating || page.isRenaming || page.isSavingAccess || page.isSavingSettings}
  />
);
