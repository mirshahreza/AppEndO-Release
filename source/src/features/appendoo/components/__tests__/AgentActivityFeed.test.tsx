// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AgentActivityFeed } from '../AgentActivityFeed';

afterEach(() => {
  cleanup();
});

const doneStep = {
  id: '1',
  name: 'read_file',
  args: { path: 'src/foo.ts' },
  status: 'done' as const,
  activityTitle: 'Reading src/foo.ts',
  intention: 'Review file contents before making changes',
  result: { ok: true, summary: 'Read complete' },
};

describe('AgentActivityFeed', () => {
  it('renders running activity with English label', () => {
    render(
      <AgentActivityFeed
        isActive
        thinking="Reading src/foo.ts"
        steps={[{
          id: '1',
          name: 'read_file',
          args: { path: 'src/foo.ts' },
          status: 'running',
          activityTitle: 'Reading src/foo.ts',
          intention: 'Review file contents before making changes',
        }]}
      />,
    );

    const feed = screen.getByTestId('agent-activity-feed');
    expect(within(feed).getAllByText('Reading src/foo.ts').length).toBeGreaterThan(0);
    expect(screen.getByTestId('agent-activity-details-toggle')).toBeTruthy();
  });

  it('collapses details after the run finishes and shows a subtle reopen icon', () => {
    const { rerender } = render(
      <AgentActivityFeed
        isActive
        thinking="Working…"
        steps={[{ ...doneStep, status: 'running' }]}
      />,
    );

    const feed = screen.getByTestId('agent-activity-feed');
    expect(within(feed).getAllByText('Reading src/foo.ts').length).toBeGreaterThan(0);

    rerender(
      <AgentActivityFeed
        isActive={false}
        steps={[doneStep]}
      />,
    );

    expect(within(feed).getByText('1 step completed')).toBeTruthy();
    expect(within(feed).queryByText('Review file contents before making changes')).toBeNull();

    const toggle = within(feed).getByTestId('agent-activity-details-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Show activity details');

    fireEvent.click(toggle);

    expect(within(feed).getByText('Review file contents before making changes')).toBeTruthy();
    expect(toggle.getAttribute('aria-label')).toBe('Hide activity details');
  });

  it('shows only a bounded live preview while running, and reveals full detail on click', () => {
    const manySteps = Array.from({ length: 8 }, (_, index) => ({
      id: `step-${index}`,
      name: 'read_file',
      args: {},
      status: 'done' as const,
      activityTitle: `Step ${index}`,
      intention: `Reason for step ${index}`,
    }));

    render(
      <AgentActivityFeed
        isActive
        thinking="Working…"
        steps={manySteps}
      />,
    );

    const feed = screen.getByTestId('agent-activity-feed');
    expect(within(feed).queryByText('Step 0')).toBeNull();
    expect(within(feed).getByText('Step 7')).toBeTruthy();
    expect(within(feed).queryByText('Reason for step 7')).toBeNull();

    const toggle = within(feed).getByTestId('agent-activity-details-toggle');
    fireEvent.click(toggle);

    expect(within(feed).getByText('Step 0')).toBeTruthy();
    expect(within(feed).getByText('Reason for step 7')).toBeTruthy();
  });

  it('keeps internal activity visible after a failed run', () => {
    const { rerender } = render(
      <AgentActivityFeed
        isActive
        thinking="Understanding target…"
        steps={[]}
      />,
    );

    const feed = screen.getByTestId('agent-activity-feed');
    expect(within(feed).getAllByText('Understanding target…').length).toBeGreaterThan(0);

    rerender(
      <AgentActivityFeed
        isActive={false}
        steps={[{
          id: 'status-0',
          name: 'status',
          args: {},
          status: 'error',
          activityTitle: 'Understanding target…',
        }]}
      />,
    );

    expect(within(feed).getByText('Understanding target…')).toBeTruthy();
    expect(within(feed).getByTestId('agent-activity-details-toggle')).toBeTruthy();
  });
});
