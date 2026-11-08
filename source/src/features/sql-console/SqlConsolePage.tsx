import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatApiErrorMessage, isApiError } from '../../shared/api/client';
import { useDataSourcesQuery, useExecuteDataSourceQueryMutation } from '../../shared/api/queries/data-sources';
import {
  useUpdateSqlConsoleScriptMutation,
  type SqlConsoleScript,
} from '../../shared/api/queries/sql-console';
import { DataSourceType } from '../../shared/api/contracts/data-sources/types';
import type { ExecuteDataSourceQueryResult } from '../../shared/api/contracts/data-sources/executeQuery';
import { cn } from '../../lib/utils';
import { useViewportTier } from '../../shared/lib/useViewportTier';
import { isCompactChromeTier } from '../../shared/lib/viewportTokens';
import {
  UiWorkspaceTabs,
  WorkspaceVerticalSplitHandle,
  useWorkspaceVerticalSplitPanel,
  WORKSPACE_SPLIT_PANEL_KEYS,
} from '../../shared/ui';
import { SqlConsoleDocument } from './SqlConsoleDocument';
import { SqlConsoleNewTabMenu } from './SqlConsoleNewTabMenu';
import { NewCollectionModal, NewFolderModal, SaveScriptModal } from './SqlConsoleModals';
import { SqlConsoleSidebar } from './SqlConsoleSidebar';
import {
  closeSqlConsoleTab,
  createBlankSqlConsoleTab,
  formatSqlConsoleConnectionTitle,
  resolveSqlConsoleDataSourceId,
  tabFromSavedScript,
  type SqlConsoleTab,
} from './sqlConsoleTabTypes';
import { useSqlConsoleOverlayDeepLink } from './hooks/useSqlConsoleOverlayDeepLink';

/** Engines that can return a query plan from SQL Console Explain. */
const EXPLAIN_SUPPORTED_TYPES = new Set<DataSourceType>([
  DataSourceType.POSTGRES,
  DataSourceType.MYSQL,
  DataSourceType.SQLITE,
  DataSourceType.SQL_SERVER,
]);

type PendingModal =
  | { kind: 'new-collection' }
  | { kind: 'new-folder'; collectionId: string; parentFolderId: string | null }
  | { kind: 'save-script'; tabId: string }
  | null;

export const SqlConsolePage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportTier = useViewportTier();
  const compactChrome = isCompactChromeTier(viewportTier);
  const [searchParams] = useSearchParams();
  const dataSourcesQuery = useDataSourcesQuery();
  const sidebarSplit = useWorkspaceVerticalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.sqlConsoleSidebar,
    defaultSize: 288,
    minSize: 200,
    maxSize: 480,
    measure: 'leading',
    containerRef,
    side: 'start',
    defaultCollapsed: compactChrome,
    collapsible: true,
    displayClassName: compactChrome ? 'max-lg:block' : 'block',
  });

  const runMutation = useExecuteDataSourceQueryMutation();
  const updateScriptMutation = useUpdateSqlConsoleScriptMutation();

  const dataSources = useMemo(() => dataSourcesQuery.data?.items ?? [], [dataSourcesQuery.data]);
  const [tabs, setTabs] = useState<SqlConsoleTab[]>(() => [
    createBlankSqlConsoleTab({ dataSourceId: searchParams.get('dataSourceId')?.trim() ?? '' }),
  ]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [pendingModal, setPendingModal] = useState<PendingModal>(null);
  const [revealCollectionId, setRevealCollectionId] = useState<string | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const effectiveDataSourceId = resolveSqlConsoleDataSourceId(activeTab.dataSourceId, dataSources);

  const updateTab = (tabId: string, patch: Partial<SqlConsoleTab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab)));
  };

  const openTab = (tab: SqlConsoleTab) => {
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const closed = closeSqlConsoleTab(prev, tabId, activeTabId);
      if (prev.length === 1) {
        setActiveTabId(closed.activeTabId);
      }
      return closed.tabs;
    });
  };

  const handleOpenScript = (script: SqlConsoleScript) => {
    const existing = tabs.find((tab) => tab.savedScriptId === script.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    openTab(tabFromSavedScript(script));
  };

  const handleSaveClick = (tab: SqlConsoleTab) => {
    if (!tab.savedScriptId) {
      setPendingModal({ kind: 'save-script', tabId: tab.id });
      return;
    }
    void updateScriptMutation.mutateAsync({
      id: tab.savedScriptId,
      collectionId: tab.collectionId ?? null,
      folderId: tab.folderId,
      name: tab.name,
      sql: tab.sql,
      dataSourceId: effectiveDataSourceId,
    }).then(() => {
      updateTab(tab.id, { dirty: false });
      setRevealCollectionId(tab.collectionId ?? null);
    }).catch(() => {
      setPendingModal({ kind: 'save-script', tabId: tab.id });
    });
  };

  const runSql = useCallback(async (
    tab: SqlConsoleTab,
    sqlToRun: string,
    allowWrite = false,
  ): Promise<ExecuteDataSourceQueryResult | null> => {
    const dataSourceId = resolveSqlConsoleDataSourceId(tab.dataSourceId, dataSources);
    if (!sqlToRun || !dataSourceId) {
      updateTab(tab.id, { error: 'Pick a data source and enter a SELECT statement.', result: null });
      return null;
    }

    updateTab(tab.id, { isRunning: true, error: null, result: null });
    try {
      const nextResult = await runMutation.mutateAsync({ dataSourceId, sql: sqlToRun, allowWrite });
      updateTab(tab.id, { result: nextResult, isRunning: false });
      return nextResult;
    } catch (runError) {
      const message = isApiError(runError)
        ? formatApiErrorMessage(runError)
        : (runError instanceof Error ? runError.message : 'Failed to run SQL.');
      updateTab(tab.id, { isRunning: false, error: message });
      return null;
    }
  }, [dataSources, runMutation]);

  const runSuggestedSql = useCallback((tab: SqlConsoleTab, sql: string, allowWrite: boolean) => {
    updateTab(tab.id, { sql, dirty: true, error: null });
    return runSql(tab, sql.trim(), allowWrite);
  }, [runSql]);

  useSqlConsoleOverlayDeepLink({
    activeTabId,
    setActiveTabId,
    tabIds: tabs.map((tab) => tab.id),
    pendingModal,
    openNewCollectionModal: () => setPendingModal({ kind: 'new-collection' }),
    openSaveScriptModal: (tabId) => setPendingModal({ kind: 'save-script', tabId }),
  });

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full min-h-0 w-full bg-white', sidebarSplit.isResizing && 'select-none')}
    >
      <div
        className={cn(
          'flex min-h-0 shrink-0 flex-col overflow-hidden',
          sidebarSplit.collapsed && 'hidden',
        )}
        style={{ width: sidebarSplit.size > 0 ? sidebarSplit.size : undefined }}
      >
        <SqlConsoleSidebar
          onOpenScript={handleOpenScript}
          onNewCollection={() => setPendingModal({ kind: 'new-collection' })}
          onNewFolder={(collectionId, parentFolderId) => setPendingModal({ kind: 'new-folder', collectionId, parentFolderId })}
          revealCollectionId={revealCollectionId}
        />
      </div>
      <WorkspaceVerticalSplitHandle {...sidebarSplit.splitHandleProps} appearance="quiet" />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <UiWorkspaceTabs
          items={tabs.map((tab) => {
            const tabDataSourceId = resolveSqlConsoleDataSourceId(tab.dataSourceId, dataSources);
            const tabDataSource = dataSources.find((item) => item.id === tabDataSourceId) ?? null;
            const tabCanExplain = Boolean(tabDataSource && EXPLAIN_SUPPORTED_TYPES.has(tabDataSource.type));
            const tabCanRun = Boolean(tab.sql.trim()) && Boolean(tabDataSourceId) && !tab.isRunning;
            return {
              id: tab.id,
              label: tab.name,
              accessibleLabel: `${tab.name}, ${formatSqlConsoleConnectionTitle(tabDataSource)}`,
              hint: `${tab.name}\n${formatSqlConsoleConnectionTitle(tabDataSource)}`,
              dirty: tab.dirty,
              closeable: true,
              status: tab.isRunning ? 'loading' : tab.error ? 'error' : 'none',
              content: (
                <SqlConsoleDocument
                  tab={{ ...tab, dataSourceId: tabDataSourceId }}
                  dataSourceType={tabDataSource?.type}
                  canExplain={tabCanExplain}
                  canRun={tabCanRun}
                  onSqlChange={(sql) => updateTab(tab.id, { sql, dirty: true, error: null })}
                  onRun={() => { void runSql(tab, tab.sql.trim()); }}
                  onExplain={() => { void runSql(tab, `EXPLAIN ${tab.sql.trim()}`); }}
                  onSave={() => handleSaveClick(tab)}
                  onApplySample={(sql) => {
                    updateTab(tab.id, { sql, dirty: true, error: null });
                    void runSql(tab, sql.trim());
                  }}
                  onRunSuggestedSql={(sql, allowWrite) => runSuggestedSql(tab, sql, allowWrite)}
                />
              ),
            };
          })}
          selectedKey={activeTab.id}
          onSelectionChange={setActiveTabId}
          onClose={closeTab}
          addSlot={(
            <SqlConsoleNewTabMenu
              dataSources={dataSources}
              onPick={(dataSourceId) => openTab(createBlankSqlConsoleTab({ dataSourceId }))}
            />
          )}
          onRequestCloseDirty={async () => 'discard'}
          showAllTabsMenu={false}
          ariaLabel="Open queries"
          className="min-h-0 flex-1"
        />
      </div>

      {pendingModal?.kind === 'new-collection' ? (
        <NewCollectionModal onClose={() => setPendingModal(null)} onCreated={(collectionId) => setRevealCollectionId(collectionId)} />
      ) : null}
      {pendingModal?.kind === 'new-folder' ? (
        <NewFolderModal
          collectionId={pendingModal.collectionId}
          parentFolderId={pendingModal.parentFolderId}
          onClose={() => setPendingModal(null)}
        />
      ) : null}
      {pendingModal?.kind === 'save-script' ? (
        <SaveScriptModal
          tab={tabs.find((tab) => tab.id === pendingModal.tabId) ?? activeTab}
          dataSourceId={effectiveDataSourceId}
          onClose={() => setPendingModal(null)}
          onSaved={(info) => {
            updateTab(pendingModal.tabId, {
              savedScriptId: info.scriptId,
              collectionId: info.collectionId,
              folderId: info.folderId,
              name: info.name,
              dirty: false,
            });
            setRevealCollectionId(info.collectionId);
          }}
        />
      ) : null}
    </div>
  );
};
