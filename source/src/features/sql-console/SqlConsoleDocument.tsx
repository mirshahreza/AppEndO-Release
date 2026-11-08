import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { FileSpreadsheet, FileText, Play, Redo2, Save, Sparkles, Undo2, Waypoints } from 'lucide-react';
import { exportDesignerData } from '../../domain/component-designer/designerDataExport';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  WorkspaceHorizontalSplitHandle,
  showAppFeedbackToast,
  useWorkspaceHorizontalSplitPanel,
  WORKSPACE_SPLIT_PANEL_KEYS,
} from '../../shared/ui';
import { cn } from '../../lib/utils';
import { pageGuideLocalProps } from '../../shared/ui/shell/pageGuide/pageGuideChrome';
import { MonacoEditorPanel, setupSqlScriptEditorOnMount, SQL_SCRIPT_MONACO_OPTIONS } from '../server-functions/components/MonacoEditorPanel';
import { DataSourceQueryResultView } from '../data-sources/components/DataSourceQueryResultView';
import { getSqlConsoleResultRecords, sqlConsoleResultExportFilename } from './sqlConsoleResultExport';
import type { SqlConsoleTab } from './sqlConsoleTabTypes';
import type { ExecuteDataSourceQueryResult } from '../../shared/api/contracts/data-sources/executeQuery';
import { SqlConsoleAiPanel } from './SqlConsoleAiPanel';
import { SqlConsoleSampleList } from './SqlConsoleSampleList';
import { buildSqlConsoleSampleQueries } from './sqlConsoleSampleQueries';
import { useAiSettingsQuery } from '../../shared/api/queries/aiModels';
import { isAiGloballyEnabled } from '../../shared/lib/aiAccess';

type SqlConsoleEditor = Parameters<OnMount>[0];

type SqlConsoleDocumentProps = {
  tab: SqlConsoleTab;
  dataSourceType?: string | null;
  canExplain: boolean;
  canRun: boolean;
  onSqlChange: (sql: string) => void;
  onRun: () => void;
  onExplain: () => void;
  onSave: () => void;
  onApplySample: (sql: string) => void;
  onRunSuggestedSql: (sql: string, allowWrite: boolean) => Promise<ExecuteDataSourceQueryResult | null>;
};

export const SqlConsoleDocument: React.FC<SqlConsoleDocumentProps> = ({
  tab,
  dataSourceType = null,
  canExplain,
  canRun,
  onSqlChange,
  onRun,
  onExplain,
  onSave,
  onApplySample,
  onRunSuggestedSql,
}) => {
  const editorRef = useRef<SqlConsoleEditor | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'csv' | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const aiSettingsQuery = useAiSettingsQuery();
  const showAi = isAiGloballyEnabled(aiSettingsQuery.data?.enabled);
  const resultRows = useMemo(() => getSqlConsoleResultRecords(tab.result), [tab.result]);
  const sampleQueries = useMemo(() => buildSqlConsoleSampleQueries(dataSourceType), [dataSourceType]);
  const showSamples = !tab.result && !tab.error && !tab.isRunning && sampleQueries.length > 0;
  const canExportResults = resultRows.length > 0 && !tab.isRunning && !exportingFormat;
  const editorHeightSplit = useWorkspaceHorizontalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.sqlConsoleEditorHeight,
    defaultSize: 240,
    minSize: 120,
    maxSize: 640,
    measure: 'leading',
    containerRef: splitContainerRef,
    displayClassName: 'block',
  });

  const syncUndoRedo = useCallback((instance?: SqlConsoleEditor | null) => {
    const model = (instance ?? editorRef.current)?.getModel();
    setCanUndo(Boolean(model?.canUndo()));
    setCanRedo(Boolean(model?.canRedo()));
  }, []);

  const handleUndo = useCallback(() => {
    editorRef.current?.trigger('sql-console', 'undo', undefined);
    syncUndoRedo();
  }, [syncUndoRedo]);

  const handleRedo = useCallback(() => {
    editorRef.current?.trigger('sql-console', 'redo', undefined);
    syncUndoRedo();
  }, [syncUndoRedo]);

  const handleEditorMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor;
    setupSqlScriptEditorOnMount(editor, monaco);
    editor.addAction({
      id: 'sql-console.execute',
      label: 'Run',
      keybindings: [monaco.KeyCode.F5, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => { onRunRef.current(); },
    });
    editor.onDidChangeModelContent(() => syncUndoRedo(editor));
    syncUndoRedo(editor);
  }, [syncUndoRedo]);

  const handleExportResults = useCallback(async (format: 'xlsx' | 'csv') => {
    if (resultRows.length === 0 || exportingFormat) {
      return;
    }
    setExportingFormat(format);
    try {
      await exportDesignerData({
        format,
        rows: resultRows,
        filename: sqlConsoleResultExportFilename(tab.name),
      });
      showAppFeedbackToast(format === 'xlsx' ? 'Excel downloaded.' : 'CSV downloaded.', { type: 'success' });
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Export failed.', { type: 'error' });
    } finally {
      setExportingFormat(null);
    }
  }, [exportingFormat, resultRows, tab.name]);

  return (
    <div className="flex h-full min-h-0 flex-1">
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className={cn(PAGE_TOOLBAR_SINGLE_ROW_CLASS, 'relative z-20 min-w-0')}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <AppButton
            type="button"
            intent="primary"
            size="sm"
            className="shrink-0"
            disabled={!canRun}
            onClick={onRun}
            aria-label="Run query (F5 or Ctrl+Enter)"
            title="Run query (F5 or Ctrl+Enter)"
          >
            <Play className="h-3.5 w-3.5" />
            Run
          </AppButton>
          {canExplain ? (
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              className="shrink-0"
              disabled={!canRun}
              onClick={onExplain}
              aria-label="Explain query plan"
              title="Show the query plan for this SQL"
            >
              <Waypoints className="h-3.5 w-3.5" />
              Explain
            </AppButton>
          ) : null}
          <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
          <AppButton
            size="icon-md"
            intent="utility"
            className="shrink-0"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={handleUndo}
            {...pageGuideLocalProps(
              'Undo',
              'Revert the last SQL editor change in this tab.',
              21,
            )}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </AppButton>
          <AppButton
            size="icon-md"
            intent="utility"
            className="shrink-0"
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            disabled={!canRedo}
            onClick={handleRedo}
            {...pageGuideLocalProps(
              'Redo',
              'Restore the last undone SQL editor change in this tab.',
              22,
            )}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </AppButton>
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          {showAi ? (
            <>
              <AppButton
                size="icon-md"
                intent={aiOpen ? 'toggle-on' : 'toggle-off'}
                aria-label={aiOpen ? 'Hide AI assistant' : 'Show AI assistant'}
                title={aiOpen ? 'Hide AI assistant' : 'Show AI assistant'}
                aria-pressed={aiOpen}
                onClick={() => setAiOpen((open) => !open)}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </AppButton>
              <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
            </>
          ) : null}
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            onClick={onSave}
            aria-label="Save script"
            title="Save this query"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </AppButton>
        </div>
      </div>

      <div
        ref={splitContainerRef}
        className={cn('flex min-h-0 min-w-0 flex-1 flex-col', editorHeightSplit.isResizing && 'select-none')}
      >
        <section
          className="min-h-0 shrink-0 overflow-hidden"
          style={{ height: `${editorHeightSplit.size}px` }}
        >
          <MonacoEditorPanel
            language="sql"
            value={tab.sql}
            onChange={(value) => onSqlChange(value ?? '')}
            onMount={handleEditorMount}
            options={SQL_SCRIPT_MONACO_OPTIONS}
          />
        </section>

        <WorkspaceHorizontalSplitHandle
          {...editorHeightSplit.splitHandleProps}
          displayClassName="block"
          title="Drag to resize the script and results panes"
        />

        <section className="group relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {showSamples ? (
            <SqlConsoleSampleList samples={sampleQueries} onPick={onApplySample} />
          ) : (
            <DataSourceQueryResultView
              result={tab.result}
              error={tab.error}
              isSubmitting={tab.isRunning}
              idleMessage=""
            />
          )}
          {resultRows.length > 0 && !tab.isRunning ? (
            <div
              className={cn(
                'absolute bottom-3 start-3 end-3 z-10 flex max-w-full flex-wrap items-center justify-end gap-2 rounded-md bg-white/90 p-1 shadow-sm backdrop-blur-[2px]',
                'opacity-40 transition-opacity duration-200',
                'group-hover:opacity-100 group-focus-within:opacity-100',
              )}
            >
              <AppButton
                type="button"
                intent="secondary"
                size="sm"
                disabled={!canExportResults}
                onClick={() => { void handleExportResults('xlsx'); }}
                aria-label="Export results to Excel"
                title="Export results to Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export to Excel
              </AppButton>
              <AppButton
                type="button"
                intent="secondary"
                size="sm"
                disabled={!canExportResults}
                onClick={() => { void handleExportResults('csv'); }}
                aria-label="Export results to CSV"
                title="Export results to CSV"
              >
                <FileText className="h-3.5 w-3.5" />
                Export to CSV
              </AppButton>
            </div>
          ) : null}
        </section>
      </div>
    </div>
      {showAi && aiOpen ? (
        <SqlConsoleAiPanel
          dataSourceId={tab.dataSourceId}
          sql={tab.sql}
          onRunSuggestedSql={onRunSuggestedSql}
        />
      ) : null}
    </div>
  );
};
