export type DataStudioExplorerObjectKind =
  | 'TABLE'
  | 'VIEW'
  | 'STORED_PROCEDURE'
  | 'SCALAR_FUNCTION'
  | 'TABLE_VALUED_FUNCTION';

export type DataStudioExplorerObjectRow = {
  id: string;
  name: string;
  objectKind: DataStudioExplorerObjectKind;
  objectKindLabel: string;
  columnCount: number;
  primaryKey: string | string[] | null;
  supportsEdgeModel: boolean;
  isControlPlaneLocked: boolean;
  edgeModelId: string | null;
  modelStatus: 'ready' | 'stale' | 'draft' | null;
  /** Edge model `labels.icon` (`pack:icon-name`); null when unset. */
  modelIcon: string | null;
  /** Edge model `labels.color` (Tailwind text class); null when unset. */
  modelColor: string | null;
};

export type DataStudioExplorerCardActions = {
  onOpenDesigner: (row: DataStudioExplorerObjectRow) => void;
  onOpenDatasheet: (row: DataStudioExplorerObjectRow) => void;
  onOpenModeler: (row: DataStudioExplorerObjectRow) => void;
  /** Canonical modeler URL for standard `<a href>` (Ctrl/Cmd+click → new tab). */
  resolveModelerHref: (row: DataStudioExplorerObjectRow) => string;
  onOpenSqlEditor: (row: DataStudioExplorerObjectRow) => void;
  onOpenRunPanel: (row: DataStudioExplorerObjectRow) => void;
  onOpenRelations: (row: DataStudioExplorerObjectRow) => void;
  onDeleteObject: (row: DataStudioExplorerObjectRow) => void;
  pendingSqlEditorRowId: string | null;
  pendingRunRowId: string | null;
  pendingModelerRowId: string | null;
  pendingDatasheetRowId: string | null;
};

