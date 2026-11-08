import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { Play, Terminal } from 'lucide-react';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import type { ExecuteDataSourceQueryResult } from '../../../shared/api/contracts/data-sources/executeQuery';
import { cn } from '../../../lib/utils';
import { AppButton, DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS, FloatingPanelShell, ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_CONFIRM_CLASS, WorkspaceHorizontalSplitHandle, WORKSPACE_SPLIT_PANEL_KEYS, useWorkspaceHorizontalSplitPanel } from '../../../shared/ui';
import { MonacoEditorPanel, setupSqlScriptEditorOnMount, SQL_SCRIPT_MONACO_OPTIONS } from '../../server-functions/components/MonacoEditorPanel';
import { DataSourceQueryResultView } from '../../data-sources/components/DataSourceQueryResultView';
import { DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS } from '../lib/explorerObjectKinds';
import { subscribeSchemaObjectRunF5, isRunPanelShortcutKeyboardEvent } from '../lib/schemaObjectRunF5Shortcut';
import type { SchemaObjectRunPanelEntry } from '../hooks/useSchemaObjectRunPanelManager';

const PANEL_BOUNDS = {
  minWidth: 640,
  maxWidth: 1200,
  minHeight: 360,
  maximizeInset: 16,
};

const MONACO_OPTIONS = SQL_SCRIPT_MONACO_OPTIONS;

type SchemaObjectRunPanelProps = {
  panel: SchemaObjectRunPanelEntry;
  isFrontmost: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onFocus: () => void;
  onRun: (sql: string) => Promise<ExecuteDataSourceQueryResult>;
};

export const SchemaObjectRunPanel: React.FC<SchemaObjectRunPanelProps> = ({
  panel,
  isFrontmost,
  isSubmitting,
  onClose,
  onFocus,
  onRun,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sql, setSql] = useState(panel.context.initialSql);
  const [result, setResult] = useState<ExecuteDataSourceQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usageHeightSplit = useWorkspaceHorizontalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.dataStudioRunUsageHeight,
    defaultSize: 220,
    minSize: 120,
    maxSize: 520,
    measure: 'leading',
    containerRef,
    displayClassName: 'block',
  });

  useEffect(() => {
    setSql(panel.context.initialSql);
    setResult(null);
    setError(null);
  }, [panel.context.initialSql, panel.id]);

  const objectKindSingularLabel = DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[panel.context.objectKind];
  const trimmedSql = sql.trim();
  const canRun = Boolean(trimmedSql) && !isSubmitting;

  const panelTitle = useMemo(
    () => `Run ${objectKindSingularLabel.toLowerCase()} · ${panel.context.objectName} · ${panel.context.dataSourceName}`,
    [objectKindSingularLabel, panel.context.dataSourceName, panel.context.objectName],
  );

  const handleRun = useCallback(async () => {
    if (!trimmedSql) {
      setError('SQL statement is required.');
      return;
    }

    setError(null);
    setResult(null);

    try {
      const nextResult = await onRun(trimmedSql);
      setResult(nextResult);
    } catch (runError) {
      const message = isApiError(runError)
        ? formatApiErrorMessage(runError)
        : (runError instanceof Error ? runError.message : 'Failed to run SQL.');
      setError(message);
    }
  }, [onRun, trimmedSql]);

  const isFrontmostRef = useRef(isFrontmost);
  const canRunRef = useRef(canRun);
  const handleRunRef = useRef(handleRun);
  const lastF5TriggerAtRef = useRef(0);
  isFrontmostRef.current = isFrontmost;
  canRunRef.current = canRun;
  handleRunRef.current = handleRun;

  const triggerPlayFromF5 = useCallback(() => {
    if (!canRunRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastF5TriggerAtRef.current < 200) {
      return;
    }
    lastF5TriggerAtRef.current = now;
    void handleRunRef.current();
  }, []);

  const handleEditorMount = useCallback<OnMount>((editor, monaco) => {
    setupSqlScriptEditorOnMount(editor, monaco);

    editor.addAction({
      id: 'schema-object-run.execute',
      label: 'Run',
      keybindings: [
        monaco.KeyCode.F5,
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      ],
      run: () => {
        triggerPlayFromF5();
      },
    });

    editor.onKeyDown((keydownEvent) => {
      const isF5 = keydownEvent.keyCode === monaco.KeyCode.F5;
      const isCtrlEnter = keydownEvent.keyCode === monaco.KeyCode.Enter && (keydownEvent.ctrlKey || keydownEvent.metaKey);
      if (!isF5 && !isCtrlEnter) {
        return;
      }
      keydownEvent.preventDefault();
      keydownEvent.stopPropagation();
      triggerPlayFromF5();
    });
  }, [triggerPlayFromF5]);

  useEffect(() => subscribeSchemaObjectRunF5({
    shouldHandle: () => {
      if (isFrontmostRef.current) {
        return true;
      }
      const panelRoot = containerRef.current?.closest('aside');
      const activeElement = document.activeElement;
      return Boolean(panelRoot && activeElement && panelRoot.contains(activeElement));
    },
    onPlay: triggerPlayFromF5,
  }), [triggerPlayFromF5]);

  return (
    <FloatingPanelShell
      open
      onClose={isSubmitting ? () => undefined : onClose}
      onPointerDown={onFocus}
      title={panelTitle}
      titleIcon={<Terminal className="h-3.5 w-3.5 text-sky-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={860}
      defaultHeight={520}
      initialPosition="bottom-right"
      initialOffset={{
        x: panel.cascadeIndex * 24,
        y: panel.cascadeIndex * 24,
      }}
      dragFromHeaderOnly
      enableDrag
      enableResize
      enableMaximize
      zIndex={panel.zOrder}
      onKeyDownCapture={(event) => {
        if (!isRunPanelShortcutKeyboardEvent(event.nativeEvent)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        triggerPlayFromF5();
      }}
      borderClassName="border-2 border-sky-200/80"
      headerClassName="h-9 border-b border-sky-100/80 bg-sky-50/25 px-3"
      titleClassName="text-xs font-semibold tracking-tight text-sky-950"
      headerExtra={(
        <div className="flex items-center justify-end" data-floating-panel-drag-exclude>
          <AppButton
            type="button"
            size="icon-sm"
            className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7', ICON_ACTION_CONFIRM_CLASS)}
            disabled={!canRun}
            aria-label="Run (F5 or Ctrl+Enter)"
            title="Run (F5 or Ctrl+Enter)"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => { void handleRun(); }}
          >
            <Play className="h-4 w-4" />
          </AppButton>
          <span className={DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS} aria-hidden="true" />
        </div>
      )}
    >
      <div
        ref={containerRef}
        className={`flex h-full min-h-0 flex-col overflow-hidden !bg-white ${usageHeightSplit.isResizing ? 'select-none' : ''}`}
      >
        <section
          className="min-h-0 overflow-hidden"
          style={{ height: `${usageHeightSplit.size}px` }}
          data-floating-panel-drag-exclude
        >
          <MonacoEditorPanel
            language="sql"
            value={sql}
            onChange={(value) => {
              setSql(value ?? '');
              if (error) {
                setError(null);
              }
            }}
            onMount={handleEditorMount}
            options={MONACO_OPTIONS}
          />
        </section>

        <WorkspaceHorizontalSplitHandle
          {...usageHeightSplit.splitHandleProps}
          displayClassName="block"
          title="Drag to resize usage SQL and results panes"
        />

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden" data-floating-panel-drag-exclude>
          <DataSourceQueryResultView
            result={result}
            error={error}
            isSubmitting={isSubmitting}
            idleMessage="Run the usage SQL to see results here."
          />
        </section>
      </div>
    </FloatingPanelShell>
  );
};
