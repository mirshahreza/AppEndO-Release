// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { DesignerDiagnostic } from '../../../../../domain/component-designer/types';
import { LiveDesignerFooter } from '../LiveDesignerFooter';

afterEach(() => {
  cleanup();
});

const sampleError: DesignerDiagnostic = {
  id: 'orphan-node:n1',
  code: 'orphan-node',
  level: 'error',
  message: "Node 'n1' is orphaned and has no valid parent.",
  nodeId: 'n1',
};

describe('LiveDesignerFooter interaction mode', () => {
  it('renders inspect/interact as a paging-style label dropdown', () => {
    const onChange = vi.fn();
    render(
      <LiveDesignerFooter interactionMode="inspect" onInteractionModeChange={onChange} />,
    );

    const trigger = screen.getByRole('button', { name: 'Interaction mode' });
    expect(trigger).toHaveTextContent('Inspect');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger.className).toContain('bg-transparent');
    expect(trigger.className).toContain('border-0');
    expect(trigger.className).toContain('text-cyan-700');
    expect(screen.getByTestId('live-designer-footer')).toHaveTextContent('Ctrl+A select all');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Interact' }));
    expect(onChange).toHaveBeenCalledWith('interact');
  });

  it('hides the selected-node label in interact mode', () => {
    render(
      <LiveDesignerFooter
        interactionMode="interact"
        selectionLabel={null}
      />,
    );

    expect(screen.queryByTestId('live-designer-selection-label')).toBeNull();
    expect(screen.getByTestId('live-designer-footer')).toHaveTextContent('Press Esc or I to inspect');
  });
});

describe('LiveDesignerFooter diagnostics entry', () => {
  it('hides the diagnostics button when there are no issues', () => {
    render(<LiveDesignerFooter diagnostics={[]} />);
    expect(screen.queryByTestId('live-designer-diagnostics-button')).toBeNull();
  });

  it('shows a footer button and opens the diagnostics panel when issues exist', () => {
    const onSelect = vi.fn();
    render(
      <LiveDesignerFooter
        diagnostics={[sampleError]}
        onSelectDiagnosticNode={onSelect}
      />,
    );

    const button = screen.getByTestId('live-designer-diagnostics-button');
    expect(button).toHaveAttribute('aria-label', '1 diagnostics');
    fireEvent.click(button);

    expect(screen.getByTestId('designer-diagnostics-panel')).toBeTruthy();
    fireEvent.click(screen.getByText(/orphaned/i));
    expect(onSelect).toHaveBeenCalledWith('n1');
  });
});
