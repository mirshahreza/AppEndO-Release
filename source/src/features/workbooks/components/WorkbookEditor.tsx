import React from 'react';
import { Save, Share2 } from 'lucide-react';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  UiSpreadsheet,
  WorkspaceBackIcon,
  type UiSpreadsheetHandle,
  type UiSpreadsheetSheet,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { WorkbookRecord } from '../../../shared/api/contracts/workbooks/types';

type WorkbookEditorProps = {
  workbook: WorkbookRecord;
  sheets: UiSpreadsheetSheet[];
  hostKey: string;
  dirty: boolean;
  isSaving: boolean;
  canEdit?: boolean;
  allowSharing?: boolean;
  spreadsheetRef?: React.Ref<UiSpreadsheetHandle>;
  onSheetsChange: (sheets: UiSpreadsheetSheet[]) => void;
  onSave: () => void;
  onBack: () => void;
  onShare?: () => void;
};

export const WorkbookEditor: React.FC<WorkbookEditorProps> = ({
  workbook,
  sheets,
  hostKey,
  dirty,
  isSaving,
  canEdit = true,
  allowSharing = false,
  spreadsheetRef,
  onSheetsChange,
  onSave,
  onBack,
  onShare,
}) => (
  <div className="flex h-full min-h-0 flex-1 flex-col bg-white" data-testid="workbook-editor">
    <div className={cn(PAGE_TOOLBAR_SINGLE_ROW_CLASS, 'relative z-20 shrink-0 border-b border-slate-200 bg-white')}>
      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <WorkspaceBackIcon
          ariaLabel="Back to Workbooks list"
          title="Back to list"
          onClick={onBack}
        />
        <span
          className="min-w-0 truncate text-sm font-semibold text-slate-800"
          title={workbook.name}
        >
          {workbook.name}
        </span>
        {workbook.viewerRole === 'can-view' ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            Can view
          </span>
        ) : workbook.viewerRole === 'can-edit' ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            Can edit
          </span>
        ) : null}
        {dirty ? (
          <span className="shrink-0 text-xs font-medium text-amber-700">Unsaved</span>
        ) : null}
      </div>
      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        {allowSharing && onShare ? (
          <AppButton size="sm" intent="secondary" onClick={onShare}>
            <Share2 className="h-3.5 w-3.5" />
            Share
          </AppButton>
        ) : null}
        {canEdit ? (
          <AppButton size="sm" intent="primary" onClick={onSave} disabled={isSaving || !dirty}>
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </AppButton>
        ) : null}
      </div>
    </div>
    <div className="relative z-0 flex min-h-0 flex-1 isolate flex-col overflow-hidden">
      <UiSpreadsheet
        key={hostKey}
        ref={spreadsheetRef}
        data={sheets}
        onChange={onSheetsChange}
        height="full"
        showToolbar
        showFormulaBar
        showSheetTabs
        allowEdit={canEdit}
        toolbarPreset="full"
      />
    </div>
  </div>
);
