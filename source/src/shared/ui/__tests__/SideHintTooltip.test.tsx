/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSideHintContent,
  HeaderHintTooltip,
  resolveHeaderHintFallbackTone,
  resolveOppositeSidebarTooltipPlacement,
  resolveSideHintTitleTone,
  SIDE_HINT_TOOLTIP_SHOW_DELAY_MS,
  SideHintTooltip,
} from '../SideHintTooltip';

vi.mock('../UiTooltip', () => ({
  UiTooltip: ({
    children,
    content,
    placement,
    shouldFlip,
    delay,
  }: {
    children: React.ReactNode;
    content: React.ReactNode;
    placement?: string;
    shouldFlip?: boolean;
    delay?: number;
  }) => (
    <div
      data-testid="side-hint"
      data-placement={placement}
      data-should-flip={String(shouldFlip)}
      data-delay={delay == null ? '' : String(delay)}
    >
      <div data-testid="side-hint-content">{content}</div>
      {children}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  document.documentElement.dir = 'ltr';
});

describe('resolveOppositeSidebarTooltipPlacement', () => {
  it('opens to the right in LTR and to the left in RTL', () => {
    expect(resolveOppositeSidebarTooltipPlacement(false)).toBe('right');
    expect(resolveOppositeSidebarTooltipPlacement(true)).toBe('left');

    document.documentElement.dir = 'ltr';
    expect(resolveOppositeSidebarTooltipPlacement()).toBe('right');
    document.documentElement.dir = 'rtl';
    expect(resolveOppositeSidebarTooltipPlacement()).toBe('left');
  });
});

describe('resolveSideHintTitleTone', () => {
  it('maps icon color classes and hue names, skipping slate', () => {
    expect(resolveSideHintTitleTone('text-emerald-500')).toBe('emerald');
    expect(resolveSideHintTitleTone('indigo')).toBe('indigo');
    expect(resolveSideHintTitleTone('text-slate-400', 'cyan')).toBe('cyan');
    expect(resolveSideHintTitleTone('text-primary-700', 'violet')).toBe('violet');
  });
});

describe('resolveHeaderHintFallbackTone', () => {
  it('cycles meaning-first hues so neighboring header items stay distinct', () => {
    expect(resolveHeaderHintFallbackTone(0)).toBe('cyan');
    expect(resolveHeaderHintFallbackTone(2)).toBe('violet');
    expect(resolveHeaderHintFallbackTone(6)).toBe('cyan');
  });
});

describe('buildSideHintContent', () => {
  it('returns null when both title and description are empty', () => {
    expect(buildSideHintContent('', '')).toBeNull();
  });

  it('renders a bold hue title even when there is no distinct description', () => {
    render(<div>{buildSideHintContent('Dashboard')}</div>);
    const title = screen.getByText('Dashboard');
    expect(title.className).toContain('font-bold');
    expect(title.className).toContain('text-cyan-300');
  });

  it('renders a bold colored title above the description', () => {
    render(<div>{buildSideHintContent('Users', 'Manage accounts.', 'emerald')}</div>);
    const title = screen.getByText('Users');
    expect(title.className).toContain('font-bold');
    expect(title.className).toContain('text-emerald-300');
    expect(screen.getByText('Manage accounts.')).toBeTruthy();
  });
});

describe('SideHintTooltip', () => {
  it('renders children without a tooltip when content is empty', () => {
    render(
      <SideHintTooltip content={null}>
        <button type="button">Users</button>
      </SideHintTooltip>,
    );
    expect(screen.queryByTestId('side-hint')).toBeNull();
    expect(screen.getByRole('button', { name: 'Users' })).toBeTruthy();
  });

  it('uses the shared hover delay unless overridden', () => {
    const { rerender } = render(
      <SideHintTooltip content="Users">
        <button type="button">Users</button>
      </SideHintTooltip>,
    );
    expect(screen.getByTestId('side-hint').getAttribute('data-delay')).toBe(
      String(SIDE_HINT_TOOLTIP_SHOW_DELAY_MS),
    );

    rerender(
      <SideHintTooltip content="Users" delay={0}>
        <button type="button">Users</button>
      </SideHintTooltip>,
    );
    expect(screen.getByTestId('side-hint').getAttribute('data-delay')).toBe('0');
  });

  it('places the pretty hint on the opposite sidebar side and does not flip', () => {
    const { rerender } = render(
      <SideHintTooltip content="Users" isRtl={false}>
        <button type="button">Users</button>
      </SideHintTooltip>,
    );
    expect(screen.getByTestId('side-hint').getAttribute('data-placement')).toBe('right');
    expect(screen.getByTestId('side-hint').getAttribute('data-should-flip')).toBe('false');
    expect(screen.getByTestId('side-hint-content').textContent).toBe('Users');

    rerender(
      <SideHintTooltip content="Users" isRtl>
        <button type="button">Users</button>
      </SideHintTooltip>,
    );
    expect(screen.getByTestId('side-hint').getAttribute('data-placement')).toBe('left');
  });

  it('honors an explicit placement override', () => {
    render(
      <SideHintTooltip content="Home" placement="top" isRtl={false}>
        <button type="button">Home</button>
      </SideHintTooltip>,
    );
    expect(screen.getByTestId('side-hint').getAttribute('data-placement')).toBe('top');
    expect(screen.getByTestId('side-hint').getAttribute('data-should-flip')).toBe('false');
  });
});

describe('HeaderHintTooltip', () => {
  it('opens below the control with a bold hue title', () => {
    render(
      <HeaderHintTooltip title="Send feedback" hint="Send a note about this page." tone="cyan">
        <button type="button">Feedback</button>
      </HeaderHintTooltip>,
    );
    expect(screen.getByTestId('side-hint').getAttribute('data-placement')).toBe('bottom');
    expect(screen.getByText('Send feedback').className).toContain('font-bold');
    expect(screen.getByText('Send feedback').className).toContain('text-cyan-300');
    expect(screen.getByText('Send a note about this page.')).toBeTruthy();
  });
});
