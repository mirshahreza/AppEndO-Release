import React, { useState } from 'react';
import {
  GitFork,
  Lock,
  RefreshCcw,
  Sheet,
  Shield,
  TableProperties,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { EdgeApiDefinition } from '../../../shared/api/contracts/data-api';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import type { SchemaObjectDependencyItem } from '../../../shared/api/contracts/data-sources/schemaObjectDependencies';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { NAV_DEFAULT_ICON_COLOR } from '../../platform-navigations/constants';
import { resolveNavColor } from '../../platform-navigations/lib/navigationTailwindColorOptions';
import {
  AppButton,
  AppToast,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  QueryErrorPanel,
  UiTooltip,
  WorkspaceBackIcon,
} from '../../../shared/ui';
import { CONTROL_PLANE_OBJECT_LOCK_LABEL } from '../lib/controlPlaneSchemaObjects';
import { useEdgeModelModeler } from '../hooks/useEdgeModelModeler';
import {
  MODELER_PAGE_SURFACE_CLASS,
  MODELER_SUBTITLE_CLASS,
  MODELER_TITLE_CLASS,
} from '../lib/modelerChipStyles';
import { EdgeModelModelerStorySection } from './EdgeModelModelerStorySection';
import { EdgeModelModelerColumnsSection } from './EdgeModelModelerColumnsSection';
import { EdgeModelModelerGeneralEditDialog } from './EdgeModelModelerGeneralEditDialog';
import { EdgeModelModelerIdentityDialog } from './EdgeModelModelerIdentityDialog';
import { EdgeModelModelerSidePanel } from './EdgeModelModelerSidePanel';
import { EdgeModelModelerDependenciesDialog } from './EdgeModelModelerDependenciesDialog';
import { EdgeModelModelerRecordPoliciesDialog } from '../../record-policy/EdgeModelModelerRecordPoliciesDialog';
import { EdgeModelModelerQuerySurfacesDialog } from './EdgeModelModelerQuerySurfacesDialog';
import { useRecordPoliciesQuery } from '../../../shared/api/queries/record-policy';
import { useDataStudioModelerOverlayDeepLink } from '../hooks/useDataStudioModelerOverlayDeepLink';

type EdgeModelModelerWorkspaceProps = {
  modelId: string;
  onBack: () => void;
  onOpenRelations: () => void;
  onOpenDesigner: () => void;
  onOpenDatasheet: () => void;
  onCreateApi: () => void;
  onEditApi: (definitionId: string, options?: { initialTab?: 'access' | 'hooks' | 'runtime'; openAccessModal?: boolean; openHooksModal?: boolean }) => void;
  onEditFunctionApi: (fn: ServerFunctionItem, mode?: 'settings' | 'access' | 'hooks') => void;
  onDeleteApi: (definition: EdgeApiDefinition) => void;
  onOpenObject: (item: SchemaObjectDependencyItem) => void;
  resolveObjectHref: (item: SchemaObjectDependencyItem) => string;
  onDeleteObject: () => void;
  onTruncateTable: () => void;
  isDeletingObject?: boolean;
  isTruncatingTable?: boolean;
};

export const EdgeModelModelerWorkspace: React.FC<EdgeModelModelerWorkspaceProps> = ({
  modelId,
  onBack,
  onOpenRelations,
  onOpenDesigner,
  onOpenDatasheet,
  onCreateApi,
  onEditApi,
  onEditFunctionApi,
  onDeleteApi,
  onOpenObject,
  resolveObjectHref,
  onDeleteObject,
  onTruncateTable,
  isDeletingObject = false,
  isTruncatingTable = false,
}) => {
  const modeler = useEdgeModelModeler(modelId);
  const policiesQuery = useRecordPoliciesQuery(modelId, Boolean(modeler.model));
  const policyCount = policiesQuery.data?.length ?? 0;
  const [generalEditOpen, setGeneralEditOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [recordPoliciesOpen, setRecordPoliciesOpen] = useState(false);
  const [listAccessOpen, setListAccessOpen] = useState(false);
  const [dependenciesOpen, setDependenciesOpen] = useState(false);

  useDataStudioModelerOverlayDeepLink({
    enabled: Boolean(modeler.model && modeler.draft),
    generalEditOpen,
    setGeneralEditOpen,
    identityOpen,
    setIdentityOpen,
    recordPoliciesOpen,
    setRecordPoliciesOpen,
    listAccessOpen,
    setListAccessOpen,
    dependenciesOpen,
    setDependenciesOpen,
  });

  if (modeler.isLoading) {
    return (
      <div className={cn('flex h-full min-h-0 w-full flex-col', MODELER_PAGE_SURFACE_CLASS)}>
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5">
          <div className="h-8 w-8 animate-pulse rounded-md bg-slate-100" />
          <div className="h-3 w-56 max-w-[55%] animate-pulse rounded bg-slate-100" />
          <div className="ms-auto h-8 w-28 animate-pulse rounded-md bg-slate-100" />
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-hidden px-5 py-4">
            <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white" />
            <div className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white" />
            <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-white" />
          </div>
          <aside className="w-80 shrink-0 border-s border-slate-200 bg-white px-3 py-3">
            <div className="space-y-3">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-16 animate-pulse rounded-md bg-slate-50" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-24 animate-pulse rounded-md bg-slate-50" />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (modeler.isError || !modeler.model || !modeler.draft) {
    return (
      <div className="flex h-full flex-col">
        <div className={PAGE_TOOLBAR_SINGLE_ROW_CLASS}>
          <WorkspaceBackIcon
            ariaLabel="Back to Data Studio list"
            title="Back to list"
            onClick={onBack}
          />
        </div>
        <QueryErrorPanel
          message="Failed to open modeler."
          detail={modeler.error ?? 'Model was not found.'}
          onRetry={onBack}
        />
      </div>
    );
  }

  const { model, draft } = modeler;
  const iconColorClass = resolveNavColor(draft.color, NAV_DEFAULT_ICON_COLOR);

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col font-sans', MODELER_PAGE_SURFACE_CLASS)}>
      {modeler.toast ? (
        <AppToast type={modeler.toast.type} text={modeler.toast.text} />
      ) : null}

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <WorkspaceBackIcon
            ariaLabel="Back to Data Studio list"
            title="Back to list"
            onClick={onBack}
          />
          {draft.icon.trim() ? (
            <NavigationIcon iconRef={draft.icon} className={cn('h-4 w-4 shrink-0', iconColorClass)} />
          ) : (
            <TableProperties className={cn('h-4 w-4 shrink-0', iconColorClass)} />
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className={MODELER_TITLE_CLASS}>
              {model.objectName}
            </p>
            <p className={MODELER_SUBTITLE_CLASS}>
              {modeler.dataSource?.name ?? 'Data source'}
            </p>
          </div>
          {modeler.isControlPlaneObject ? (
            <UiTooltip
              className="inline-flex shrink-0 cursor-default text-amber-500 outline-none"
              aria-label={CONTROL_PLANE_OBJECT_LOCK_LABEL}
              contentClassName="z-[9999] max-w-[18rem] px-3 py-2 text-start text-[11px] font-medium leading-snug"
              content={CONTROL_PLANE_OBJECT_LOCK_LABEL}
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            </UiTooltip>
          ) : null}
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <AppButton
            intent="secondary"
            size="sm"
            onClick={onOpenDatasheet}
          >
            <Sheet className="h-3.5 w-3.5" />
            Data
          </AppButton>
          <AppButton
            intent="secondary"
            size="sm"
            onClick={() => setDependenciesOpen(true)}
          >
            <GitFork className="h-3.5 w-3.5" />
            Dependencies
          </AppButton>
          <AppButton
            intent="secondary"
            size="sm"
            onClick={() => setListAccessOpen(true)}
          >
            <Shield className="h-3.5 w-3.5" />
            List &amp; access
            {policyCount > 0 ? (
              <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-indigo-100 px-1.5 py-px text-[10px] font-bold leading-none text-indigo-700">
                {policyCount}
              </span>
            ) : null}
          </AppButton>
          <AppButton
            intent="confirm"
            size="sm"
            disabled={modeler.isRefreshing}
            onClick={() => { void modeler.refreshFromDatabase(); }}
          >
            <RefreshCcw className={cn('h-3.5 w-3.5', modeler.isRefreshing && 'animate-spin')} />
            Sync Model
          </AppButton>
        </div>
      </div>

      <EdgeModelModelerGeneralEditDialog
        open={generalEditOpen}
        onClose={() => setGeneralEditOpen(false)}
        modeler={modeler}
      />

      <EdgeModelModelerIdentityDialog
        open={identityOpen}
        onClose={() => setIdentityOpen(false)}
        model={model}
      />

      <EdgeModelModelerRecordPoliciesDialog
        open={recordPoliciesOpen}
        onClose={() => setRecordPoliciesOpen(false)}
        model={model}
      />

      <EdgeModelModelerQuerySurfacesDialog
        open={listAccessOpen}
        onClose={() => setListAccessOpen(false)}
        model={model}
        policyCount={policyCount}
        columnFilterRoles={draft.studio.columnFilterRoles}
        onUpdateColumnFilterRole={modeler.updateColumnFilterRole}
        onOpenRecordPolicies={() => setRecordPoliciesOpen(true)}
      />

      <EdgeModelModelerDependenciesDialog
        open={dependenciesOpen}
        onClose={() => setDependenciesOpen(false)}
        dataSourceId={model.dataSourceId}
        objectName={model.objectName}
        objectKind={model.objectType}
        onOpenObject={onOpenObject}
        resolveObjectHref={resolveObjectHref}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={cn('min-h-0 min-w-0 flex-1 overflow-auto px-5 py-4', MODELER_PAGE_SURFACE_CLASS)}>
          <div className="flex w-full flex-col gap-5">
            <EdgeModelModelerColumnsSection
              columns={draft.columns}
              associations={draft.associations}
              peerModels={modeler.models.filter(
                (peer) => peer.dataSourceId === model.dataSourceId,
              )}
              relationAttachedFields={draft.studio.relationAttachedFields}
              columnDisplayLabels={draft.studio.columnDisplayLabels}
              columnIcons={draft.studio.columnIcons}
              columnFormWidgets={draft.studio.columnFormWidgets}
              columnFormWidgetProps={draft.studio.columnFormWidgetProps}
              columnRequired={draft.studio.columnRequired}
              columnSearchRoles={draft.studio.columnSearchRoles}
              columnFilterRoles={draft.studio.columnFilterRoles}
              columnDeveloperNotes={draft.studio.columnDeveloperNotes}
              columnInterfaceNotes={draft.studio.columnInterfaceNotes}
              columnCubeMeasures={draft.studio.columnCubeMeasures}
              columnHistories={draft.studio.columnHistories}
              lifecycleField={draft.studio.history?.lifecycleField ?? null}
              columnGroups={draft.studio.columnGroups}
              columnSortOrders={draft.studio.columnSortOrders}
              columnGroupOrder={draft.studio.columnGroupOrder}
              columnGroupIcons={draft.studio.columnGroupIcons}
              columnGroupColors={draft.studio.columnGroupColors}
              relationFormWidgets={draft.studio.relationFormWidgets}
              columnsReadOnly={modeler.columnsReadOnly}
              canEditTable={model.objectType === 'TABLE'}
              isStructuralColumnLocked={modeler.isStructuralColumnLocked}
              onEditTable={onOpenDesigner}
              onApplyColumnStudioLayout={modeler.applyColumnStudioLayout}
              onUpdateColumnDisplayLabel={modeler.updateColumnDisplayLabel}
              onUpdateColumnIcon={modeler.updateColumnIcon}
              onUpdateColumnFormWidget={modeler.updateColumnFormWidget}
              onUpdateColumnRequired={modeler.updateColumnRequired}
              onUpdateColumnSearchRole={modeler.updateColumnSearchRole}
              onUpdateColumnFilterRole={modeler.updateColumnFilterRole}
              onUpdateColumnDeveloperNotes={modeler.updateColumnDeveloperNotes}
              onUpdateColumnInterfaceNotes={modeler.updateColumnInterfaceNotes}
              onUpdateColumnCubeMeasure={modeler.updateColumnCubeMeasure}
              onUpdateColumnHistory={modeler.updateColumnHistory}
              onUpdateRelationFormWidget={modeler.updateRelationFormWidget}
              onApplyRelationAttachedFields={modeler.applyRelationAttachedFields}
            />

            <EdgeModelModelerStorySection modeler={modeler} />
          </div>
        </div>

        <EdgeModelModelerSidePanel
          modeler={modeler}
          modelId={modelId}
          onEditGeneral={() => setGeneralEditOpen(true)}
          onViewIdentity={() => setIdentityOpen(true)}
          onOpenRelations={onOpenRelations}
          onCreateApi={onCreateApi}
          onEditApi={onEditApi}
          onEditFunctionApi={onEditFunctionApi}
          onDeleteApi={onDeleteApi}
          onDeleteObject={onDeleteObject}
          onTruncateTable={onTruncateTable}
          isDeletingObject={isDeletingObject}
          isTruncatingTable={isTruncatingTable}
        />
      </div>
    </div>
  );
};
