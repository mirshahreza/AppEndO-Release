// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MermaidDiagram } from '../MermaidDiagram';

const renderMock = vi.fn(async () => ({
  svg: '<svg data-testid="mermaid-svg" height="240" width="320"><title>ER</title></svg>',
  bindFunctions: undefined,
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => renderMock(...args),
  },
}));

describe('MermaidDiagram', () => {
  it('shows rendering state then fades in SVG output', async () => {
    render(<MermaidDiagram chart="erDiagram\n  BaseUser {\n    string id\n  }" />);

    expect(screen.getByText('Rendering…')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('mermaid-svg')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.queryByText('Rendering…')).toBeNull();
    });

    expect(renderMock).toHaveBeenCalled();
  });
});