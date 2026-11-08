import React from 'react';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Network,
  PanelRightOpen,
  Settings2,
  Table2,
} from 'lucide-react';
import type { OrgGeoWorkspaceViewMode } from '../lib/orgGeoViewModePrefs';
import {
  AppButton,
  UiTooltip,
} from '../../../shared/ui';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import type { ScopedBaseInfoTreeModel } from '../hooks/useScopedBaseInfoTree';

type OrgGeoToolbarProps = {
  page: ScopedBaseInfoTreeModel;
  onOpenSettings?: () => void;
  /** When set, shows Details next to Settings (inspector closed + selection). */
  onOpenDetails?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  viewMode?: OrgGeoWorkspaceViewMode;
  onViewModeChange?: (mode: OrgGeoWorkspaceViewMode) => void;
  supportsDatasheetView?: boolean;
};

const TOOLBAR_HINT_CLASS =
  'z-[9999] border border-slate-700/80 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 shadow-md';

/** Chart actions — parent canvas places this at top-right. Layout and zoom have their own corners. */
export const OrgGeoToolbar: React.FC<OrgGeoToolbarProps> = ({
  page,
  onOpenSettings,
  onOpenDetails,
  onExpandAll,
  onCollapseAll,
  viewMode = 'canvas',
  onViewModeChange,
  supportsDatasheetView = false,
}) => {
  const treeActionsDisabled = page.isLoading || page.isSaving || page.isMoving;

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-1"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {supportsDatasheetView && onViewModeChange ? (
        <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
          <UiTooltip content="Canvas" contentClassName={TOOLBAR_HINT_CLASS}>
            <AppButton
              type="button"
              intent={viewMode === 'canvas' ? 'secondary' : 'utility'}
              size="icon-md"
              aria-label="Canvas view"
              title="Canvas view"
              aria-pressed={viewMode === 'canvas'}
              onClick={() => onViewModeChange('canvas')}
            >
              <Network className="h-3.5 w-3.5" />
            </AppButton>
          </UiTooltip>
          <UiTooltip content="Datasheet" contentClassName={TOOLBAR_HINT_CLASS}>
            <AppButton
              type="button"
              intent={viewMode === 'datasheet' ? 'secondary' : 'utility'}
              size="icon-md"
              aria-label="Datasheet view"
              title="Datasheet view"
              aria-pressed={viewMode === 'datasheet'}
              onClick={() => onViewModeChange('datasheet')}
            >
              <Table2 className="h-3.5 w-3.5" />
            </AppButton>
          </UiTooltip>
        </div>
      ) : null}
      {onExpandAll || onCollapseAll ? (
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
          {onExpandAll ? (
            <UiTooltip content="Expand all" contentClassName={TOOLBAR_HINT_CLASS}>
              <AppButton
                type="button"
                intent="utility"
                size="icon-md"
                aria-label="Expand all"
                title="Expand all"
                disabled={treeActionsDisabled}
                onClick={onExpandAll}
                {...pageGuideLocalProps(
                  PAGE_GUIDE_EN['pageGuide.page.org.expand.title'],
                  PAGE_GUIDE_EN['pageGuide.page.org.expand.hint'],
                  16,
                )}
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </AppButton>
            </UiTooltip>
          ) : null}
          {onCollapseAll ? (
            <UiTooltip content="Collapse all" contentClassName={TOOLBAR_HINT_CLASS}>
              <AppButton
                type="button"
                intent="utility"
                size="icon-md"
                aria-label="Collapse all"
                title="Collapse all"
                disabled={treeActionsDisabled}
                onClick={onCollapseAll}
                {...pageGuideLocalProps(
                  PAGE_GUIDE_EN['pageGuide.page.org.collapse.title'],
                  PAGE_GUIDE_EN['pageGuide.page.org.collapse.hint'],
                  16,
                )}
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
              </AppButton>
            </UiTooltip>
          ) : null}
        </div>
      ) : null}
      {onOpenSettings ? (
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          className="shadow-sm backdrop-blur-sm"
          aria-label="Chart settings"
          title="Chart settings"
          disabled={page.isLoading || page.isSaving}
          onClick={onOpenSettings}
          {...pageGuideLocalProps(
            PAGE_GUIDE_EN['pageGuide.page.org.settings.title'],
            PAGE_GUIDE_EN['pageGuide.page.org.settings.hint'],
            16,
          )}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Settings
        </AppButton>
      ) : null}
      {onOpenDetails ? (
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          className="shadow-sm backdrop-blur-sm"
          aria-label="Open details"
          title="Open details"
          onClick={onOpenDetails}
          {...pageGuideLocalProps(
            PAGE_GUIDE_EN['pageGuide.page.org.details.title'],
            PAGE_GUIDE_EN['pageGuide.page.org.details.hint'],
            17,
          )}
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
          Details
        </AppButton>
      ) : null}
    </div>
  );
};
