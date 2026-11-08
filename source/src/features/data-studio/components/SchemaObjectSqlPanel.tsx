import React, { useEffect, useMemo, useState } from 'react';
import { Check, Code2, Play } from 'lucide-react';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import type { SchemaObjectDependencyItem } from '../../../shared/api/contracts/data-sources/schemaObjectDependencies';
import { assertAlterSchemaSql, assertCreateSchemaSql } from '../../../shared/lib/schemaObjectCreation';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS,
  FloatingPanelShell,
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_CONFIRM_CLASS,
} from '../../../shared/ui';
import { MonacoEditorPanel, setupSqlScriptEditorOnMount, SQL_SCRIPT_MONACO_OPTIONS } from '../../server-functions/components/MonacoEditorPanel';
import { DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS } from '../lib/explorerObjectKinds';
import type { SchemaObjectSqlPanelEntry } from '../hooks/useSchemaObjectSqlPanelManager';
import { SchemaObjectDependenciesSection } from './SchemaObjectDependenciesSection';

const PANEL_BOUNDS = {
  minWidth: 640,
  maxWidth: 1200,
  minHeight: 360,
  maximizeInset: 16,
};

const SUCCESS_FEEDBACK_MS = 3000;
const MONACO_OPTIONS = SQL_SCRIPT_MONACO_OPTIONS;

type SchemaObjectSqlPanelProps = {
  panel: SchemaObjectSqlPanelEntry;
  isSubmitting: boolean;
  onClose: () => void;
  onFocus: () => void;
  onExecute: (sql: string) => Promise<void>;
  onOpenObject: (item: SchemaObjectDependencyItem) => void;
  resolveObjectHref: (item: SchemaObjectDependencyItem) => string;
  onImportantMessage?: (message: string) => void;
};

export const SchemaObjectSqlPanel: React.FC<SchemaObjectSqlPanelProps> = ({
  panel,
  isSubmitting,
  onClose,
  onFocus,
  onExecute,
  onOpenObject,
  resolveObjectHref,
  onImportantMessage,
}) => {
  const isAlterMode = panel.context.mode === 'alter';
  const readOnly = panel.context.readOnly === true;
  const [sql, setSql] = useState(panel.context.initialSql);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setSql(panel.context.initialSql);
    setShowSuccess(false);
  }, [panel.context.initialSql, panel.id]);

  useEffect(() => {
    if (!showSuccess) {
      return;
    }
    const timer = window.setTimeout(() => setShowSuccess(false), SUCCESS_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [showSuccess]);

  const objectKindSingularLabel = DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[panel.context.objectKind];
  const trimmedSql = sql.trim();
  const canSubmit = Boolean(trimmedSql) && !isSubmitting && !readOnly;

  const panelTitle = useMemo(() => {
    const actionLabel = isAlterMode ? 'Alter' : 'Create';
    return `${actionLabel} ${objectKindSingularLabel.toLowerCase()} · ${panel.context.objectName} · ${panel.context.dataSourceName}`;
  }, [isAlterMode, objectKindSingularLabel, panel.context.dataSourceName, panel.context.objectName]);

  const handleSubmit = async () => {
    if (!trimmedSql) {
      onImportantMessage?.('SQL statement is required.');
      return;
    }

    setShowSuccess(false);

    try {
      const preparedSql = isAlterMode
        ? assertAlterSchemaSql(trimmedSql)
        : assertCreateSchemaSql(trimmedSql);
      await onExecute(preparedSql);
      setShowSuccess(true);
    } catch (submitError) {
      const message = isApiError(submitError)
        ? formatApiErrorMessage(submitError)
        : (submitError instanceof Error ? submitError.message : 'Failed to execute schema object SQL.');
      onImportantMessage?.(message);
    }
  };

  return (
    <FloatingPanelShell
      open
      onClose={isSubmitting ? () => undefined : onClose}
      onPointerDown={onFocus}
      title={panelTitle}
      titleIcon={<Code2 className="h-3.5 w-3.5 text-sky-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={820}
      defaultHeight={460}
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
      borderClassName="border-2 border-sky-200/80"
      headerClassName="h-9 border-b border-sky-100/80 bg-sky-50/25 px-3"
      titleClassName="text-xs font-semibold tracking-tight text-sky-950"
      headerExtra={!readOnly ? (
        <div className="flex items-center justify-end" data-floating-panel-drag-exclude>
          <AppButton
            type="button"
            size="icon-sm"
            className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7', ICON_ACTION_CONFIRM_CLASS)}
            disabled={!canSubmit}
            aria-label={showSuccess ? 'Executed' : 'Execute'}
            title={showSuccess ? 'Executed' : 'Execute'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => { void handleSubmit(); }}
          >
            {showSuccess ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </AppButton>
          <span className={DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS} aria-hidden="true" />
        </div>
      ) : undefined}
    >
      <div className="flex h-full min-h-0 flex-col !bg-white">
        <div className="flex min-h-0 flex-1 overflow-hidden border-b border-slate-200">
          <div className="min-h-0 min-w-0 flex-1">
            <MonacoEditorPanel
              language="sql"
              value={sql}
              onChange={(value) => {
                if (readOnly) {
                  return;
                }
                setSql(value ?? '');
                if (error) {
                  setError(null);
                }
                if (showSuccess) {
                  setShowSuccess(false);
                }
              }}
              onMount={setupSqlScriptEditorOnMount}
              options={{
                ...MONACO_OPTIONS,
                readOnly,
              }}
            />
          </div>
          {isAlterMode ? (
            <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-s border-slate-200 bg-slate-50/50 px-3 py-3">
              <SchemaObjectDependenciesSection
                dataSourceId={panel.context.dataSourceId}
                objectName={panel.context.objectName}
                objectKind={panel.context.objectKind}
                onOpenObject={onOpenObject}
                resolveObjectHref={resolveObjectHref}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </FloatingPanelShell>
  );
};
