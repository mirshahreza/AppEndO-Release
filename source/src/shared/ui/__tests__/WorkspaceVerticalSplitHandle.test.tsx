// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkspaceVerticalSplitHandle } from '../WorkspaceVerticalSplitHandle';

describe('WorkspaceVerticalSplitHandle', () => {
  it('ghost appearance is a hit target with no painted rail, grip, or chevron', () => {
    render(
      <WorkspaceVerticalSplitHandle
        side="end"
        appearance="ghost"
        onMouseDown={() => undefined}
      />,
    );

    const splitter = screen.getByRole('separator', { name: 'Drag to resize' });
    expect(splitter).toHaveAttribute('aria-orientation', 'vertical');
    expect(splitter.className).toContain('!bg-transparent');
    expect(splitter.className).toContain('cursor-col-resize');
    expect(splitter.querySelector('.rounded-full')).toBeNull();
    expect(screen.queryByRole('button', { name: /Collapse|Expand/ })).not.toBeInTheDocument();
  });
});
