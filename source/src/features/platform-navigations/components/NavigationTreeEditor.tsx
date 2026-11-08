import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { BaseTreeGrid } from '../../../components/ui/BaseTreeGrid';
import type { NavigationManifest } from '../../../shared/api/contracts/platform/navigation';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import {
  formatNavigationComponentLabel,
  formatNavigationCultureLabel,
  formatNavigationPortalLabel,
  isNavigationRedirectPortal,
  useNavigationEditorOptions,
} from '../hooks/useNavigationEditorOptions';
import {
  navigationManifestToTreeRows,
  rowMatchesSelection,
  selectionFromRow,
  type NavigationTreeRow,
  type NavigationTreeSelection,
} from '../lib/navigationTreeRows';
import { resolveNavColor } from '../lib/navigationTailwindColorOptions';
import {
  NAV_DEFAULT_ICON_COLOR,
  NAV_DEFAULT_LABEL_COLOR,
} from '../constants';
import type { NavigationManifestEditorModel } from '../hooks/useNavigationManifestEditor';
import type { PlatformNavigationsPageModel } from '../hooks/usePlatformNavigationsPage';

type NavigationTreeEditorPage = Pick<
  NavigationManifestEditorModel | PlatformNavigationsPageModel,
  | 'editorId'
  | 'selection'
  | 'setSelection'
  | 'isEditorReadOnly'
  | 'editorMode'
  | 'moveTreeNode'
  | 'canMoveTreeNode'
>;

type NavigationTreeEditorProps = {
  page: NavigationTreeEditorPage;
  manifest: NavigationManifest;
};

const TREE_EMPTY_CELL = <span className="text-[11px] text-slate-400">—</span>;

function renderItemLabel(row: NavigationTreeRow): React.ReactNode {
  const labelColor = resolveNavColor(row.labelColor, NAV_DEFAULT_LABEL_COLOR);
  const text = row.label?.trim() || '(untitled)';
  const iconNode = row.icon?.trim() ? (
    <NavigationIcon
      iconRef={row.icon}
      className={cn('h-4 w-4 shrink-0', resolveNavColor(row.iconColor, NAV_DEFAULT_ICON_COLOR))}
    />
  ) : null;

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', labelColor)}>
      {iconNode}
      <span className="truncate text-sm font-medium">{text}</span>
    </span>
  );
}

function renderNodeLabel(row: NavigationTreeRow): React.ReactNode {
  if (row.nodeKind === 'group') {
    return <span className="text-sm font-semibold text-slate-700">{row.label}</span>;
  }

  if (row.nodeKind === 'separator') {
    return <span className="text-sm italic text-slate-400">{row.label}</span>;
  }

  return renderItemLabel(row);
}

export const NavigationTreeEditor: React.FC<NavigationTreeEditorProps> = ({ page, manifest }) => {
  const editorOptions = useNavigationEditorOptions(Boolean(page.editorId));
  const rows = useMemo(() => navigationManifestToTreeRows(manifest), [manifest]);

  const columns = useMemo(() => [
    {
      key: 'culture',
      header: 'Culture',
      className: 'w-[120px]',
      renderCell: (row: NavigationTreeRow) => {
        if (row.nodeKind !== 'item') {
          return TREE_EMPTY_CELL;
        }

        return (
          <span className="truncate text-[11px] text-slate-600">
            {formatNavigationCultureLabel(row.cultureId, editorOptions.cultureOptions)}
          </span>
        );
      },
    },
    {
      key: 'portal',
      header: 'Portal',
      className: 'w-[120px]',
      renderCell: (row: NavigationTreeRow) => {
        if (row.nodeKind !== 'item') {
          return TREE_EMPTY_CELL;
        }

        return (
          <span className="truncate text-[11px] text-slate-600">
            {formatNavigationPortalLabel(row.portalSegment, editorOptions.portalOptions)}
          </span>
        );
      },
    },
    {
      key: 'component',
      header: 'Component',
      className: 'min-w-[180px]',
      renderCell: (row: NavigationTreeRow) => {
        if (row.nodeKind !== 'item') {
          return TREE_EMPTY_CELL;
        }

        if (isNavigationRedirectPortal(row.portalSegment, editorOptions.portalOptions)) {
          return (
            <span className="truncate text-[11px] text-slate-400">
              Not applicable for redirect portals
            </span>
          );
        }

        return (
          <span className="truncate text-[11px] text-slate-600">
            {formatNavigationComponentLabel(
              row.pageKey,
              editorOptions.componentOptions,
              editorOptions.designerDrafts,
            )}
          </span>
        );
      },
    },
  ], [
    editorOptions.componentOptions,
    editorOptions.cultureOptions,
    editorOptions.designerDrafts,
    editorOptions.portalOptions,
  ]);

  const handleRowClick = (row: NavigationTreeRow) => {
    page.setSelection(selectionFromRow(row));
  };

  const handleMove = async (
    sourceId: string,
    targetId: string | null,
    position: Parameters<typeof page.moveTreeNode>[2],
  ) => {
    await page.moveTreeNode(sourceId, targetId, position);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <BaseTreeGrid<NavigationTreeRow>
          rows={rows}
          columns={columns}
          expandedById={{}}
          loadingByParent={{}}
          moveDisabled={page.isEditorReadOnly || page.editorMode !== 'tree'}
          hideExpandControls
          showIdColumn={false}
          nodeColumnHeader="Label"
          getNodeLabel={renderNodeLabel}
          rowClassName={(row) => (
            rowMatchesSelection(row, page.selection) ? 'bg-indigo-50/70' : ''
          )}
          onToggleExpand={() => {}}
          onRowClick={handleRowClick}
          onMove={handleMove}
          canDrop={page.canMoveTreeNode}
        />
      </div>
    </div>
  );
};

export type { NavigationTreeSelection };
