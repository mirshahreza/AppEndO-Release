import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ListPageShell } from '../../../shared/ui';
import { useScopeMembershipsQuery } from '../../../shared/api/queries/scope-memberships';

import { resolveLucideIconNameFromUiHtml } from '../../../shared/lib/baseInfoUiIcon';

import { useScopedBaseInfoTree } from '../hooks/useScopedBaseInfoTree';

import type { OrgGeoWorkspaceConfig } from '../lib/orgGeoWorkspaceConfig';

import {

  readOrgGeoViewMode,

  writeOrgGeoViewMode,

  type OrgGeoWorkspaceViewMode,

} from '../lib/orgGeoViewModePrefs';

import { OrgChartCanvas, type OrgChartNodeMember } from './OrgChartCanvas';

import { OrgGeoChartSettingsDialog } from './OrgGeoChartSettingsDialog';


import { OrgGeoDeleteModal } from './OrgGeoDeleteModal';

import { OrgGeoFormModal } from './OrgGeoFormModal';

import { OrgGeoInspector } from './OrgGeoInspector';

import { OrgGeoDatasheetFooter } from './OrgGeoDatasheetFooter';

import { OrgGeoDatasheetToolbar } from './OrgGeoDatasheetToolbar';

import { OrgGeoTableGrid } from './OrgGeoTableGrid';

import { OrgGeoToolbar } from './OrgGeoToolbar';



type OrgGeoWorkspaceProps = {

  config: OrgGeoWorkspaceConfig;

};



export const OrgGeoWorkspace: React.FC<OrgGeoWorkspaceProps> = ({ config }) => {

  const page = useScopedBaseInfoTree({

    rootId: config.rootId,

    rootTitleFallback: config.rootTitleFallback,

    initialTreeExpandedDepth: config.initialTreeExpandedDepth ?? 0,
    resolveNodeTypeLabel: config.resolveNodeTypeLabel,
    resolveNodeAccentColor: config.resolveNodeAccentColor,
  });

  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [viewMode, setViewMode] = useState<OrgGeoWorkspaceViewMode>(() => (

    config.supportsDatasheetView ? readOrgGeoViewMode(config.rootId) : 'canvas'

  ));

  const membershipsQuery = useScopeMembershipsQuery({ dimensionKey: config.dimensionKey });



  useEffect(() => {

    if (!config.supportsDatasheetView) {

      setViewMode('canvas');

      return;

    }

    setViewMode(readOrgGeoViewMode(config.rootId));

  }, [config.rootId, config.supportsDatasheetView]);



  const handleViewModeChange = useCallback((mode: OrgGeoWorkspaceViewMode) => {

    setViewMode(mode);

    if (config.supportsDatasheetView) {

      writeOrgGeoViewMode(config.rootId, mode);

    }

  }, [config.rootId, config.supportsDatasheetView]);



  const membersByNodeId = useMemo(() => {

    const map: Record<string, OrgChartNodeMember[]> = {};

    for (const row of membershipsQuery.data || []) {

      const list = map[row.nodeId] || (map[row.nodeId] = []);

      list.push({

        userId: row.userId,

        displayName: row.displayName,

        avatarSrc: row.avatarUrl || null,

      });

    }

    return map;

  }, [membershipsQuery.data]);



  const selected = page.selectedChartRow;

  const showInspector = Boolean(selected) && isInspectorOpen;

  const showDetailsButton = Boolean(selected) && !isInspectorOpen;



  const handleSelect = (id: string) => {

    page.setSelectedChartId(id);

  };



  const handleCloseInspector = () => {

    setIsInspectorOpen(false);

  };



  const chartOpenDepth = config.defaultChartOpenDepth ?? 1;



  const renderToolbar = (expandAll?: () => void, collapseAll?: () => void) => (

    <OrgGeoToolbar
      page={page}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onOpenDetails={showDetailsButton ? () => setIsInspectorOpen(true) : undefined}
      onExpandAll={expandAll}

      onCollapseAll={collapseAll}

      viewMode={viewMode}

      onViewModeChange={config.supportsDatasheetView ? handleViewModeChange : undefined}

      supportsDatasheetView={config.supportsDatasheetView === true}

    />

  );



  return (

    <div className={`flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden bg-gradient-to-b ${config.bandClassName} font-sans`}>

      {page.error ? (

        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">

          {page.error}

        </div>

      ) : null}



      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

          {viewMode === 'datasheet' && config.supportsDatasheetView ? (

            <ListPageShell onGridScroll={page.handleTreeScroll}>

              <OrgGeoDatasheetToolbar
                page={page}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />

              <OrgGeoTableGrid page={page} accent={config.accent} />

              <OrgGeoDatasheetFooter page={page} />

            </ListPageShell>

          ) : (

            <OrgChartCanvas

              roots={page.chartTreeData}

              hideChartRootInDiagram={config.hideChartRootInDiagram === true}

              defaultOpenDepth={chartOpenDepth}

              rootId={page.rootId}

              rootLabel={page.rootLabel}

              rootIcon={resolveLucideIconNameFromUiHtml(page.rootUiHtml)}

              rootColor={page.rootUiColor}

              rootIsActive={page.rootIsActive}

              selectedId={page.selectedChartId}

              onSelect={handleSelect}

              onOpenDetails={() => setIsInspectorOpen(true)}

              isLoading={page.isLoading}

              isMoving={page.isMoving}

              accent={config.accent}

              membersByNodeId={membersByNodeId}

              chartConfig={page.rootChartConfig}

              defaultFallbackIcon={config.fallbackIcon}

              defaultLevelColor={config.defaultChartLevelColor}

              canDropNode={(sourceId, targetId, position) => (

                page.canDropNode(sourceId, targetId, position)

              )}

              onMoveNode={(sourceId, targetId, position) => {

                void page.moveChartNode(sourceId, targetId, position);

              }}

              onRequestExpandAll={() => page.loadAllForChart()}

              onEnsureChildrenLoaded={(nodeId) => {

                void page.ensureChildrenLoaded(nodeId);

              }}

              revealNodeId={page.chartRevealId}

              onRevealHandled={page.clearChartRevealId}

              toolbar={({ expandAll, collapseAll }) => renderToolbar(expandAll, collapseAll)}

            />

          )}

        </div>

        {showInspector ? (

          <OrgGeoInspector

            page={page}

            config={config}

            onClose={handleCloseInspector}

          />

        ) : null}

      </div>



      <OrgGeoFormModal page={page} entityLabel={config.entityLabel} />

      <OrgGeoDeleteModal page={page} />

      <OrgGeoChartSettingsDialog

        open={isSettingsOpen}

        page={page}

        workspaceConfig={config}

        onClose={() => setIsSettingsOpen(false)}

      />

    </div>

  );

};


