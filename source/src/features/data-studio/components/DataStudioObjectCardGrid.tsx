import React from 'react';
import {
  Database,
  Eye,
  FunctionSquare,
  Play,
  Sheet,
  Table2,
  TableProperties,
  Trash2,
  Waypoints,
  Workflow,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import {
  DevelopmentCatalogCard,
  DevelopmentCatalogCardFooter,
  DevelopmentCatalogCardGrid,
  DevelopmentCatalogCardHeader,
  DevelopmentCatalogIconAction,
  QueryErrorPanel,
  APP_TABLE_GRID_STATE_PANEL_CLASS,
} from '../../../shared/ui';
import { NAV_DEFAULT_ICON_COLOR } from '../../platform-navigations/constants';
import { resolveNavColor } from '../../platform-navigations/lib/navigationTailwindColorOptions';
import {
  canDeleteExplorerObjectFromList,
  DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS,
} from '../lib/explorerObjectKinds';
import { formatSchemaObjectStructureLabel } from '../lib/formatSchemaObjectStructure';
import { usesSqlEditorForEdit } from '../lib/schemaObjectSqlTemplates';
import { canRunSchemaObjectKind } from '../lib/schemaObjectRunSqlTemplates';
import type {
  DataStudioExplorerCardActions,
  DataStudioExplorerObjectKind,
  DataStudioExplorerObjectRow,
} from '../types';
import { writeSchemaObjectDragPayload } from '../lib/schemaObjectDrag';

type DataStudioObjectCardGridProps = {
  rows: DataStudioExplorerObjectRow[];
  dataSourceId: string | null;
  dataSourceType: string | null;
  actions: DataStudioExplorerCardActions;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  onRetry: () => void;
  isRetrying: boolean;
  emptyMessage: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};

const DEFAULT_OBJECT_KIND_ICON: Record<
  DataStudioExplorerObjectKind,
  React.ComponentType<{ className?: string }>
> = {
  TABLE: Table2,
  VIEW: Eye,
  STORED_PROCEDURE: Workflow,
  SCALAR_FUNCTION: FunctionSquare,
  TABLE_VALUED_FUNCTION: TableProperties,
};

const ObjectCardIcon: React.FC<{
  row: DataStudioExplorerObjectRow;
}> = ({ row }) => {
  const modelIcon = row.modelIcon?.trim() || null;
  const iconColorClass = resolveNavColor(row.modelColor, NAV_DEFAULT_ICON_COLOR);
  const DefaultIcon = DEFAULT_OBJECT_KIND_ICON[row.objectKind];

  if (modelIcon) {
    return (
      <NavigationIcon
        iconRef={modelIcon}
        className={cn('pointer-events-none mt-0.5 h-3.5 w-3.5 shrink-0', iconColorClass)}
      />
    );
  }

  return (
    <DefaultIcon className={cn('pointer-events-none mt-0.5 h-3.5 w-3.5 shrink-0', iconColorClass)} />
  );
};

const ObjectCard: React.FC<{
  row: DataStudioExplorerObjectRow;
  dataSourceId: string | null;
  dataSourceType: string | null;
  actions: DataStudioExplorerCardActions;
}> = ({ row, dataSourceId, dataSourceType, actions }) => {
  const canOpenModeler = row.supportsEdgeModel;
  const canEditSql = usesSqlEditorForEdit(row.objectKind);
  const isSqlPending = actions.pendingSqlEditorRowId === row.id;
  const isModelerPending = actions.pendingModelerRowId === row.id;
  const isRunPending = actions.pendingRunRowId === row.id;
  const showDbDesign = row.objectKind === 'TABLE';
  const showDatasheet = row.objectKind === 'TABLE' || row.objectKind === 'VIEW';
  const showRelations = row.objectKind === 'TABLE' || row.objectKind === 'VIEW';
  const showRun = row.objectKind !== 'TABLE'
    && Boolean(dataSourceType)
    && canRunSchemaObjectKind(dataSourceType!, row.objectKind);
  const showFooterActions = showDbDesign || showDatasheet || showRelations || showRun;
  const canDragToRelations = Boolean(dataSourceId) && showRelations;
  const canDelete = canDeleteExplorerObjectFromList(row);
  const structureLabel = formatSchemaObjectStructureLabel(row);
  const objectKindSingular = DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[row.objectKind].toLowerCase();

  const handleTitleClick = () => {
    if (canOpenModeler) {
      if (isModelerPending) {
        return;
      }
      void actions.onOpenModeler(row);
      return;
    }

    if (canEditSql) {
      if (isSqlPending) {
        return;
      }
      actions.onOpenSqlEditor(row);
    }
  };

  return (
    <div
      className="h-full min-w-0"
      draggable={canDragToRelations}
      title={canDragToRelations ? 'Drag onto the Relations diagram' : undefined}
      onDragStart={canDragToRelations && dataSourceId ? ((event) => {
        writeSchemaObjectDragPayload(event.dataTransfer, {
          dataSourceId,
          objectName: row.name,
          objectKind: row.objectKind,
          edgeModelId: row.edgeModelId,
        });
      }) : undefined}
    >
      <DevelopmentCatalogCard>
        <div className="flex min-w-0 items-start gap-1.5">
          <ObjectCardIcon row={row} />
          <div className="min-w-0 flex-1">
            <DevelopmentCatalogCardHeader
              title={row.name}
              titleTone="identifier"
              onTitleClick={(canOpenModeler || canEditSql) ? handleTitleClick : undefined}
              titleAction={canDelete ? (
                <DevelopmentCatalogIconAction
                  intent="delete"
                  aria-label={`Delete ${row.name}`}
                  title={`Delete ${objectKindSingular}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.onDeleteObject(row);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : undefined}
            />
          </div>
        </div>

        <DevelopmentCatalogCardFooter date={structureLabel}>
          {showFooterActions ? (
            <div className="flex items-center gap-0.5">
              {showDbDesign ? (
                <DevelopmentCatalogIconAction
                  intent="settings"
                  aria-label={`Open DB design for ${row.name}`}
                  title={row.isControlPlaneLocked ? 'View table design (read only)' : 'DbDesign'}
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.onOpenDesigner(row);
                  }}
                >
                  <Database className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : null}
              {showDatasheet ? (
                <DevelopmentCatalogIconAction
                  intent="duplicate"
                  aria-label={`Open data for ${row.name}`}
                  title="Data"
                  disabled={actions.pendingDatasheetRowId === row.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void actions.onOpenDatasheet(row);
                  }}
                >
                  <Sheet className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : null}
              {showRelations ? (
                <DevelopmentCatalogIconAction
                  intent="access"
                  aria-label={`Open relations for ${row.name}`}
                  title="Relations"
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.onOpenRelations(row);
                  }}
                >
                  <Waypoints className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : null}
              {showRun ? (
                <DevelopmentCatalogIconAction
                  intent="duplicate"
                  aria-label={`Run ${row.name}`}
                  title={`Run ${row.name}`}
                  disabled={isRunPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    void actions.onOpenRunPanel(row);
                  }}
                >
                  <Play className={cn('h-3 w-3', isRunPending && 'animate-pulse')} />
                </DevelopmentCatalogIconAction>
              ) : null}
            </div>
          ) : null}
        </DevelopmentCatalogCardFooter>
      </DevelopmentCatalogCard>
    </div>
  );
};

export const DataStudioObjectCardGrid: React.FC<DataStudioObjectCardGridProps> = ({
  rows,
  dataSourceId,
  dataSourceType,
  actions,
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying,
  emptyMessage,
  onScroll,
}) => {
  if (isLoading) {
    return (
      <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>
        Loading schema objects…
      </div>
    );
  }

  if (isError && error) {
    return (
      <QueryErrorPanel
        message="Failed to load schema objects."
        detail={error}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <div className={APP_TABLE_GRID_STATE_PANEL_CLASS}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
      <DevelopmentCatalogCardGrid>
        {rows.map((row) => (
          <ObjectCard
            key={row.id}
            row={row}
            dataSourceId={dataSourceId}
            dataSourceType={dataSourceType}
            actions={actions}
          />
        ))}
      </DevelopmentCatalogCardGrid>
    </div>
  );
};
