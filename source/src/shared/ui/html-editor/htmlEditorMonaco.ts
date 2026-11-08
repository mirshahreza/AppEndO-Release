import type { OnMount } from '@monaco-editor/react';
import { applyMonacoEditorLtrDom, composeMonacoOnMount } from '../monacoEditorLtr';

export const HTML_EDITOR_MONACO_OPTIONS = {
  minimap: { enabled: true },
  fontSize: 13,
  lineNumbers: 'on' as const,
  wordWrap: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  folding: true,
  formatOnPaste: true,
  formatOnType: false,
  renderValidationDecorations: 'on' as const,
  overviewRulerLanes: 2,
  glyphMargin: true,
  bracketPairColorization: { enabled: true },
  quickSuggestions: { other: true, comments: false, strings: true },
  suggestOnTriggerCharacters: true,
  autoClosingBrackets: 'languageDefined' as const,
  autoClosingQuotes: 'languageDefined' as const,
  autoIndent: 'full' as const,
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: 'never' as const,
    seedSearchStringFromSelection: 'always' as const,
  },
} as const;

const registerHtmlEditorFormatAction: OnMount = (editor, monaco) => {
  // Prefer language-service HTML formatting when Prettier is not invoked.
  editor.addAction({
    id: 'html-editor.format-document',
    label: 'Format Document',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
    ],
    run: async (activeEditor) => {
      await activeEditor.getAction('editor.action.formatDocument')?.run();
    },
  });
};

export const setupHtmlEditorMonacoOnMount: OnMount = composeMonacoOnMount(
  applyMonacoEditorLtrDom,
  registerHtmlEditorFormatAction,
);
