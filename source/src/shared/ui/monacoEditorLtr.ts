import type { OnMount } from '@monaco-editor/react';
import { TECHNICAL_LTR_CLASS } from '../../core/culture/technicalCultureLabels';
import { cn } from '../../lib/utils';

/** Shell around `@monaco-editor/react` — immune to page/modal RTL. */
export const MONACO_EDITOR_LTR_SHELL_CLASS = cn(
  TECHNICAL_LTR_CLASS,
  'text-left isolate [unicode-bidi:isolate]',
);

export const applyMonacoEditorLtrDom: OnMount = (editor) => {
  const root = editor.getDomNode();
  if (root) {
    root.setAttribute('dir', 'ltr');
    root.style.direction = 'ltr';
    root.style.textAlign = 'left';
  }

  const textarea = root?.querySelector('textarea');
  if (textarea) {
    textarea.setAttribute('dir', 'ltr');
    textarea.setAttribute('spellcheck', 'false');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocapitalize', 'off');
  }
};

export const composeMonacoOnMount = (
  ...handlers: Array<OnMount | undefined>
): OnMount => (editor, monaco) => {
  for (const handler of handlers) {
    handler?.(editor, monaco);
  }
};
