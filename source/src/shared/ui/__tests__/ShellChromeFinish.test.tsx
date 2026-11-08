// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ShellChromeFinish } from '../ShellChromeFinish';

describe('ShellChromeFinish', () => {
  it('renders sidebar frost and menu texture layers', () => {
    const { container } = render(<ShellChromeFinish surface="sidebar" />);
    expect(container.querySelector('.admin-shell-chrome-finish')).toBeTruthy();
    expect(container.querySelector('.admin-shell-chrome-fill--sidebar')).toBeTruthy();
    expect(container.querySelector('.menu-line-pattern')).toBeTruthy();
    expect(container.querySelector('.header-line-pattern')).toBeNull();
  });

  it('renders header frost and header texture layers', () => {
    const { container } = render(<ShellChromeFinish surface="header" />);
    expect(container.querySelector('.admin-shell-chrome-fill--header')).toBeTruthy();
    expect(container.querySelector('.header-line-pattern')).toBeTruthy();
    expect(container.querySelector('.menu-line-pattern')).toBeNull();
  });
});
