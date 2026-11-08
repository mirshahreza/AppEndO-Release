// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ShellHeaderTitle, resolveShellHeaderCompactTitle } from '../ShellHeaderTitle';

afterEach(() => {
  cleanup();
});

describe('ShellHeaderTitle', () => {
  it('styles group, separator, and active page differently', () => {
    const { container } = render(
      <ShellHeaderTitle
        groupLabel="Ops"
        pageLabel="Settings"
        fallbackLabel="Dashboard"
      />,
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.getAttribute('title')).toBe('Ops / Settings');
    expect(heading.textContent).toBe('Ops/Settings');

    const spans = container.querySelectorAll('h1 > span');
    expect(spans.length).toBe(3);
    expect(spans[0]?.textContent).toBe('Ops');
    expect(spans[0]?.className).toContain('text-slate-500');
    expect(spans[0]?.className).toContain('lg:inline');
    expect(spans[1]?.textContent).toBe('/');
    expect(spans[1]?.className).toContain('text-slate-500');
    expect(spans[1]?.className).toContain('lg:inline');
    expect(spans[2]?.textContent).toBe('Settings');
    expect(spans[2]?.className).toContain('text-slate-800');
  });

  it('renders a single active label when no group is provided', () => {
    const { container } = render(
      <ShellHeaderTitle
        pageLabel="Dashboard"
        fallbackLabel="Portal"
      />,
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Dashboard');
    expect(heading.className).toContain('text-slate-800');
    expect(container.querySelectorAll('h1 > span').length).toBe(0);
  });

  it('renders a list-only nested editor title trail', () => {
    const { container } = render(
      <ShellHeaderTitle
        titleTrail={['Workflows']}
        fallbackLabel="Portal"
      />,
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.getAttribute('title')).toBe('Workflows');
    expect(heading.textContent).toBe('Workflows');

    const spans = container.querySelectorAll('h1 > span');
    expect(spans[0]?.textContent).toBe('Workflows');
    expect(spans[0]?.className).toContain('text-slate-800');
    expect(spans[0]?.className).toContain('truncate');
    expect(spans[0]?.className).toContain('flex-1');
    expect(heading.getAttribute('dir')).toBe('auto');
    expect(heading.className).toContain('flex');
  });

  it('prepends nav group to nested editor title trail', () => {
    const { container } = render(
      <ShellHeaderTitle
        groupLabel="Ops"
        titleTrail={['Workflows', 'Edit']}
        fallbackLabel="Portal"
      />,
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.getAttribute('title')).toBe('Ops / Workflows / Edit');
    expect(heading.textContent).toBe('Ops/Workflows/Edit');

    const spans = container.querySelectorAll('h1 > span');
    expect(spans[0]?.textContent).toBe('Ops');
    expect(spans[0]?.className).toContain('lg:inline');
    expect(spans[2]?.textContent).toBe('Workflows');
    expect(spans[2]?.className).toContain('lg:inline');
    expect(spans[4]?.textContent).toBe('Edit');
    expect(spans[4]?.className).toContain('text-slate-800');
  });
});

describe('resolveShellHeaderCompactTitle', () => {
  it('uses the last trail segment on nested editors', () => {
    expect(resolveShellHeaderCompactTitle({
      groupLabel: 'Development',
      pageLabel: 'Client Components',
      titleTrail: ['Client Components', 'Edit'],
      fallbackLabel: 'Dashboard',
    })).toBe('Edit');
  });

  it('falls back to the page label', () => {
    expect(resolveShellHeaderCompactTitle({
      pageLabel: 'Users',
      fallbackLabel: 'Dashboard',
    })).toBe('Users');
  });
});
