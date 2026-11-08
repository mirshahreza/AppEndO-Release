/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CultureProvider } from '../../../../../app/platform/CultureContext';
import { PageGuideOverlay } from '../PageGuideOverlay';
import { pageGuideProps } from '../pageGuide.attrs';
import { PAGE_GUIDE_AUTOPLAY_MS } from '../pageGuide.types';

const copy = {
  closeAria: 'Close tour guide',
  next: 'Next',
  previous: 'Previous',
  playAria: 'Play tour',
  pauseAria: 'Pause tour',
  done: 'Done',
  step: (current: number, total: number) => `${current} of ${total}`,
  changeShapeAria: 'Drag the tour guide, or click to change shape',
  emptyTitle: 'Nothing to tour',
  emptyHint: 'None',
  chooser: {
    title: 'What should I explain?',
    hint: 'Pick a path.',
    aria: 'Tour topic',
    pageTitle: 'This page',
    pageHint: 'The workspace on this screen.',
    navigationTitle: 'Other pages and navigation',
    navigationHint: 'The sidebar and how you move between pages.',
    capabilitiesTitle: 'Your capabilities',
    capabilitiesHint: 'The studio tools available to you.',
  },
};

const stubRect = (element: HTMLElement) => {
  element.getBoundingClientRect = () => ({
    x: 40,
    y: 80,
    width: 120,
    height: 40,
    top: 80,
    left: 40,
    right: 160,
    bottom: 120,
    toJSON: () => ({}),
  });
  element.scrollIntoView = () => {};
};

const pickThisPage = () => {
  fireEvent.click(screen.getByRole('radio', { name: /This page/ }));
};

describe('page guide autoplay', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('uses rtl direction on the chooser for iq culture', async () => {
    render(
      <CultureProvider cultureId="iq">
        <PageGuideOverlay copy={copy} pathname="/iq/portal" onClose={() => {}} />
      </CultureProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('page-guide-chooser').getAttribute('dir')).toBe('rtl');
    });
  });

  it('opens on a centered chooser before walking stops', () => {
    const first = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Alpha', hint: 'First stop hint.', priority: 10 }))
      .forEach(([key, value]) => first.setAttribute(key, value));
    stubRect(first);
    const nav = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Data Studio',
      hint: 'Design models.',
      priority: 86,
      scope: 'chrome',
      topic: 'navigation',
    })).forEach(([key, value]) => nav.setAttribute(key, value));
    stubRect(nav);
    document.body.append(first, nav);

    render(<PageGuideOverlay copy={copy} pathname="/studio" onClose={() => {}} />);
    expect(screen.getByTestId('page-guide-chooser')).toBeTruthy();
    expect(screen.getByText('What should I explain?')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.queryByTestId('page-guide-hotspot')).toBeNull();
    pickThisPage();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Data Studio')).toBeNull();
    expect(screen.getAllByTestId('page-guide-hotspot')).toHaveLength(1);
  });

  it('returns to the chooser from the first stop of a topic', () => {
    const first = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Alpha', hint: 'First stop hint.', priority: 10 }))
      .forEach(([key, value]) => first.setAttribute(key, value));
    stubRect(first);
    document.body.append(first);

    render(<PageGuideOverlay copy={copy} pathname="/studio" onClose={() => {}} />);
    pickThisPage();
    expect(screen.getByText('Alpha')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByTestId('page-guide-chooser')).toBeTruthy();
    expect(screen.getByText('What should I explain?')).toBeTruthy();
  });

  it('advances to the next stop every 8 seconds while playing', () => {
    vi.useFakeTimers();
    const first = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Alpha', hint: 'First stop hint.', priority: 10 }))
      .forEach(([key, value]) => first.setAttribute(key, value));
    stubRect(first);
    const second = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Beta', hint: 'Second stop hint.', priority: 20 }))
      .forEach(([key, value]) => second.setAttribute(key, value));
    stubRect(second);
    document.body.append(first, second);

    render(<PageGuideOverlay copy={copy} pathname="/studio" onClose={() => {}} />);
    pickThisPage();
    expect(screen.getByText('Alpha')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Play tour' }));
    act(() => {
      vi.advanceTimersByTime(PAGE_GUIDE_AUTOPLAY_MS);
    });
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('rings play with a circular countdown while autoplaying', () => {
    const first = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Alpha', hint: 'First stop hint.', priority: 10 }))
      .forEach(([key, value]) => first.setAttribute(key, value));
    stubRect(first);
    const second = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Beta', hint: 'Second stop hint.', priority: 20 }))
      .forEach(([key, value]) => second.setAttribute(key, value));
    stubRect(second);
    document.body.append(first, second);

    render(<PageGuideOverlay copy={copy} pathname="/studio" onClose={() => {}} />);
    pickThisPage();
    expect(screen.queryByTestId('page-guide-play-ring')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play tour' }));
    expect(screen.getByTestId('page-guide-play-ring')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pause tour' }));
    expect(screen.queryByTestId('page-guide-play-ring')).toBeNull();
  });

  it('still renders when a tagged control cannot report its box', () => {
    const broken = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Broken', hint: 'Throws while measuring.', priority: 10 }))
      .forEach(([key, value]) => broken.setAttribute(key, value));
    broken.getBoundingClientRect = () => {
      throw new Error('layout box unavailable');
    };
    document.body.append(broken);

    expect(() => {
      render(<PageGuideOverlay copy={copy} pathname="/studio" onClose={() => {}} />);
    }).not.toThrow();
    expect(screen.getByTestId('page-guide-overlay')).toBeTruthy();
    expect(screen.getByTestId('page-guide-companion')).toBeTruthy();
    expect(screen.getByTestId('page-guide-chooser')).toBeTruthy();
  });

  it('cycles the companion body shape on click', () => {
    render(<PageGuideOverlay copy={copy} pathname="/studio" onClose={() => {}} />);
    const companion = screen.getByTestId('page-guide-companion');
    const stage = () => companion.querySelector('[data-shape]');
    expect(stage()?.getAttribute('data-shape')).toBe('peach');
    fireEvent.click(companion);
    expect(stage()?.getAttribute('data-shape')).toBe('blot');
    fireEvent.click(companion);
    expect(stage()?.getAttribute('data-shape')).toBe('bacteria');
  });

  it('does not cycle shape after a drag', () => {
    render(<PageGuideOverlay copy={copy} pathname="/studio" onClose={() => {}} />);
    const companion = screen.getByTestId('page-guide-companion');
    const stage = () => companion.querySelector('[data-shape]');
    expect(stage()?.getAttribute('data-shape')).toBe('peach');
    fireEvent.pointerDown(companion, { button: 0, clientX: 80, clientY: 80, pointerId: 1 });
    fireEvent.pointerMove(companion, { clientX: 140, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(companion, { clientX: 140, clientY: 150, pointerId: 1 });
    fireEvent.click(companion);
    expect(stage()?.getAttribute('data-shape')).toBe('peach');
  });

  it('does not click through hotspot circles to the tagged control', () => {
    const first = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Alpha', hint: 'First stop hint.', priority: 10 }))
      .forEach(([key, value]) => first.setAttribute(key, value));
    stubRect(first);
    const second = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Beta', hint: 'Second stop hint.', priority: 20 }))
      .forEach(([key, value]) => second.setAttribute(key, value));
    stubRect(second);
    const behind = vi.fn();
    first.addEventListener('click', behind);
    second.addEventListener('click', behind);
    document.body.append(first, second);

    render(<PageGuideOverlay copy={copy} pathname="/studio" onClose={() => {}} />);
    pickThisPage();
    expect(screen.getByText('Alpha')).toBeTruthy();
    const hotspots = screen.getAllByTestId('page-guide-hotspot');
    expect(hotspots[0].querySelectorAll('.page-guide-hotspot-ping')).toHaveLength(3);
    expect(hotspots[1].querySelectorAll('.page-guide-hotspot-ping')).toHaveLength(0);
    const hotspot = hotspots[1];
    fireEvent.pointerDown(hotspot);
    fireEvent.mouseDown(hotspot);
    fireEvent.click(hotspot);
    expect(behind).not.toHaveBeenCalled();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('keeps bubble controls icon-only after a topic is chosen', () => {
    const first = document.createElement('button');
    Object.entries(pageGuideProps({ title: 'Alpha', hint: 'First stop hint.', priority: 10 }))
      .forEach(([key, value]) => first.setAttribute(key, value));
    stubRect(first);
    document.body.append(first);

    render(
      <PageGuideOverlay
        copy={copy}
        pathname="/studio"
        onClose={() => {}}
      />,
    );
    pickThisPage();
    const play = screen.getByRole('button', { name: 'Play tour' });
    const next = screen.getByRole('button', { name: 'Done' });
    const previous = screen.getByRole('button', { name: 'Previous' });
    const close = screen.getByRole('button', { name: 'Close tour guide' });
    for (const button of [play, next, previous, close]) {
      expect(button.textContent?.trim()).toBe('');
      expect(button.querySelector('svg')).toBeTruthy();
    }
    expect(screen.queryByTestId('page-guide-open-chat')).toBeNull();
  });
});
