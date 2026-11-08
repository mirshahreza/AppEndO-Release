/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { richCellKindSupportsClick } from '../designerGridRichCellColumns';
import { DesignerGridRichCell } from '../designerGridRichCellRuntime';

describe('Designer grid status badge runtime', () => {
  afterEach(cleanup);

  it('renders the status label and resolves Lucide uiHtml instead of injecting an empty icon', () => {
    const { container } = render(
      <DesignerGridRichCell
        row={{
          statusCode: '102.002.001',
          statusCodeTitle: 'Draft',
          statusCodeUiHtml: '<i data-lucide="file-pen-line"></i>',
          statusCodeUiColor: '#94a3b8',
          statusCodeUpdatedAt: '2026-08-06T16:00:00.000Z',
        }}
        column={{
          key: 'statusCode',
          label: 'Status',
          cellKind: 'status-badge',
          cellFields: {
            labelField: 'statusCodeTitle',
            labelFallbackField: 'statusCode',
            htmlField: 'statusCodeUiHtml',
            colorField: 'statusCodeUiColor',
            dateField: 'statusCodeUpdatedAt',
          },
        }}
        mode="runtime"
        canInvokeCellClick={false}
        onCellClick={() => undefined}
      />,
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('[data-lucide]')).not.toBeInTheDocument();
    const badge = screen.getByText('Draft').closest('span');
    expect(badge).toHaveClass('px-1.5');
    expect(badge).toHaveStyle({ color: '#94a3b8', borderColor: '#94a3b8' });
    expect(container.textContent).toMatch(/2026/);
  });

  it('invokes the configured cell behavior when the status badge is clicked', () => {
    const onCellClick = vi.fn();
    render(
      <DesignerGridRichCell
        row={{ statusCode: '102.002.001', statusCodeTitle: 'Draft' }}
        column={{
          key: 'statusCode',
          label: 'Status',
          cellKind: 'status-badge',
          cellClickBehavior: { kind: 'open-modal', modalNodeId: 'node-edit' },
          cellFields: {
            labelField: 'statusCodeTitle',
            labelFallbackField: 'statusCode',
          },
        }}
        mode="runtime"
        canInvokeCellClick
        onCellClick={onCellClick}
      />,
    );

    expect(richCellKindSupportsClick('status-badge')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });
});
