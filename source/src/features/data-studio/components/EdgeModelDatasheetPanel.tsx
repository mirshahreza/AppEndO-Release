import React, { useCallback, useRef } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { Loader2, Play, Sheet, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  ConfirmDialogShell,
  DestructiveConfirmBody,
  DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS,
  FloatingPanelShell,
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_CONFIRM_CLASS,
  WorkspaceHorizontalSplitHandle,
  WORKSPACE_SPLIT_PANEL_KEYS,
  useWorkspaceHorizontalSplitPanel,
} from '../../../shared/ui';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { MonacoEditorPanel, setupSqlScriptEditorOnMount, SQL_SCRIPT_MONACO_OPTIONS } from '../../server-functions/components/MonacoEditorPanel';
import { useEdgeModelDatasheetInstance } from '../hooks/useEdgeModelDatasheetInstance';
import type { EdgeModelDatasheetPanelEntry } from '../hooks/useEdgeModelDatasheetManager';
import { EdgeModelDatasheetGrid } from './EdgeModelDatasheetGrid';

const PANEL_BOUNDS = {
  minWidth: 720,
  maxWidth: 1400,
  minHeight: 320,
  maximizeInset: 16,
};

type EdgeModelDatasheetPanelProps = {
  panel: EdgeModelDatasheetPanelEntry;
  onClose: () => void;
  onFocus: () => void;
};

export const EdgeModelDatasheetPanel: React.FC<EdgeModelDatasheetPanelProps> = ({
  panel,
  onClose,
  onFocus,
}) => {
  const sheet = useEdgeModelDatasheetInstance(panel.context);
  const showInitialLoad = sheet.query.isLoading && sheet.rows.length === 0;
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const commitSqlRef = useRef(sheet.commitSql);
  commitSqlRef.current = sheet.commitSql;
  const sqlHeightSplit = useWorkspaceHorizontalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.dataStudioDatasheetSqlHeight,
    defaultSize: 140,
    minSize: 72,
    maxSize: 360,
    measure: 'leading',
    containerRef: splitContainerRef,
    displayClassName: 'block',
  });

  const handleEditorMount = useCallback<OnMount>((editor, monaco) => {
    setupSqlScriptEditorOnMount(editor, monaco);
    editor.addAction({
      id: 'datasheet.load',
      label: 'Load',
      keybindings: [monaco.KeyCode.F5, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => { commitSqlRef.current(); },
    });
  }, []);

  return (
    <FloatingPanelShell
      open
      onClose={onClose}
      onPointerDown={onFocus}
      title={`${panel.context.dataSourceName} / ${panel.context.row.name}`}
      titleIcon={<Sheet className="h-3.5 w-3.5 text-emerald-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={980}
      defaultHeight={580}
      initialPosition="top-left"
      initialOffset={{
        x: -(panel.cascadeIndex * 24),
        y: panel.cascadeIndex * 24,
      }}
      dragFromHeaderOnly
      enableDrag
      enableResize
      enableMaximize
      zIndex={panel.zOrder}
      borderClassName="border-2 border-emerald-200/80"
      headerClassName="h-9 border-b border-slate-200 bg-white px-3"
      titleClassName="text-xs font-semibold tracking-tight text-slate-800"
      headerExtra={(
        <div className="flex items-center justify-end" data-floating-panel-drag-exclude>
          <AppButton
            type="button"
            size="icon-sm"
            className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7', ICON_ACTION_CONFIRM_CLASS)}
            disabled={sheet.query.isFetching}
            aria-label="Load"
            title="Load (F5 or Ctrl+Enter)"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => { sheet.commitSql(); }}
            {...pageGuideLocalProps(
              'Load datasheet',
              'Run the SQL sentence and open matching rows for editing. F5 or Ctrl+Enter also loads.',
            )}
          >
            {sheet.query.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </AppButton>
          <span className={DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS} aria-hidden="true" />
        </div>
      )}
    >
      <div
        ref={splitContainerRef}
        className={`flex h-full min-h-0 flex-col overflow-hidden !bg-white ${sqlHeightSplit.isResizing ? 'select-none' : ''}`}
      >
        <section
          className="relative flex min-h-0 shrink-0 flex-col overflow-hidden"
          style={{ height: `${sqlHeightSplit.size}px` }}
          data-floating-panel-drag-exclude
        >
          <MonacoEditorPanel
            language="sql"
            value={sheet.draftSql}
            onChange={(value) => sheet.setDraftSql(value ?? '')}
            onMount={handleEditorMount}
            options={SQL_SCRIPT_MONACO_OPTIONS}
          />
          {sheet.sqlError ? (
            <p className="absolute inset-x-0 bottom-0 z-10 truncate bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
              {sheet.sqlError}
            </p>
          ) : null}
        </section>
        <WorkspaceHorizontalSplitHandle
          {...sqlHeightSplit.splitHandleProps}
          displayClassName="block"
          title="Drag to resize the SQL and datasheet panes"
        />
        {showInitialLoad ? (
          <p className="min-h-0 flex-1 px-3 py-6 text-center text-[11px] text-slate-500">Loading rows…</p>
        ) : (
          <EdgeModelDatasheetGrid
            columns={sheet.columns}
            rows={sheet.rows}
            pkFields={sheet.pkFields}
            readOnly={sheet.readOnly}
            fieldErrors={sheet.fieldErrors}
            focusCell={sheet.focusCell}
            savingClientId={sheet.savingClientId}
            onClearFocusCell={sheet.clearFocusCell}
            onUpdateCell={sheet.updateCell}
            onLeaveRow={(clientId) => { void sheet.saveRow(clientId); }}
            onSkipSave={sheet.markSkipSave}
            onRemoveRow={sheet.requestDelete}
            scratchClientId={sheet.scratchClientId}
          />
        )}
      </div>
      {sheet.pendingDeleteRow ? (
        <ConfirmDialogShell
          size="sm"
          title="Delete row"
          icon={<Trash2 className="h-4 w-4" />}
          confirmIntent="destructive"
          closeOnEscape={!sheet.isDeleting}
          onClose={sheet.isDeleting ? () => undefined : sheet.cancelDelete}
          onBackdropClick={sheet.isDeleting ? () => undefined : sheet.cancelDelete}
          footer={(
            <>
              <AppButton intent="cancel" size="sm" disabled={sheet.isDeleting} onClick={sheet.cancelDelete}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </AppButton>
              <AppButton
                intent="destructive"
                size="sm"
                disabled={sheet.isDeleting}
                onClick={() => { void sheet.confirmDelete(); }}
              >
                {sheet.isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete row
                  </>
                )}
              </AppButton>
            </>
          )}
        >
          <DestructiveConfirmBody
            question="Permanently delete this row from the table?"
            warning="The change is written immediately. This action cannot be undone."
          />
        </ConfirmDialogShell>
      ) : null}
    </FloatingPanelShell>
  );
};
