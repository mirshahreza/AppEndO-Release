/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolboxPanelItem } from '../ToolboxPanelShell';

type MockResizeObserverInstance = ResizeObserver & {
  callback: ResizeObserverCallback;
};

class MockResizeObserver implements ResizeObserver {
  static last: MockResizeObserverInstance | null = null;

  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.last = this as MockResizeObserverInstance;
  }

  observe(): void {
    this.callback([], this);
  }

  unobserve(): void {}

  disconnect(): void {}
}

describe('ToolboxPanelItem option liveness', () => {
  const originalResizeObserver = global.ResizeObserver;

  beforeEach(() => {
    MockResizeObserver.last = null;
    global.ResizeObserver = MockResizeObserver as typeof ResizeObserver;
  });

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver;
    cleanup();
  });

  it('renders descriptions, activation, and draggable state observably', () => {
    const onActivate = vi.fn();
    const { container, rerender } = render(
      <ToolboxPanelItem
        label="Query records"
        description="Data · query"
        icon={<span>Q</span>}
        draggable
        onActivate={onActivate}
      />,
    );

    const item = screen.getByLabelText('Query records — Data · query');
    expect(item).toHaveAttribute('draggable', 'true');
    expect(screen.getByText('Data · query')).toBeVisible();
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).not.toBeInTheDocument();
    fireEvent.click(item);
    expect(onActivate).toHaveBeenCalledOnce();

    const onDoubleActivate = vi.fn();
    rerender(
      <ToolboxPanelItem
        label="Query records"
        description="Data · query"
        icon={<span>Q</span>}
        activateOn="dblclick"
        onActivate={onDoubleActivate}
      />,
    );
    fireEvent.click(screen.getByLabelText('Query records — Data · query'));
    expect(onDoubleActivate).not.toHaveBeenCalled();
    fireEvent.dblClick(screen.getByLabelText('Query records — Data · query'));
    expect(onDoubleActivate).toHaveBeenCalledOnce();

    rerender(<ToolboxPanelItem label="Query records" icon={<span>Q</span>} />);
    expect(screen.queryByText('Data · query')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Query records')).not.toHaveAttribute('title');
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).not.toBeInTheDocument();
  });

  it('keeps description in the hint when inline descriptions are hidden', () => {
    const { container } = render(
      <ToolboxPanelItem
        label="Query records"
        description="Data · query"
        showDescriptionInline={false}
        icon={<span>Q</span>}
      />,
    );

    expect(screen.queryByText('Data · query')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Query records — Data · query')).not.toHaveAttribute('title');
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeInTheDocument();
  });

  it('shows the hint when inline description text is truncated', async () => {
    const { container } = render(
      <ToolboxPanelItem
        label="Query records"
        description="Data · query"
        icon={<span>Q</span>}
      />,
    );

    const description = screen.getByText('Data · query');
    Object.defineProperty(description, 'scrollWidth', { configurable: true, value: 200 });
    Object.defineProperty(description, 'clientWidth', { configurable: true, value: 80 });
    MockResizeObserver.last?.callback([], MockResizeObserver.last);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeInTheDocument();
    });
  });
});
