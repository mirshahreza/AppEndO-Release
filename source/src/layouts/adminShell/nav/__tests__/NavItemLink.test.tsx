// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavItemLink } from '../NavItemLink';

describe('NavItemLink', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a standard anchor with href', () => {
    render(
      <NavItemLink path="/studio/users" onNavigate={vi.fn()}>
        Users
      </NavItemLink>,
    );

    const link = screen.getByRole('link', { name: 'Users' });
    expect(link.getAttribute('href')).toBe('/studio/users');
  });

  it('keeps the item path as href when extra attributes are spread', () => {
    render(
      <NavItemLink path="/studio/settings" onNavigate={vi.fn()} {...{ href: 'users' }}>
        Settings
      </NavItemLink>,
    );

    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/studio/settings');
  });

  it('client-routes on primary click', () => {
    const onNavigate = vi.fn();
    render(
      <NavItemLink path="/studio/users" onNavigate={onNavigate}>
        Users
      </NavItemLink>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Users' }));
    expect(onNavigate).toHaveBeenCalledWith('/studio/users');
  });
});
