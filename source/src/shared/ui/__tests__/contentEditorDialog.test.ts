import { describe, expect, it } from 'vitest';
import {
  CONTENT_EDITOR_DIALOG_DEFAULT_SIZE,
  CONTENT_EDITOR_DIALOG_SHELL_CLASS,
  CONTENT_EDITOR_DIALOG_SIZED_SHELL_CLASS,
  resolveContentEditorDialogShellClass,
} from '../surfaceClasses';

describe('content editor dialogs', () => {
  it('defaults Markdown/HTML/code editor dialogs to maximized', () => {
    expect(CONTENT_EDITOR_DIALOG_DEFAULT_SIZE).toBe('maximized');
  });

  it('does not cap maximized shells at 85vh', () => {
    expect(resolveContentEditorDialogShellClass('maximized')).toBe(CONTENT_EDITOR_DIALOG_SHELL_CLASS);
    expect(resolveContentEditorDialogShellClass('full')).toBe(CONTENT_EDITOR_DIALOG_SHELL_CLASS);
    expect(CONTENT_EDITOR_DIALOG_SHELL_CLASS).not.toContain('h-[85vh]');
  });

  it('keeps a tall fill only when a smaller size is passed', () => {
    expect(resolveContentEditorDialogShellClass('4xl')).toBe(CONTENT_EDITOR_DIALOG_SIZED_SHELL_CLASS);
    expect(resolveContentEditorDialogShellClass('maximized', 'flex custom')).toBe('flex custom');
  });
});
