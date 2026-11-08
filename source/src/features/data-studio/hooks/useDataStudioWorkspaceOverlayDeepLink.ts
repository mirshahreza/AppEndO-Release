import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import type { ConfigureFunctionApiMode } from '../components/ConfigureFunctionApiDialog';
import type { ConfigureDataApiTarget } from '../components/ConfigureDataApiDialog';
import {
  DATA_STUDIO_OVERLAY_DIALOG_SYNC_MODELS,
  parseDataStudioConfigureApiOverlayToken,
  parseDataStudioConfigureFunctionApiOverlayToken,
  parseDataStudioDeleteApiOverlayToken,
  parseDataStudioDeleteObjectOverlayToken,
  parseDataStudioTruncateTableOverlayToken,
  resolveDataStudioWorkspaceOverlayToken,
} from '../lib/dataStudioConfirmOverlay';
import {
  DATA_STUDIO_OVERLAY_DIALOG_CREATE_OBJECT,
  DATA_STUDIO_OVERLAY_PANEL_DATASHEET,
  DATA_STUDIO_OVERLAY_PANEL_DESIGNER,
  DATA_STUDIO_OVERLAY_PANEL_RELATIONS,
  parseDataStudioObjectScopedPanelOverlay,
} from '../lib/dataStudioWorkspaceOverlay';
import type { CreateObjectDialogState } from './useDataStudioPage';
import type { useEdgeModelDesignerManager } from './useEdgeModelDesignerManager';
import type { useEdgeModelDatasheetManager } from './useEdgeModelDatasheetManager';
import type { useEdgeModelRelationsManager } from './useEdgeModelRelationsManager';
import type { useSchemaObjectSqlPanelManager } from './useSchemaObjectSqlPanelManager';
import type { useSchemaObjectRunPanelManager } from './useSchemaObjectRunPanelManager';
import type { DataStudioExplorerObjectRow } from '../types';

type UseDataStudioWorkspaceOverlayDeepLinkArgs = {
  createObjectDialog: CreateObjectDialogState;
  designerManager: ReturnType<typeof useEdgeModelDesignerManager>;
  datasheetManager: ReturnType<typeof useEdgeModelDatasheetManager>;
  relationsManager: ReturnType<typeof useEdgeModelRelationsManager>;
  sqlPanelManager: ReturnType<typeof useSchemaObjectSqlPanelManager>;
  runPanelManager: ReturnType<typeof useSchemaObjectRunPanelManager>;
  openModelId: string | null;
  handleOpenModelerDesigner: () => void;
  handleOpenModelerDatasheet: () => void | Promise<void>;
  handleOpenModelerRelations: () => void;
  handleOpenCreateObjectDialog: (kind: DataStudioExplorerObjectRow['objectKind']) => void;
  handleOpenSqlEditor: (row: DataStudioExplorerObjectRow) => void;
  handleOpenRunPanel: (row: DataStudioExplorerObjectRow) => void | Promise<void>;
  rows: DataStudioExplorerObjectRow[];
  syncModelsOpen: boolean;
  handleSyncModels: () => void | Promise<void>;
  deleteApiTarget: EdgeApiDefinition | null;
  handleOpenDeleteApiDialog: (definition: EdgeApiDefinition) => void;
  edgeApiDefinitions: EdgeApiDefinition[];
  deleteObjectTarget: DataStudioExplorerObjectRow | null;
  handleOpenDeleteObjectDialog: (row: DataStudioExplorerObjectRow) => void;
  truncateTableTarget: DataStudioExplorerObjectRow | null;
  handleOpenModelerTruncateTableDialog: (row: DataStudioExplorerObjectRow) => void;
  configureApiTarget: ConfigureDataApiTarget | null;
  handleOpenModelerCreateApi: () => void;
  handleOpenModelerEditApi: (definitionId: string) => void;
  configureFunctionApiTarget: { fn: ServerFunctionItem; mode: ConfigureFunctionApiMode } | null;
  handleOpenModelerEditFunctionApi: (fn: ServerFunctionItem, mode?: ConfigureFunctionApiMode) => void;
  serverFunctions: ServerFunctionItem[];
};

export function useDataStudioWorkspaceOverlayDeepLink(
  args: UseDataStudioWorkspaceOverlayDeepLinkArgs,
): void {
  const activeToken = useMemo(
    () => resolveDataStudioWorkspaceOverlayToken({
      createObjectDialogOpen: args.createObjectDialog.open,
      designerPanels: args.designerManager.panels,
      datasheetPanels: args.datasheetManager.panels,
      relationsPanels: args.relationsManager.panels,
      sqlPanels: args.sqlPanelManager.panels,
      runPanels: args.runPanelManager.panels,
      syncModelsOpen: args.syncModelsOpen,
      deleteApiTarget: args.deleteApiTarget,
      deleteObjectTarget: args.deleteObjectTarget,
      truncateTableTarget: args.truncateTableTarget,
      configureApiTarget: args.configureApiTarget,
      configureFunctionApiTarget: args.configureFunctionApiTarget,
    }),
    [
      args.configureApiTarget,
      args.configureFunctionApiTarget,
      args.createObjectDialog.open,
      args.deleteApiTarget,
      args.deleteObjectTarget,
      args.designerManager.panels,
      args.datasheetManager.panels,
      args.relationsManager.panels,
      args.runPanelManager.panels,
      args.sqlPanelManager.panels,
      args.syncModelsOpen,
      args.truncateTableTarget,
    ],
  );

  const findRow = useCallback((
    objectKind: DataStudioExplorerObjectRow['objectKind'],
    objectName: string,
  ) => args.rows.find(
    (row) => row.objectKind === objectKind && row.name.toLowerCase() === objectName.toLowerCase(),
  ), [args.rows]);

  const openFromUrl = useCallback((token: string) => {
    if (token === DATA_STUDIO_OVERLAY_DIALOG_SYNC_MODELS) {
      void args.handleSyncModels();
      return;
    }

    const deleteApiId = parseDataStudioDeleteApiOverlayToken(token);
    if (deleteApiId) {
      const definition = args.edgeApiDefinitions.find((item) => item.id === deleteApiId);
      if (definition) {
        args.handleOpenDeleteApiDialog(definition);
      }
      return;
    }

    const deleteObject = parseDataStudioDeleteObjectOverlayToken(token);
    if (deleteObject) {
      const row = findRow(deleteObject.objectKind, deleteObject.objectName);
      if (row) {
        args.handleOpenDeleteObjectDialog(row);
      }
      return;
    }

    const truncateTarget = parseDataStudioTruncateTableOverlayToken(token);
    if (truncateTarget) {
      const row = findRow(truncateTarget.objectKind, truncateTarget.objectName);
      if (row) {
        args.handleOpenModelerTruncateTableDialog(row);
      }
      return;
    }

    const configureApi = parseDataStudioConfigureApiOverlayToken(token);
    if (configureApi === 'create') {
      args.handleOpenModelerCreateApi();
      return;
    }
    if (configureApi) {
      args.handleOpenModelerEditApi(configureApi);
      return;
    }

    const configureFunction = parseDataStudioConfigureFunctionApiOverlayToken(token);
    if (configureFunction) {
      const fn = args.serverFunctions.find((item) => item.id === configureFunction.fnId);
      if (fn) {
        args.handleOpenModelerEditFunctionApi(fn, configureFunction.mode);
      }
      return;
    }

    if (token === DATA_STUDIO_OVERLAY_DIALOG_CREATE_OBJECT) {
      args.handleOpenCreateObjectDialog(args.createObjectDialog.objectKind);
      return;
    }

    if (args.openModelId) {
      if (token === DATA_STUDIO_OVERLAY_PANEL_DESIGNER) {
        args.handleOpenModelerDesigner();
        return;
      }
      if (token === DATA_STUDIO_OVERLAY_PANEL_DATASHEET) {
        void args.handleOpenModelerDatasheet();
        return;
      }
      if (token === DATA_STUDIO_OVERLAY_PANEL_RELATIONS) {
        args.handleOpenModelerRelations();
        return;
      }
    }

    const sqlTarget = parseDataStudioObjectScopedPanelOverlay(token, 'panel/sql');
    if (sqlTarget) {
      const row = findRow(sqlTarget.objectKind, sqlTarget.objectName);
      if (row) {
        args.handleOpenSqlEditor(row);
      }
      return;
    }

    const runTarget = parseDataStudioObjectScopedPanelOverlay(token, 'panel/run');
    if (runTarget) {
      const row = findRow(runTarget.objectKind, runTarget.objectName);
      if (row) {
        void args.handleOpenRunPanel(row);
      }
    }
  }, [
    args.configureFunctionApiTarget,
    args.createObjectDialog.objectKind,
    args.edgeApiDefinitions,
    args.handleOpenCreateObjectDialog,
    args.handleOpenDeleteApiDialog,
    args.handleOpenDeleteObjectDialog,
    args.handleOpenModelerCreateApi,
    args.handleOpenModelerDatasheet,
    args.handleOpenModelerDesigner,
    args.handleOpenModelerEditApi,
    args.handleOpenModelerEditFunctionApi,
    args.handleOpenModelerRelations,
    args.handleOpenModelerTruncateTableDialog,
    args.handleOpenRunPanel,
    args.handleOpenSqlEditor,
    args.handleSyncModels,
    args.openModelId,
    args.serverFunctions,
    findRow,
  ]);

  useWorkspaceOverlayDeepLink({
    enabled: true,
    activeToken,
    openFromUrl,
  });
}
