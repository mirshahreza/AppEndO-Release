import React, { Suspense, lazy } from 'react';
import type { OnMount } from '@monaco-editor/react';

const Editor = lazy(() => import('@monaco-editor/react'));

export type MonacoEditorPanelProps = {
  height?: string;
  defaultLanguage?: string;
  language: string;
  theme?: string;
  value: string;
  documentKey?: string;
  onChange: (value: string | undefined) => void;
  onMount?: OnMount;
  options: Record<string, unknown>;
};

export const MonacoEditorPanel: React.FC<MonacoEditorPanelProps> = ({
  height = '100%',
  defaultLanguage = 'typescript',
  language,
  theme = 'vs',
  value,
  documentKey,
  onChange,
  onMount,
  options,
}) => (
  <div className="flex-grow flex-1 w-full h-full min-h-0 relative">
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400 font-mono">
          Loading editor...
        </div>
      }
    >
      <Editor
        key={documentKey}
        height={height}
        defaultLanguage={defaultLanguage}
        language={language}
        theme={theme}
        value={value}
        onMount={onMount}
        onChange={onChange}
        options={options}
      />
    </Suspense>
  </div>
);

export const SQL_SCRIPT_MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: 'on' as const,
  wordWrap: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  renderValidationDecorations: 'off',
  overviewRulerLanes: 0,
  glyphMargin: false,
} as const;

export const setupSqlScriptEditorOnMount: OnMount = (editor, monaco) => {
  const textarea = editor.getDomNode()?.querySelector('textarea');
  if (textarea) {
    textarea.setAttribute('spellcheck', 'false');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocapitalize', 'off');
  }

  const model = editor.getModel();
  if (model) {
    monaco.editor.setModelMarkers(model, 'sql', []);
  }
};

export const setupEdgeCodeEditorOnMount: OnMount = (editor, monaco) => {
  const textarea = editor.getDomNode()?.querySelector('textarea');
  if (textarea) {
    textarea.setAttribute('spellcheck', 'false');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocapitalize', 'off');
  }

  // Sandbox edge scripts are not a full TS project (no module graph / path resolution).
  // Keep syntax diagnostics only so import/path/"address" semantic noise stays off.
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  });
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  });

  const edgeRuntimeTypes = [
    'type __EdgeReq = {',
    '  body: Record<string, unknown>;',
    '  query: Record<string, unknown>;',
    '  params: Record<string, string>;',
    '  method: string;',
    '  headers: Record<string, string | undefined>;',
    '};',
    '',
    'type __EdgeRes = {',
    '  json(data: unknown): unknown;',
    '  headersSent(): boolean;',
    '  send(data: unknown): unknown;',
    '  status(code: number): __EdgeRes;',
    '};',
    '',
    'type __EdgeDb = {',
    '  query(sql: string, params?: unknown[]): Promise<unknown>;',
    '};',
    '',
    'declare const req: __EdgeReq;',
    'declare const res: __EdgeRes;',
    'declare const db: __EdgeDb;',
  ].join('\n');

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    noEmit: true,
    strict: false,
  });

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    noEmit: true,
    checkJs: false,
  });

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    edgeRuntimeTypes,
    'file:///edge-runtime-globals.d.ts',
  );

  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    edgeRuntimeTypes,
    'file:///edge-runtime-globals-js.d.ts',
  );
};
