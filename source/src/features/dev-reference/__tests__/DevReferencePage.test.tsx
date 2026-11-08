/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EnglishOnlyCultureScope } from '../../../core/culture/EnglishOnlyCultureScope';
import { DevReferencePage } from '../DevReferencePage';

vi.mock('../../../shared/api/client', () => ({
  apiPost: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const renderWorkspace = () => render(
  <EnglishOnlyCultureScope>
    <DevReferencePage />
  </EnglishOnlyCultureScope>,
);

describe('DevReferencePage', () => {
  it('renders topic navigation and shows one topic at a time', () => {
    renderWorkspace();

    expect(screen.getByRole('navigation', { name: 'Server utility topics' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run global probe' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run util.regexMatch' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run util.validateSchema' })).toBeNull();
  });

  it('switches topics when a nav item is selected', () => {
    renderWorkspace();

    const nav = screen.getByRole('navigation', { name: 'Server utility topics' });
    fireEvent.click(within(nav).getByRole('button', { name: 'util.regexMatch' }));

    expect(screen.getByRole('button', { name: 'Run util.regexMatch' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run global probe' })).toBeNull();
  });
});
