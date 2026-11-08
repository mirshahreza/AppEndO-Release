import React, { useMemo } from "react";

import { ChevronDown, ChevronUp, FolderPlus, Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";

import { formatQueryError } from "../../../shared/api/client";

import {
  AppButton,
  AppTableGrid,
  CreateEditModalShell,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ToolbarBuiltInFilter,
  UiInput,
  ListPageToolbarFrame,
  ListPageShell,
} from '../../../shared/ui';

import { cn } from "../../../lib/utils";

import {
  CREATE_EDIT_MODAL_BODY_INNER_CLASS,
} from "../../../shared/ui/surfaceClasses";

import { useCultureT } from "../../../core/culture/CultureContext";

import {
  NAVIGATION_EDITOR_ID_CLASS,
  NAVIGATION_EDITOR_SIDE_PANEL_CLASS,
} from "../constants";

import { getNavigationItemAtPath } from "../lib/navigationTreeRows";

import type {
  PlatformNavigationsPageModel,
} from "../hooks/usePlatformNavigationsPage";

import { NavigationDeleteModal } from "./NavigationDeleteModal";

import { NavigationItemEditorPanel } from "./NavigationItemEditorPanel";
import { APP_LIST_PREFERENCE_KEYS } from "../../../shared/lib/listPreferenceKeys";

import { NavigationManifestJsonEditor } from "./NavigationManifestJsonEditor";

import { NavigationTreeEditor } from "./NavigationTreeEditor";

type NavigationsPageViewProps = {
  page: PlatformNavigationsPageModel;
};

const FIELD_CLASS = "flex flex-col gap-[2px]";

const LABEL_CLASS = "ps-[4px] text-xs font-semibold text-slate-600";

const PANEL_SECTION_LABEL_CLASS =
  "ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500";

export const NavigationsPageView: React.FC<NavigationsPageViewProps> = ({
  page,
}) => {
  const t = useCultureT();

  const editorModeOptions = useMemo(
    () => [
      { value: "tree" as const, label: t("navigations.editorModeTree") },
      { value: "json" as const, label: t("navigations.editorModeJson") },
    ],
    [t],
  );

  const loadError = page.listQuery.isError ? page.listQuery.error : null;

  const selectedRow = page.selection;

  const selectedItem =
    selectedRow?.nodeKind === "item" && page.workingManifest
      ? getNavigationItemAtPath(
          page.workingManifest.groups[selectedRow.groupIndex]!,

          selectedRow.itemPath,
        )
      : null;

  return (
    <ListPageShell onGridScroll={page.onGridScroll}>
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarBuiltInFilter
            value={page.builtInFilter}
            onChange={page.setBuiltInFilter}
          />
        </div>

        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ToolbarActionGroupWithRefresh
            onRefresh={() => { void page.listQuery.refetch(); }}
            isRefreshing={page.listQuery.isFetching && !page.listQuery.isLoading}
            actions={[
              {
                id: "add-navigation",
                label: t("navigations.addNavigation"),
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: "create",
                primary: true,
                onClick: () => {
                  page.setFormError(null);
                  page.setCreateModalOpen(true);
                },
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      {page.formError && !page.editorId && !page.deleteTargetId ? (
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {page.formError}
        </div>
      ) : null}

      <AppTableGrid
        persistListKey={APP_LIST_PREFERENCE_KEYS.platformNavigations}
        columns={page.gridColumns}
        rows={page.displayItems}
        getRowKey={(row) => row.id}
        compact={{ tablet: { cardsPerRow: 2 } }}
        isLoading={page.listQuery.isLoading}
        loadingMessage={t("navigations.loading")}
        errorContent={
          loadError ? (
            <QueryErrorPanel
              message={t("navigations.loadFailed")}
              detail={formatQueryError(
                loadError,
                t("navigations.loadFailedDetail"),
              )}
              onRetry={() => {
                void page.retryLoad();
              }}
            />
          ) : undefined
        }
        isEmpty={!page.listQuery.isLoading && page.displayItems.length === 0}
        emptyMessage={t("navigations.empty")}
      />

      {page.createModalOpen ? (
        <CreateEditModalShell
          title={t("navigations.addManifest")}
          onClose={() => page.setCreateModalOpen(false)}
          footer={
            <>
              <AppButton
                intent="cancel"
                onClick={() => page.setCreateModalOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
                {t("actions.cancel")}
              </AppButton>

              <AppButton
                intent="primary"
                disabled={page.isSaving}
                onClick={() => {
                  void page.createManifest();
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                {page.isSaving ? t("navigations.creating") : t("actions.create")}
              </AppButton>
            </>
          }
        >
          <div className={CREATE_EDIT_MODAL_BODY_INNER_CLASS}>
            <div className={FIELD_CLASS}>
              <label className={LABEL_CLASS}>{t("navigations.idLabel")}</label>

              <UiInput
                size="sm"
                autoDir={false}
                value={page.createIdInput}
                placeholder={t("navigations.idPlaceholder")}
                onChange={(event) => page.setCreateIdInput(event.target.value)}
              />

              <p className="mt-[2px] ps-[4px] text-[10px] text-slate-500">
                {t("navigations.idHelper")}
              </p>
            </div>
          </div>
        </CreateEditModalShell>
      ) : null}

      <NavigationDeleteModal
        targetId={page.deleteTargetId}
        deleteError={page.deleteTargetId ? page.formError : null}
        isDeleting={page.isSaving}
        onCancel={() => {
          page.setDeleteTargetId(null);

          page.setFormError(null);
        }}
        onConfirm={() => {
          void page.removeManifest(page.deleteTargetId!);
        }}
      />

      {page.editorId ? (
        <CreateEditModalShell
          size="maximized"
          bodyOuterClassName="flex min-h-0 flex-1 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          title={t("navigations.editManifest")}
          onClose={page.closeEditor}
          footer={
            <>
              <AppButton intent="cancel" onClick={page.closeEditor}>
                <X className="h-3.5 w-3.5" />
                {t("actions.cancel")}
              </AppButton>

              {!page.isEditorReadOnly ? (
                <>
                  <AppButton
                    intent="utility"
                    onClick={page.editorActions.resetDraft}
                    disabled={!page.isEditorDirty}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("navigations.reset")}
                  </AppButton>

                  <AppButton
                    intent="primary"
                    onClick={() => {
                      void page.saveEditor();
                    }}
                    disabled={!page.canSaveEditor}
                  >
                    {page.isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {t("actions.save")}
                  </AppButton>
                </>
              ) : null}
            </>
          }
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {page.formError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {page.formError}
              </div>
            ) : null}

            {page.isEditorBuiltIn ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t("navigations.builtinReadOnlyBanner")}
              </div>
            ) : null}

            {page.detailQuery.isLoading || !page.workingManifest ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                {t("navigations.loadingTree")}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <div className="flex shrink-0 items-center gap-2">
                  <div className={NAVIGATION_EDITOR_ID_CLASS}>
                    {page.workingManifest.id}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <AppButton
                      intent="create"
                      size="sm"
                      disabled={page.editorMode !== "tree"}
                      onClick={page.editorActions.addGroup}
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      {t("navigations.addGroup")}
                    </AppButton>

                    <AppButton
                      intent="create"
                      size="sm"
                      disabled={page.editorMode !== "tree"}
                      onClick={page.editorActions.addItemAtSelection}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("navigations.addItem")}
                    </AppButton>

                    <AppButton
                      intent="utility"
                      size="sm"
                      disabled={page.editorMode !== "tree" || !page.canMoveTreeNodeStep("up")}
                      onClick={() => page.moveTreeNodeStep("up")}
                      aria-label={t("navigations.moveNodeUpAria")}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </AppButton>

                    <AppButton
                      intent="utility"
                      size="sm"
                      disabled={page.editorMode !== "tree" || !page.canMoveTreeNodeStep("down")}
                      onClick={() => page.moveTreeNodeStep("down")}
                      aria-label={t("navigations.moveNodeDownAria")}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </AppButton>
                  </div>

                  <span className="mx-2 h-4 shrink-0 border-s border-slate-200" aria-hidden="true" />

                  <div
                    role="tablist"
                    aria-label={t("navigations.editorModeAria")}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white p-1"
                  >
                    {editorModeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={page.editorMode === option.value}
                        className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none ${
                          page.editorMode === option.value
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-500 hover:text-indigo-700"
                        }`}
                        onClick={() => page.setEditorMode(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {page.jsonError && page.editorMode === "json" ? (
                  <div className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 whitespace-pre-wrap">
                    {page.jsonError}
                  </div>
                ) : null}

                {page.editorMode === "json" ? (
                  <NavigationManifestJsonEditor
                    value={page.jsonText}
                    readOnly={page.isEditorReadOnly}
                    onChange={page.handleJsonTextChange}
                  />
                ) : (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <NavigationTreeEditor
                    page={page}
                    manifest={page.workingManifest}
                  />

                  {selectedRow ? (
                    <aside className={NAVIGATION_EDITOR_SIDE_PANEL_CLASS}>
                      <p className={PANEL_SECTION_LABEL_CLASS}>
                        {selectedRow.nodeKind === "group"
                          ? t("navigations.nodeGroup")
                          : selectedRow.nodeKind === "separator"
                            ? t("navigations.nodeSeparator")
                            : t("navigations.nodeItem")}
                      </p>

                      {selectedRow.nodeKind === "group" ? (
                        <>
                          <div className={FIELD_CLASS}>
                            <label className={LABEL_CLASS}>{t("navigations.groupHeading")}</label>

                            <UiInput
                              size="sm"
                              value={
                                page.workingManifest.groups[selectedRow.groupIndex]
                                  ?.heading ?? ""
                              }
                              onChange={(event) => {
                                page.editorActions.updateGroupHeading(
                                  selectedRow.groupIndex,
                                  event.target.value.trim() || null,
                                );
                              }}
                            />
                          </div>

                          <div className={FIELD_CLASS}>
                            <label className={LABEL_CLASS}>{t("navigations.collapsedLabel")}</label>

                            <UiInput
                              size="sm"
                              value={
                                page.workingManifest.groups[selectedRow.groupIndex]
                                  ?.collapsedLabel ?? ""
                              }
                              placeholder={t("navigations.collapsedLabelPlaceholder")}
                              ariaLabel={t("navigations.collapsedLabel")}
                              onChange={(event) => {
                                page.editorActions.updateGroupCollapsedLabel(
                                  selectedRow.groupIndex,
                                  event.target.value.trim() || null,
                                );
                              }}
                            />
                          </div>

                          <AppButton
                            intent="danger"
                            size="sm"
                            className="self-start"
                            onClick={() =>
                              page.editorActions.removeGroup(
                                selectedRow.groupIndex,
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("navigations.removeGroup")}
                          </AppButton>
                        </>
                      ) : null}

                      {selectedRow.nodeKind === "item" &&
                      selectedItem &&
                      selectedItem.type !== "separator" ? (
                        <NavigationItemEditorPanel
                          page={page}
                          groupIndex={selectedRow.groupIndex}
                          itemPath={selectedRow.itemPath}
                          item={selectedItem}
                        />
                      ) : null}

                      {selectedRow.nodeKind === "separator" ? (
                        <p className="ps-[4px] text-xs text-slate-500">
                          {t("navigations.separatorDescription")}
                        </p>
                      ) : null}
                    </aside>
                  ) : null}
                </div>
                )}
              </div>
            )}
          </div>
        </CreateEditModalShell>
      ) : null}
    </ListPageShell>
  );
};
