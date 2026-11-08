import React, { Suspense, lazy } from 'react';

const Editor = lazy(() => import('@monaco-editor/react'));

type NavigationManifestJsonEditorProps = {
  value: string;
  readOnly?: boolean;
  onChange: (value: string | undefined) => void;
};

export const NavigationManifestJsonEditor: React.FC<NavigationManifestJsonEditorProps> = ({
  value,
  readOnly = false,
  onChange,
}) => (
  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white">
    <Suspense
      fallback={(
        <div className="flex h-full min-h-[240px] w-full items-center justify-center text-xs font-mono text-slate-400">
          Loading editor…
        </div>
      )}
    >
      <Editor
        height="100%"
        defaultLanguage="json"
        language="json"
        theme="vs"
        value={value}
        onChange={onChange}
        options={{
          readOnly,
          fontSize: 12,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          formatOnPaste: true,
          lineNumbers: 'on',
          folding: true,
          padding: { top: 8, bottom: 8 },
        }}
      />
    </Suspense>
  </div>
);
