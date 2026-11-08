import React, { useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { useViewportTier } from "../../shared/lib/useViewportTier";
import { isCompactChromeTier } from "../../shared/lib/viewportTokens";
import {
  UiWorkspaceTabs,
  WorkspaceVerticalSplitHandle,
  useWorkspaceVerticalSplitPanel,
  WORKSPACE_SPLIT_PANEL_KEYS,
} from "../../shared/ui";
import { formatApiErrorMessage, isApiError } from "../../shared/api/client";
import {
  useRunAdHocRequestMutation,
  useUpdateHttpWorkshopRequestMutation,
  type HttpWorkshopRequestSummary,
} from "../../shared/api/queries/api-talk";
import {
  authInputFromTab,
  createBlankTab,
  enabledWorkshopKeyValues,
  tabFromSavedRequest,
  type WorkshopTab,
} from "./apiTalkTabTypes";
import { ApiTalkSidebar } from "./ApiTalkSidebar";
import { ApiTalkRequestEditor } from "./ApiTalkRequestEditor";
import { NewCollectionModal, NewFolderModal, SaveRequestModal } from "./ApiTalkModals";

type PendingModal =
  | { kind: "new-collection" }
  | { kind: "new-folder"; collectionId: string; parentFolderId: string | null }
  | { kind: "save-request"; tabId: string }
  | null;

export const ApiTalkPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportTier = useViewportTier();
  const compactChrome = isCompactChromeTier(viewportTier);
  const [tabs, setTabs] = useState<WorkshopTab[]>(() => [createBlankTab()]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const [pendingModal, setPendingModal] = useState<PendingModal>(null);
  const sidebarSplit = useWorkspaceVerticalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.apiTalkSidebar,
    defaultSize: 288,
    minSize: 200,
    maxSize: 480,
    measure: "leading",
    containerRef,
    side: "start",
    defaultCollapsed: compactChrome,
    collapsible: true,
    displayClassName: compactChrome ? "max-lg:block" : "block",
  });

  const runAdHocMutation = useRunAdHocRequestMutation();
  const updateRequestMutation = useUpdateHttpWorkshopRequestMutation();

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const updateTab = (tabId: string, patch: Partial<WorkshopTab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab)));
  };

  const openTab = (tab: WorkshopTab) => {
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== tabId);
      if (next.length === 0) {
        const fresh = createBlankTab();
        setActiveTabId(fresh.id);
        return [fresh];
      }
      return next;
    });
  };

  const handleOpenRequest = (request: HttpWorkshopRequestSummary) => {
    const existing = tabs.find((tab) => tab.savedRequestId === request.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    openTab(tabFromSavedRequest(request));
  };

  const handleNewRequestAt = (collectionId: string, folderId: string | null) => {
    openTab({ ...createBlankTab("Untitled request"), collectionId, folderId, authKind: "none" });
  };

  const handleSend = async (tab: WorkshopTab) => {
    if (tab.bodyMode === "json" && tab.bodyRaw.trim()) {
      try {
        JSON.parse(tab.bodyRaw);
      } catch {
        updateTab(tab.id, { isSending: false, sendError: "Request body is not valid JSON." });
        return;
      }
    }
    updateTab(tab.id, { isSending: true, sendError: null });
    try {
      const result = await runAdHocMutation.mutateAsync({
        method: tab.method,
        url: tab.url,
        queryParams: enabledWorkshopKeyValues(tab.queryParams),
        headers: enabledWorkshopKeyValues(tab.headers),
        bodyMode: tab.bodyMode,
        bodyRaw: tab.bodyMode !== "none" ? tab.bodyRaw : undefined,
        auth: authInputFromTab(tab),
        savedRequestId: tab.savedRequestId,
        assertions: tab.assertions,
      });
      updateTab(tab.id, { response: result, assertionResults: result.assertionResults, isSending: false });
    } catch (error) {
      const message = isApiError(error) ? formatApiErrorMessage(error) : (error instanceof Error ? error.message : "Request failed.");
      updateTab(tab.id, { isSending: false, sendError: message });
    }
  };

  const handleSaveClick = (tab: WorkshopTab) => {
    if (!tab.savedRequestId || !tab.collectionId) {
      setPendingModal({ kind: "save-request", tabId: tab.id });
      return;
    }
    void updateRequestMutation.mutateAsync({
      id: tab.savedRequestId,
      collectionId: tab.collectionId,
      folderId: tab.folderId,
      name: tab.name,
      method: tab.method,
      url: tab.url,
      queryParams: tab.queryParams ?? [],
      headers: tab.headers ?? [],
      bodyMode: tab.bodyMode,
      bodyRaw: tab.bodyMode !== "none" ? tab.bodyRaw : undefined,
      auth: authInputFromTab(tab),
      assertions: tab.assertions,
    }).then(() => updateTab(tab.id, { dirty: false }));
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-h-0 w-full bg-white", sidebarSplit.isResizing && "select-none")}
    >
      <div
        className={cn(
          "flex min-h-0 shrink-0 flex-col overflow-hidden",
          sidebarSplit.collapsed && "hidden",
        )}
        style={{ width: sidebarSplit.size > 0 ? sidebarSplit.size : undefined }}
      >
        <ApiTalkSidebar
          onOpenRequest={handleOpenRequest}
          onNewRequest={handleNewRequestAt}
          onNewCollection={() => setPendingModal({ kind: "new-collection" })}
          onNewFolder={(collectionId, parentFolderId) => setPendingModal({ kind: "new-folder", collectionId, parentFolderId })}
        />
      </div>
      <WorkspaceVerticalSplitHandle {...sidebarSplit.splitHandleProps} appearance="quiet" />

      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <UiWorkspaceTabs
          items={tabs.map((tab) => ({
            id: tab.id,
            label: tab.name,
            dirty: tab.dirty,
            closeable: true,
            status: tab.isSending ? "loading" : tab.sendError ? "error" : "none",
            content: (
              <div className="h-full min-h-0">
                <ApiTalkRequestEditor
                  tab={tab}
                  onChange={(patch) => updateTab(tab.id, patch)}
                  onSend={() => { void handleSend(tab); }}
                  onSave={() => handleSaveClick(tab)}
                  canInheritAuth={Boolean(tab.collectionId)}
                />
              </div>
            ),
          }))}
          selectedKey={activeTab.id}
          onSelectionChange={setActiveTabId}
          onClose={closeTab}
          onAdd={() => openTab(createBlankTab())}
          onRequestCloseDirty={async () => "discard"}
          showAllTabsMenu={false}
          showAddButton
          ariaLabel="Open requests"
          className="min-h-0 flex-1"
        />
      </div>

      {pendingModal?.kind === "new-collection" ? (
        <NewCollectionModal onClose={() => setPendingModal(null)} onCreated={() => {}} />
      ) : null}
      {pendingModal?.kind === "new-folder" ? (
        <NewFolderModal
          collectionId={pendingModal.collectionId}
          parentFolderId={pendingModal.parentFolderId}
          onClose={() => setPendingModal(null)}
        />
      ) : null}
      {pendingModal?.kind === "save-request" ? (
        <SaveRequestModal
          tab={tabs.find((tab) => tab.id === pendingModal.tabId) ?? activeTab}
          onClose={() => setPendingModal(null)}
          onSaved={(info) => updateTab(pendingModal.tabId, {
            savedRequestId: info.requestId,
            collectionId: info.collectionId,
            folderId: info.folderId,
            name: info.name,
            dirty: false,
          })}
        />
      ) : null}
    </div>
  );
};
