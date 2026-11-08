import * as React from 'react';
import { Suspense, lazy } from 'react';
import { Code2 } from 'lucide-react';
import type { DesignerDiagnostic } from '../../../../domain/component-designer/types';
import { setupDesignerCodeEditorOnMount } from '../../editor/setupDesignerMonaco';
import { LiveDesignerDockPanelHeader } from './LiveDesignerDockPanelHeader';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

export type LiveDesignerCodePanelProps = {
  documentKey: string;
  value: string;
  diagnostics: DesignerDiagnostic[];
  onChange: (value: string) => void;
  onClose: () => void;
  width: number;
};

export const LiveDesignerCodePanel: React.FC<LiveDesignerCodePanelProps> = ({
  documentKey,
  value,
  diagnostics,
  onChange,
  onClose,
  width,
}) => (
  <aside
    className="flex h-full min-h-0 shrink-0 flex-col border-l border-slate-200 bg-white"
    style={{ width }}
    data-testid="live-designer-code-panel"
  >
    <LiveDesignerDockPanelHeader
      title="Code"
      titleIcon={<Code2 className="h-3.5 w-3.5" />}
      closeAriaLabel="Close code"
      onClose={onClose}
    />

    <div className="min-h-0 flex-1 overflow-hidden">
      <Suspense
        fallback={(
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Loading editor…
          </div>
        )}
      >
        <MonacoEditor
          key={documentKey}
          height="100%"
          language="typescript"
          path={`live-designer://${documentKey}.tsx`}
          value={value}
          onChange={(next) => onChange(next ?? '')}
          onMount={setupDesignerCodeEditorOnMount}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            wordWrap: 'on',
            fontSize: 12,
            scrollBeyondLastLine: false,
            tabSize: 2,
            ariaLabel: 'Live Designer TSX code editor',
          }}
        />
      </Suspense>
    </div>

    {diagnostics.length > 0 ? (
      <div className="max-h-28 space-y-1 overflow-auto border-t border-rose-100 bg-rose-50/70 px-3 py-2">
        {diagnostics.map((diagnostic) => (
          <p key={diagnostic.id} className="text-[10px] leading-4 text-rose-700">
            {diagnostic.message}
          </p>
        ))}
      </div>
    ) : null}
  </aside>
);
