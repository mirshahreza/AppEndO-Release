/**
 * @vitest-environment jsdom
 * viz.timeline / viz.gantt — real click-through selection output, a bound-but-empty state
 * (Timeline previously rendered nothing at all), and Gantt's new progress-fill/date-axis/today
 * marker basic visual foundation. See DesignerRuntimeTimelineWidgets.tsx.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DesignerVizGantt, DesignerVizTimeline } from '../DesignerRuntimeTimelineWidgets';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { resolveNodeEventBindingTargets } from '../bindingEngine';

afterEach(() => cleanup());

const EVENTS = JSON.stringify([
  { id: 'kickoff', title: 'Kickoff', start: '2026-01-01', end: '2026-01-05' },
  { id: 'build', title: 'Build', start: '2026-01-05', end: '2026-01-20', progress: 40 },
]);

describe('viz.timeline', () => {
  it('clicking an event fires onSelectionChange with its id', () => {
    const onSelectionChange = vi.fn();
    render(<DesignerVizTimeline data={EVENTS} onSelectionChange={onSelectionChange} />);

    fireEvent.click(screen.getByText('Build'));

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect((onSelectionChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('build');
  });

  it('shows an empty state instead of nothing when bound and resolved to zero events', () => {
    render(<DesignerVizTimeline data="[]" vizListBound />);
    expect(screen.getByText(/No data/)).toBeTruthy();
  });
});

describe('viz.gantt', () => {
  it('renders a progress-filled inner bar when a progress value is present', () => {
    const { container } = render(<DesignerVizGantt data={EVENTS} />);
    const buttons = container.querySelectorAll('button[title*="40%"]');
    expect(buttons.length).toBe(1);
    const fill = buttons[0].querySelector('div');
    expect(fill?.getAttribute('style')).toContain('width: 40%');
  });

  it('clicking a bar fires onSelectionChange with its id', () => {
    const onSelectionChange = vi.fn();
    render(<DesignerVizGantt data={EVENTS} onSelectionChange={onSelectionChange} />);

    fireEvent.click(document.querySelector('button[title*="2026-01-01"]')!);

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect((onSelectionChange.mock.calls[0][0] as { target: { value: string } }).target.value).toBe('kickoff');
  });

  it('renders a date-axis header with evenly spaced tick labels', () => {
    const { container } = render(<DesignerVizGantt data={EVENTS} />);
    const axis = container.querySelector('.flex.justify-between.text-\\[10px\\].text-slate-400');
    expect(axis).toBeTruthy();
    expect(axis!.children.length).toBeGreaterThanOrEqual(4);
  });

  it('renders dependency connectors between related task bars', () => {
    const { container } = render(
      <DesignerVizGantt
        data={EVENTS}
        dependencies={[{ fromTaskId: 'kickoff', toTaskId: 'build' }]}
      />,
    );
    expect(container.querySelector('[data-gantt-dependency="kickoff:build"]')).toBeTruthy();
  });

  it('changes axis labels when viewMode changes', () => {
    const { rerender } = render(<DesignerVizGantt data={EVENTS} viewMode="week" />);
    expect(screen.getAllByText(/Week of/i).length).toBeGreaterThan(0);

    rerender(<DesignerVizGantt data={EVENTS} viewMode="month" />);
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Week of/i)).toBeNull();
  });

  it('dragging a task updates dates and emits onTaskDrag with the new schedule', () => {
    const onTaskDrag = vi.fn();
    const { container } = render(
      <DesignerVizGantt data={EVENTS} allowTaskDrag onTaskDrag={onTaskDrag} />,
    );
    const taskBar = container.querySelector('button[title*="2026-01-01"]') as HTMLButtonElement | null;
    const track = taskBar?.closest('.relative')?.parentElement as HTMLDivElement | null;
    expect(taskBar).toBeTruthy();
    expect(track).toBeTruthy();
    Object.defineProperty(track!, 'clientWidth', { configurable: true, value: 200 });

    fireEvent.mouseDown(taskBar!, { clientX: 40 });
    fireEvent.mouseMove(window, { clientX: 90 });
    fireEvent.mouseUp(window);

    expect(onTaskDrag).toHaveBeenCalledTimes(1);
    const payload = (onTaskDrag.mock.calls[0][0] as { target: { value: { taskId: string; daysDelta: number; start: string } } }).target.value;
    expect(payload.taskId).toBe('kickoff');
    expect(payload.daysDelta).toBeGreaterThan(0);
    expect(payload.start).not.toBe('2026-01-01');
  });

  it('stretches to fill w-full / h-full instead of a content-sized box', () => {
    const { container } = render(
      <div className="flex h-[420px] w-[640px] flex-col">
        <DesignerVizGantt data={EVENTS} className="h-full w-full rounded-lg border" />
      </div>,
    );
    const root = container.querySelector('[data-designer-component="viz.gantt"]');
    const track = container.querySelector('[data-gantt-track="true"]');
    expect(root).toHaveClass('flex', 'h-full', 'w-full', 'flex-1', 'self-stretch', 'min-w-0');
    expect(track).toHaveClass('h-full');
    expect(track?.getAttribute('style') ?? '').not.toMatch(/(?<!min-)height:\s*\d+px/);
  });

  it('shows an empty state instead of "No events" when bound and resolved to zero events', () => {
    render(<DesignerVizGantt data="[]" vizListBound />);
    expect(screen.getByText(/No data/)).toBeTruthy();
    expect(screen.queryByText('No events')).toBeNull();
  });

  it('export keeps the new gantt props and exposes onTaskDrag as a bindable event', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'viz.gantt',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'viewMode', value: 'month' });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'dependencies',
      value: JSON.stringify([{ fromTaskId: 'kickoff', toTaskId: 'build' }]),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'milestones',
      value: JSON.stringify([{ taskId: 'build', label: 'Launch' }]),
    });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'allowTaskDrag', value: true });

    const node = state.document.nodes[nodeId]!;
    expect(resolveNodeEventBindingTargets(node)).toEqual(expect.arrayContaining(['onSelectionChange', 'onTaskDrag']));

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('viewMode="month"');
    expect(tsx).toContain('dependencies=');
    expect(tsx).toContain('fromTaskId');
    expect(tsx).toContain('toTaskId');
    expect(tsx).toContain('milestones=');
    expect(tsx).toContain('Launch');
    expect(tsx).toContain('allowTaskDrag');
  });
});
