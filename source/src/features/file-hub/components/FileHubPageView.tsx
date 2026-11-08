import React, { useRef } from 'react';
import {
  AppToast,
  UiWorkspaceTabs,
  WorkspaceVerticalSplitHandle,
  useWorkspaceVerticalSplitPanel,
  WORKSPACE_SPLIT_PANEL_KEYS,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { FileHubPageState } from '../hooks/useFileHubPage';
import { useFileHubEditorShellHeader } from '../hooks/useFileHubEditorShellHeader';
import { formatFileHubSessionTitle } from '../fileHubTabTypes';
import { FileHubNewTabMenu } from '../FileHubNewTabMenu';
import { FileHubBrowserPanel } from './FileHubBrowserPanel';
import { FileHubConnectionFormModal } from './FileHubConnectionFormModal';
import { FileHubConnectionList } from './FileHubConnectionList';
import { FileHubDeleteModal } from './FileHubDeleteModal';

export function FileHubPageView({ page }: { page: FileHubPageState }) {
  const t = useCultureT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sidebarSplit = useWorkspaceVerticalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.fileHubSidebar,
    defaultSize: 288,
    minSize: 200,
    maxSize: 480,
    measure: 'leading',
    containerRef,
    side: 'start',
    collapsible: false,
    displayClassName: 'block',
  });
  const activeTab = page.sessionTabs.find((tab) => tab.id === page.activeTabId) ?? page.sessionTabs[0];
  const hasSessions = page.sessionTabs.length > 0;

  useFileHubEditorShellHeader({
    enabled: hasSessions,
    description: page.activeConnection
      ? `${page.activeConnection.protocol.toUpperCase()} · ${page.activeConnection.username}@${page.activeConnection.host}:${page.activeConnection.port}`
      : null,
  });

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full min-h-0 w-full bg-white', sidebarSplit.isResizing && 'select-none')}
      id="file-hub-page-wrapper"
    >
      {page.toast ? <AppToast type={page.toast.type} text={page.toast.text} /> : null}

      <div
        className="flex min-h-0 shrink-0 flex-col overflow-hidden"
        style={{ width: sidebarSplit.size > 0 ? sidebarSplit.size : undefined }}
      >
        <FileHubConnectionList page={page} />
      </div>
      <WorkspaceVerticalSplitHandle {...sidebarSplit.splitHandleProps} appearance="quiet" />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {hasSessions && activeTab ? (
          <UiWorkspaceTabs
            items={page.sessionTabs.map((tab) => {
              const connection = page.connections.find((item) => item.id === tab.connectionId) ?? null;
              const label = formatFileHubSessionTitle(connection);
              return {
                id: tab.id,
                label,
                accessibleLabel: connection
                  ? `${label}, ${connection.username}@${connection.host}:${connection.port}`
                  : label,
                hint: connection
                  ? `${label}\n${connection.username}@${connection.host}:${connection.port}`
                  : label,
                closeable: true,
                content: connection ? (
                  <FileHubBrowserPanel
                    key={tab.id}
                    connection={connection}
                    showToast={page.showToast}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
                    {t('fileHub.workspace.missing')}
                  </div>
                ),
              };
            })}
            selectedKey={activeTab.id}
            onSelectionChange={page.setActiveTabId}
            onClose={page.closeTab}
            addSlot={(
              <FileHubNewTabMenu
                connections={page.connections}
                onPick={(connection) => page.openConnection(connection, { additional: true })}
              />
            )}
            onRequestCloseDirty={async () => 'discard'}
            showAllTabsMenu={false}
            ariaLabel="Open Sftp sessions"
            className="min-h-0 flex-1"
          />
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="text-sm font-medium text-slate-500">{t('fileHub.workspace.empty')}</p>
            <p className="text-xs font-medium text-slate-400">{t('fileHub.workspace.emptyHint')}</p>
          </div>
        )}
      </div>

      <FileHubConnectionFormModal page={page} />
      <FileHubDeleteModal page={page} />
    </div>
  );
}
