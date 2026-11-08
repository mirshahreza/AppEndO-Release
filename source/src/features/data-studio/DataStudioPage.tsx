import React, { useMemo } from 'react';
import { RefreshCcw } from 'lucide-react';
import {
  AppToast,
  DIALOG_TOAST_Z_CLASS,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  UiSelect,
  ListPageToolbarFrame,
} from '../../shared/ui';
import { cn } from '../../lib/utils';
import { ListPageToolbarScrollRoot } from '../../shared/ui/list-page/listPageToolbarChrome';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../shared/ui/shell/pageGuide/pageGuideChrome';
import { DataSourceConnectionSelect } from '../data-sources/components/DataSourceConnectionSelect';
import { DATA_STUDIO_EXPLORER_OBJECT_KIND_OPTIONS } from './lib/explorerObjectKinds';
import { DeleteSchemaObjectDialog } from './components/DeleteSchemaObjectDialog';
import { DeleteDataApiDialog } from './components/DeleteDataApiDialog';
import { TruncateTableDialog } from './components/TruncateTableDialog';
import { ConfigureDataApiDialog } from './components/ConfigureDataApiDialog';
import { ConfigureFunctionApiDialog } from './components/ConfigureFunctionApiDialog';
import { CreateObjectToolbarButton } from './components/CreateObjectToolbarButton';
import { CreateSchemaObjectDialog } from './components/CreateSchemaObjectDialog';
import { DataStudioObjectCardGrid } from './components/DataStudioObjectCardGrid';
import { EdgeModelModelerWorkspace } from './components/EdgeModelModelerWorkspace';
import { SchemaObjectSqlLayer } from './components/SchemaObjectSqlLayer';
import { SchemaObjectRunLayer } from './components/SchemaObjectRunLayer';
import { EdgeModelDesignerLayer } from './components/EdgeModelDesignerLayer';
import { EdgeModelDatasheetLayer } from './components/EdgeModelDatasheetLayer';
import { EdgeModelRelationsLayer } from './components/EdgeModelRelationsLayer';
import { SyncModelsDialog } from './components/SyncModelsDialog';
import { useDataStudioPage } from './hooks/useDataStudioPage';
import { useDataStudioModelerShellHeader } from './hooks/useDataStudioModelerShellHeader';
import type { DataStudioExplorerCardActions } from './types';

export const DataStudioPage: React.FC = () => {
  const page = useDataStudioPage();

  useDataStudioModelerShellHeader({
    enabled: Boolean(page.editSlugFromUrl || page.openModelId),
  });

  const cardActions = useMemo<DataStudioExplorerCardActions>(() => ({
    pendingSqlEditorRowId: page.pendingSqlEditorRowId,
    pendingRunRowId: page.pendingRunRowId,
    pendingModelerRowId: page.pendingModelerRowId,
    pendingDatasheetRowId: page.pendingDatasheetRowId,
    onOpenDesigner: page.handleOpenDesigner,
    onOpenDatasheet: (row) => { void page.handleOpenDatasheet(row); },
    onOpenModeler: (row) => { void page.handleOpenModeler(row); },
    resolveModelerHref: page.resolveModelerHref,
    onOpenSqlEditor: page.handleOpenSqlEditor,
    onOpenRunPanel: (row) => { void page.handleOpenRunPanel(row); },
    onOpenRelations: page.handleOpenRelations,
    onDeleteObject: page.handleOpenDeleteObjectDialog,
  }), [
    page.handleOpenDesigner,
    page.handleOpenDatasheet,
    page.handleOpenModeler,
    page.resolveModelerHref,
    page.handleOpenSqlEditor,
    page.handleOpenRunPanel,
    page.handleOpenRelations,
    page.handleOpenDeleteObjectDialog,
    page.pendingModelerRowId,
    page.pendingDatasheetRowId,
    page.pendingRunRowId,
    page.pendingSqlEditorRowId,
  ]);

  const modelerConfirmDialogOpen = Boolean(
    page.truncateTableTarget
    || page.deleteObjectTarget
    || page.deleteApiTarget
    || page.configureApiTarget
    || page.configureFunctionApiTarget,
  );

  if (page.openModelId) {
    return (
      <>
        {page.toast ? (
          <AppToast
            type={page.toast.type}
            text={page.toast.text}
            className={modelerConfirmDialogOpen ? DIALOG_TOAST_Z_CLASS : undefined}
            onDismiss={page.toast.persistent ? page.handleDismissToast : undefined}
          />
        ) : null}
        <EdgeModelDesignerLayer manager={page.designerManager} />
        <EdgeModelDatasheetLayer manager={page.datasheetManager} />
        <EdgeModelRelationsLayer manager={page.relationsManager} />
        <ConfigureDataApiDialog
          target={page.configureApiTarget}
          onClose={page.handleCloseConfigureApiWizard}
          onPublished={page.handleConfigureApiPublished}
        />
        <ConfigureFunctionApiDialog
          target={page.configureFunctionApiTarget}
          onClose={page.handleCloseConfigureFunctionApi}
          onSaved={page.handleFunctionApiSaved}
        />
        <DeleteDataApiDialog
          target={page.deleteApiTarget}
          isSubmitting={page.isDeletingApi}
          onCancel={page.handleCloseDeleteApiDialog}
          onConfirm={() => { void page.handleConfirmDeleteApi(); }}
        />
        <DeleteSchemaObjectDialog
          target={page.deleteObjectTarget}
          dataSourceId={page.resolveExplorerRowDataSourceId(page.deleteObjectTarget)}
          isSubmitting={page.isDeletingObject}
          onCancel={page.handleCloseDeleteObjectDialog}
          onConfirm={() => { void page.handleConfirmDeleteObject(); }}
        />
        <TruncateTableDialog
          target={page.truncateTableTarget}
          isSubmitting={page.isTruncatingTable}
          error={page.truncateTableError}
          onCancel={page.handleCloseTruncateTableDialog}
          onConfirm={() => { void page.handleConfirmTruncateTable(); }}
        />
        <EdgeModelModelerWorkspace
          modelId={page.openModelId}
          onBack={() => page.setOpenModelId(null)}
          onOpenRelations={page.handleOpenModelerRelations}
          onOpenDesigner={page.handleOpenModelerDesigner}
          onOpenDatasheet={page.handleOpenModelerDatasheet}
          onCreateApi={page.handleOpenModelerCreateApi}
          onEditApi={page.handleOpenModelerEditApi}
          onEditFunctionApi={page.handleOpenModelerEditFunctionApi}
          onDeleteApi={page.handleOpenDeleteApiDialog}
          onOpenObject={page.handleOpenDependencyObject}
          resolveObjectHref={page.resolveDependencyObjectHref}
          onDeleteObject={page.handleOpenModelerDeleteObjectDialog}
          onTruncateTable={page.handleOpenModelerTruncateTableDialog}
          isDeletingObject={page.isDeletingObject}
          isTruncatingTable={page.isTruncatingTable}
        />
      </>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-white font-sans">
      {page.toast ? (
        <AppToast
          type={page.toast.type}
          text={page.toast.text}
          className={page.deleteObjectTarget ? DIALOG_TOAST_Z_CLASS : undefined}
          onDismiss={page.toast.persistent ? page.handleDismissToast : undefined}
        />
      ) : null}
      <EdgeModelDesignerLayer manager={page.designerManager} />
      <EdgeModelDatasheetLayer manager={page.datasheetManager} />
      <EdgeModelRelationsLayer manager={page.relationsManager} />
      <SchemaObjectSqlLayer
        manager={page.sqlPanelManager}
        isSubmitting={page.isExecutingSchemaObjectSql}
        onExecute={page.handleExecuteSchemaObjectSql}
        onOpenObject={page.handleOpenDependencyObject}
        resolveObjectHref={page.resolveDependencyObjectHref}
        onImportantMessage={page.handleShowImportantSqlMessage}
      />
      <SchemaObjectRunLayer
        manager={page.runPanelManager}
        isSubmitting={page.isRunningSchemaObjectSql}
        onRun={page.handleRunSchemaObjectSql}
      />
      <DeleteSchemaObjectDialog
        target={page.deleteObjectTarget}
        dataSourceId={page.resolveExplorerRowDataSourceId(page.deleteObjectTarget)}
        isSubmitting={page.isDeletingObject}
        onCancel={page.handleCloseDeleteObjectDialog}
        onConfirm={() => { void page.handleConfirmDeleteObject(); }}
      />
      <SyncModelsDialog
        syncModels={page.syncModels}
        dataSourceName={page.selectedDataSource?.name ?? null}
      />
      <CreateSchemaObjectDialog
        open={page.createObjectDialog.open}
        objectKind={page.createObjectDialog.objectKind}
        dataSourceName={page.selectedDataSource?.name ?? null}
        isSubmitting={page.isExecutingSchemaObjectSql}
        onClose={page.handleCloseCreateObjectDialog}
        onSubmit={(objectName) => { void page.handleCreateObject(objectName); }}
      />
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <div className="w-full min-w-0 sm:w-56">
            <DataSourceConnectionSelect
              size="sm"
              value={page.selectedDataSourceId}
              onChange={page.setSelectedDataSourceId}
              dataSources={page.dataSources}
              disabled={page.isEmptyConnections}
              ariaLabel="Data source connection"
            />
          </div>
          <div
            className="w-full min-w-0 sm:w-56"
            {...pageGuideLocalProps(
              PAGE_GUIDE_EN['pageGuide.page.objectKind.title'],
              PAGE_GUIDE_EN['pageGuide.page.objectKind.hint'],
              17,
            )}
          >
            <UiSelect
              size="sm"
              value={page.objectKind}
              onChange={(event) => page.setObjectKind(event.target.value as typeof page.objectKind)}
              ariaLabel="Schema object type"
              disabled={!page.selectedDataSourceId}
            >
              {DATA_STUDIO_EXPLORER_OBJECT_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </UiSelect>
          </div>
          <ToolbarSearchInput
            value={page.searchInput}
            onChange={page.setSearchInput}
            placeholder="Filter objects…"
            disabled={!page.selectedDataSourceId}
          />
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <CreateObjectToolbarButton
            disabled={!page.selectedDataSourceId || page.isExecutingSchemaObjectSql}
            dataSourceType={page.selectedDataSource?.type ?? null}
            onPickKind={page.handleOpenCreateObjectDialog}
          />
          <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
          <ToolbarActionGroupWithRefresh
            onRefresh={page.retryLoad}
            isRefreshing={page.isRefreshing}
            actions={[
              {
                id: 'sync-models',
                label: 'Sync Models',
                icon: <RefreshCcw className={cn('h-3.5 w-3.5', page.syncModels.state.isRunning && 'animate-spin')} aria-hidden="true" />,
                intent: 'utility',
                disabled: !page.selectedDataSourceId || page.syncModels.state.isRunning,
                onClick: () => { void page.handleSyncModels(); },
                guideHint: PAGE_GUIDE_EN['pageGuide.page.syncModels.hint'],
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      <DataStudioObjectCardGrid
        rows={page.displayItems}
        dataSourceId={page.selectedDataSourceId}
        dataSourceType={page.selectedDataSource?.type ?? null}
        actions={cardActions}
        isLoading={page.isLoading}
        isError={page.isError}
        error={page.error}
        onRetry={page.retryLoad}
        isRetrying={page.isRefreshing}
        emptyMessage={
          page.isEmptyConnections
            ? 'No data source connections are configured.'
            : 'No objects found for the selected connection and type.'
        }
        onScroll={page.handleGridScroll}
      />
    </div>
  );
};
