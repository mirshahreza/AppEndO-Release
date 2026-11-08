/** @vitest-environment jsdom */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HtmlEditor } from '../HtmlEditor';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-mock">monaco</div>,
}));

describe('HtmlEditor smoke', () => {
  it('renders compact visual/source switch without throwing', () => {
    render(
      <HtmlEditor
        value={'<i data-lucide="User"></i>'}
        onChange={() => {}}
        trustedHtml
        editorHeight={320}
        showModeBar={false}
        toolbarVisualSourceSwitch
        showToolbar
        enableBold
        aiAssist={false}
      />,
    );
    expect(document.querySelector('[data-html-editor="true"]')).toBeTruthy();
  });

  it('renders monaco-only source editor when sourceOnly is set', async () => {
    render(
      <HtmlEditor
        value={'<i data-lucide="User"></i>'}
        onChange={() => {}}
        trustedHtml
        sourceOnly
        editorHeight={320}
        aiAssist={false}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-html-editor-source-only="true"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="monaco-mock"]')).toBeTruthy();
    });
  });
});
