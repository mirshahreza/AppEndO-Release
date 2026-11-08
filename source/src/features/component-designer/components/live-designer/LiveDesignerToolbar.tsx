import * as React from 'react';
import {
  Loader2,
  Redo2,
  Save,
  Sparkles,
  Undo2,
} from 'lucide-react';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  WorkspaceBackIcon,
} from '../../../../shared/ui';
import { PAGE_GUIDE_EN } from '../../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { cn } from '../../../../lib/utils';
import { LIVE_DESIGNER_TOOLBOX_RESTORE_BELOW_ATTR } from './liveDesignerToolboxAnchor';

export type LiveDesignerToolbarProps = {
  onBack: () => void;
  /** Operator-facing item identity — the component name. */
  itemLabel?: string | null;
  onSave: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canSave?: boolean;
  isSaving?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  showAi?: boolean;
  aiOpen?: boolean;
  onToggleAi?: () => void;
};

export const LiveDesignerToolbar: React.FC<LiveDesignerToolbarProps> = ({
  onBack,
  itemLabel,
  onSave,
  onUndo,
  onRedo,
  canSave = false,
  isSaving = false,
  canUndo = false,
  canRedo = false,
  showAi = false,
  aiOpen = false,
  onToggleAi,
}) => (
  <div
    className={cn(PAGE_TOOLBAR_SINGLE_ROW_CLASS, 'shrink-0 border-b border-slate-200 bg-white')}
    data-testid="live-designer-toolbar"
    {...{ [LIVE_DESIGNER_TOOLBOX_RESTORE_BELOW_ATTR]: true }}
  >
    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <WorkspaceBackIcon
        ariaLabel="Back to Client Components list"
        title="Back to list"
        onClick={onBack}
      />
      {itemLabel?.trim() ? (
        <span
          className="min-w-0 truncate font-mono text-xs font-semibold text-slate-700"
          title={itemLabel.trim()}
        >
          {itemLabel.trim()}
        </span>
      ) : null}
    </div>

    <div className="min-w-0 flex-1" aria-hidden />

    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <AppButton
        size="icon-md"
        intent="utility"
        aria-label="Undo"
        disabled={!canUndo}
        title="Undo"
        onClick={onUndo}
        {...pageGuideLocalProps(
          PAGE_GUIDE_EN['pageGuide.page.undo.title'],
          PAGE_GUIDE_EN['pageGuide.page.undo.hint'],
          14,
        )}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </AppButton>
      <AppButton
        size="icon-md"
        intent="utility"
        aria-label="Redo"
        disabled={!canRedo}
        title="Redo"
        onClick={onRedo}
        {...pageGuideLocalProps(
          PAGE_GUIDE_EN['pageGuide.page.redo.title'],
          PAGE_GUIDE_EN['pageGuide.page.redo.hint'],
          15,
        )}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </AppButton>

      {showAi ? (
        <>
          <div className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden />
          <AppButton
          size="icon-md"
          intent={aiOpen ? 'toggle-on' : 'toggle-off'}
          className="shrink-0"
          aria-label={aiOpen ? 'Hide AI assistant' : 'Show AI assistant'}
          title={aiOpen ? 'Hide AI assistant' : 'Show AI assistant'}
          aria-pressed={aiOpen}
          {...pageGuideLocalProps(
            PAGE_GUIDE_EN['pageGuide.page.aiAssistant.title'],
            PAGE_GUIDE_EN['pageGuide.page.aiAssistant.hint'],
            20,
          )}
          onClick={onToggleAi}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </AppButton>
        </>
      ) : null}

      <div className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden />

      <AppButton
        size="sm"
        intent="primary"
        aria-label="Save draft"
        aria-busy={isSaving}
        disabled={!canSave || isSaving}
        title={canSave ? 'Save draft' : 'No changes to save'}
        {...pageGuideLocalProps(
          'Save',
          'Writes the current layout draft so Live Designer and published pages can use it.',
          15,
        )}
        onClick={onSave}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        <span>Save</span>
      </AppButton>
    </div>
  </div>
);
