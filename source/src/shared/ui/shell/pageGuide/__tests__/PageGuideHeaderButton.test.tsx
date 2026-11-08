/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageGuideHeaderButton } from '../PageGuideHeaderButton';
import { isPageGuideActive, resetPageGuideStoreForTests } from '../pageGuideStore';

vi.mock('../../../../../core/culture/CultureContext', () => ({
  useOptionalCultureT: () => (key: string) => (
    key === 'pageGuide.tourGuide' ? 'Tour guide'
      : key === 'pageGuide.tourGuide.hint' ? 'Walks the titled controls on this page.'
        : key
  ),
}));

const viewportState = vi.hoisted(() => ({
  tier: 'desktop' as 'phone' | 'tablet' | 'desktop' | 'wide',
}));

vi.mock('../../../../lib/useViewportTier', () => ({
  useViewportTier: () => viewportState.tier,
}));

vi.mock('../../../UiTooltip', () => ({
  UiTooltip: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(() => {
  viewportState.tier = 'desktop';
  resetPageGuideStoreForTests();
  cleanup();
});

describe('PageGuideHeaderButton', () => {
  it('toggles the tour guide from the header control', () => {
    render(<PageGuideHeaderButton />);
    const trigger = screen.getByRole('button', { name: 'Tour guide' });
    expect(trigger.getAttribute('data-testid')).toBe('page-guide-trigger');
    expect(isPageGuideActive()).toBe(false);
    fireEvent.click(trigger);
    expect(isPageGuideActive()).toBe(true);
    fireEvent.click(trigger);
    expect(isPageGuideActive()).toBe(false);
  });

  it('hides on phone and stays on tablet', () => {
    viewportState.tier = 'phone';
    const { rerender } = render(<PageGuideHeaderButton />);
    expect(screen.queryByTestId('page-guide-trigger')).toBeNull();

    viewportState.tier = 'tablet';
    rerender(<PageGuideHeaderButton />);
    expect(screen.getByTestId('page-guide-trigger')).toBeTruthy();
  });
});
