/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesignerCodeEditorField } from '../DesignerFormFields';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-mock">monaco</div>,
}));

describe('DesignerCodeEditorField LTR chrome', () => {
  it('keeps monaco shell LTR when document is RTL', () => {
    document.documentElement.dir = 'rtl';

    render(
      <div dir="rtl">
        <DesignerCodeEditorField
          language="html"
          value="<p>hi</p>"
          onChange={() => {}}
          editorHeight={120}
          ariaLabel="HTML"
          aiAssist={false}
        />
      </div>,
    );

    const shell = screen.getByLabelText('HTML');
    expect(shell.getAttribute('dir')).toBe('ltr');
    expect(shell.className).toContain('[direction:ltr]');

    document.documentElement.dir = 'ltr';
  });
});
