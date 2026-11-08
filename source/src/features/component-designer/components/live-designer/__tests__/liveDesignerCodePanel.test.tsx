// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LiveDesignerCodePanel } from '../LiveDesignerCodePanel';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <textarea aria-label="monaco-editor" value={value} readOnly />
  ),
}));

afterEach(() => {
  cleanup();
});

describe('LiveDesignerCodePanel header', () => {
  it('shows a close control without filename or copy/reset actions', async () => {
    const onClose = vi.fn();
    render(
      <LiveDesignerCodePanel
        documentKey="demo"
        value="export function Demo() { return null; }"
        diagnostics={[]}
        onChange={() => undefined}
        onClose={onClose}
        width={420}
      />,
    );

    expect(screen.getByTestId('live-designer-code-panel')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.queryByText(/\.tsx/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset code from canvas' })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Close code' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
