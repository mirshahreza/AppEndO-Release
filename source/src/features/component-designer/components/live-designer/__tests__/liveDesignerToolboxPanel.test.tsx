// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createInitialDesignerState } from '../../../../../domain/component-designer/state';
import { TOOLBOX_PANEL_SEARCH_HOST_CLASS } from '../../../../../shared/ui/surfaceClasses';
import { LiveDesignerToolboxPanel } from '../LiveDesignerToolboxPanel';
import {
  LIVE_DESIGNER_TOOLBOX_MINIMIZE_ABOVE_ATTR,
  LIVE_DESIGNER_TOOLBOX_MINIMIZE_BESIDE_ATTR,
  LIVE_DESIGNER_TOOLBOX_MINIMIZE_GAP,
  LIVE_DESIGNER_TOOLBOX_RESTORE_BEFORE_ATTR,
  LIVE_DESIGNER_TOOLBOX_RESTORE_BELOW_ATTR,
  LIVE_DESIGNER_TOOLBOX_RESTORE_GAP,
} from '../liveDesignerToolboxAnchor';
import {
  endLiveDesignerExternalDrag,
  getLiveDesignerExternalDrag,
} from '../liveDesignerDragSession';

afterEach(() => {
  endLiveDesignerExternalDrag();
  cleanup();
});

describe('LiveDesignerToolboxPanel catalog subset', () => {
  it('shows Grid from Base Components and hides App Table Grid / parked extras', () => {
    const state = createInitialDesignerState('toolbox-catalog-subset');
    render(
      <LiveDesignerToolboxPanel
        document={state.document}
        insertParentId={state.document.rootNodeId}
        onInsertItem={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Grid' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'App Table Grid' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'FAQ Accordion' })).not.toBeInTheDocument();
  });
});

describe('LiveDesignerToolboxPanel insert', () => {
  it('inserts on double-click, not single click', () => {
    const onInsertItem = vi.fn();
    const state = createInitialDesignerState('toolbox-dblclick-insert');
    render(
      <LiveDesignerToolboxPanel
        document={state.document}
        insertParentId={state.document.rootNodeId}
        onInsertItem={onInsertItem}
      />,
    );

    const item = screen.getAllByRole('button').find((button) => button.getAttribute('draggable') === 'true');
    expect(item).toBeTruthy();

    fireEvent.click(item!);
    expect(onInsertItem).not.toHaveBeenCalled();

    fireEvent.dblClick(item!);
    expect(onInsertItem).toHaveBeenCalledOnce();
  });
});

describe('LiveDesignerToolboxPanel drag', () => {
  it('marks toolbox items as draggable and starts an external palette drag', () => {
    const state = createInitialDesignerState('toolbox-drag');
    render(
      <LiveDesignerToolboxPanel
        document={state.document}
        insertParentId={state.document.rootNodeId}
        onInsertItem={() => undefined}
      />,
    );

    const item = screen.getAllByRole('button').find((button) => button.getAttribute('draggable') === 'true');
    expect(item).toBeTruthy();

    const dataTransfer = {
      setData: vi.fn(),
      setDragImage: vi.fn(),
      effectAllowed: 'none',
    };

    fireEvent.dragStart(item!, { dataTransfer });
    expect(getLiveDesignerExternalDrag()?.kind).toBe('palette');
    expect(dataTransfer.setData).toHaveBeenCalled();
    expect(dataTransfer.effectAllowed).toBe('copy');

    fireEvent.dragEnd(item!);
    expect(getLiveDesignerExternalDrag()).toBeNull();
  });
});

describe('LiveDesignerToolboxPanel window chrome', () => {
  it('stays open with minimize and restore instead of close', () => {
    const state = createInitialDesignerState('toolbox-chrome');
    render(
      <LiveDesignerToolboxPanel
        document={state.document}
        insertParentId={state.document.rootNodeId}
        onInsertItem={() => undefined}
      />,
    );

    expect(screen.getByPlaceholderText('toolbox…')).toBeInTheDocument();
    expect(TOOLBOX_PANEL_SEARCH_HOST_CLASS).toContain('select-none');
    expect(screen.queryByRole('button', { name: 'Close floating window' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Maximize floating window' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Minimize floating window' }));
    expect(screen.queryByPlaceholderText('toolbox…')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore floating window' }));
    expect(screen.getByPlaceholderText('toolbox…')).toBeInTheDocument();
  });

  it('uses violet chrome so it does not blend into the canvas', () => {
    const state = createInitialDesignerState('toolbox-chrome-tone');
    render(
      <LiveDesignerToolboxPanel
        document={state.document}
        insertParentId={state.document.rootNodeId}
        onInsertItem={() => undefined}
      />,
    );

    const panel = screen.getByText('Toolbox').closest('aside');
    expect(panel).toHaveClass('border-violet-200/80');
  });

  it('can be moved while minimized', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

    const state = createInitialDesignerState('toolbox-minimized-drag');
    render(
      <LiveDesignerToolboxPanel
        document={state.document}
        insertParentId={state.document.rootNodeId}
        onInsertItem={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Minimize floating window' }));

    const panel = screen.getByText('Toolbox').closest('aside');
    expect(panel).toBeTruthy();
    const handle = panel!.querySelector('[data-panel-drag-handle]');
    expect(handle).toBeTruthy();
    const rightBefore = panel!.style.right;

    fireEvent.pointerDown(handle!, { pointerId: 1, clientX: 1100, clientY: 80 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 980, clientY: 140 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 980, clientY: 140 });

    expect(panel!.style.right).not.toBe(rightBefore);
  });

  it('minimizes into the bottom-left corner', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

    const state = createInitialDesignerState('toolbox-minimized-corner');
    render(
      <LiveDesignerToolboxPanel
        document={state.document}
        insertParentId={state.document.rootNodeId}
        onInsertItem={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Minimize floating window' }));
    const panel = screen.getByText('Toolbox').closest('aside');
    expect(panel).toBeTruthy();
    expect(screen.queryByPlaceholderText('toolbox…')).not.toBeInTheDocument();
    expect(panel!.style.height).toBe('40px');
    expect(Number.parseInt(panel!.style.top, 10)).toBeGreaterThan(700);
    expect(Number.parseInt(panel!.style.right, 10)).toBeGreaterThan(900);
  });

  it('minimizes 10px beside the outline and 10px above the footer', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

    const outlineRight = 281;
    const footerTop = 876;
    const mockRect = (rect: Partial<DOMRect>): DOMRect => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => rect,
      ...rect,
    });

    const state = createInitialDesignerState('toolbox-minimized-outline-gap');
    render(
      <>
        <div
          {...{ [LIVE_DESIGNER_TOOLBOX_MINIMIZE_BESIDE_ATTR]: true }}
          ref={(node) => {
            if (node) {
              node.getBoundingClientRect = () => mockRect({ right: outlineRight });
            }
          }}
        />
        <div
          {...{ [LIVE_DESIGNER_TOOLBOX_MINIMIZE_ABOVE_ATTR]: true }}
          ref={(node) => {
            if (node) {
              node.getBoundingClientRect = () => mockRect({ top: footerTop });
            }
          }}
        />
        <LiveDesignerToolboxPanel
          document={state.document}
          insertParentId={state.document.rootNodeId}
          onInsertItem={() => undefined}
        />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Minimize floating window' }));
    const panel = screen.getByText('Toolbox').closest('aside');
    expect(panel).toBeTruthy();

    const toolboxWidth = Number.parseInt(panel!.style.width, 10);
    expect(Number.parseInt(panel!.style.right, 10)).toBe(
      1600 - outlineRight - LIVE_DESIGNER_TOOLBOX_MINIMIZE_GAP - toolboxWidth,
    );
    expect(Number.parseInt(panel!.style.top, 10)).toBe(
      footerTop - 40 - LIVE_DESIGNER_TOOLBOX_MINIMIZE_GAP,
    );
  });

  it('restores to the top-right with a gap from properties', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });

    const propertiesLeft = 1280;
    const toolbarBottom = 72;
    const footerTop = 876;
    const mockRect = (rect: Partial<DOMRect>): DOMRect => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => rect,
      ...rect,
    });

    const state = createInitialDesignerState('toolbox-restored-properties-gap');
    render(
      <>
        <div
          {...{ [LIVE_DESIGNER_TOOLBOX_RESTORE_BEFORE_ATTR]: true }}
          ref={(node) => {
            if (node) {
              node.getBoundingClientRect = () => mockRect({ left: propertiesLeft });
            }
          }}
        />
        <div
          {...{ [LIVE_DESIGNER_TOOLBOX_RESTORE_BELOW_ATTR]: true }}
          ref={(node) => {
            if (node) {
              node.getBoundingClientRect = () => mockRect({ bottom: toolbarBottom });
            }
          }}
        />
        <div
          {...{ [LIVE_DESIGNER_TOOLBOX_MINIMIZE_ABOVE_ATTR]: true }}
          ref={(node) => {
            if (node) {
              node.getBoundingClientRect = () => mockRect({ top: footerTop });
            }
          }}
        />
        <LiveDesignerToolboxPanel
          document={state.document}
          insertParentId={state.document.rootNodeId}
          onInsertItem={() => undefined}
        />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Minimize floating window' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore floating window' }));
    const panel = screen.getByText('Toolbox').closest('aside');
    expect(panel).toBeTruthy();
    expect(screen.getByPlaceholderText('toolbox…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Maximize floating window' })).not.toBeInTheDocument();

    expect(Number.parseInt(panel!.style.right, 10)).toBe(
      1600 - (propertiesLeft - LIVE_DESIGNER_TOOLBOX_RESTORE_GAP),
    );
    expect(Number.parseInt(panel!.style.top, 10)).toBe(
      toolbarBottom + LIVE_DESIGNER_TOOLBOX_RESTORE_GAP,
    );
    expect(Number.parseInt(panel!.style.height, 10)).toBe(
      footerTop - LIVE_DESIGNER_TOOLBOX_RESTORE_GAP - (toolbarBottom + LIVE_DESIGNER_TOOLBOX_RESTORE_GAP),
    );
  });
});
