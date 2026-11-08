import React from 'react';
import { Braces, X } from 'lucide-react';
import { AppButton, CreateEditModalShell } from '../../../shared/ui';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';

const FIXTURE_MONACO_OPTIONS = {
  fontSize: 12,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 8, bottom: 8 },
  wordWrap: 'on',
  domReadOnly: false,
  readOnly: false,
} as const;

export type WorkflowExecuteFixtureDialogProps = {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  documentKey: string;
};

export const WorkflowExecuteFixtureDialog: React.FC<WorkflowExecuteFixtureDialogProps> = ({
  open,
  onClose,
  value,
  onChange,
  documentKey,
}) => {
  if (!open) return null;

  return (
    <CreateEditModalShell
      title={(
        <span className="inline-flex items-center gap-2">
          <Braces className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />
          <span>Output Schema</span>
        </span>
      )}
      size="maximized"
      gradient={false}
      shellClassName="flex min-h-0 flex-col"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="!flex !min-h-0 !flex-1 !flex-col !overflow-hidden !p-0 !min-h-full"
      onClose={onClose}
      footer={(
        <AppButton intent="cancel" size="sm" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          Close
        </AppButton>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <p className="text-xs text-slate-600">
            Simulated node outcomes for execute runs — human tasks, waits, subflows, and non-PURE actions. Edit outcome keys to test different branches.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden" data-floating-panel-drag-exclude>
          <MonacoEditorPanel
            documentKey={documentKey}
            defaultLanguage="json"
            language="json"
            value={value}
            onChange={(next) => onChange(next ?? '')}
            options={FIXTURE_MONACO_OPTIONS}
          />
        </div>
      </div>
    </CreateEditModalShell>
  );
};
