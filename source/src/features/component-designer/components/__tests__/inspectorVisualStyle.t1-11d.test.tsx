// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InspectorVisualStylePanel } from '../InspectorVisualStylePanel';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('dir');
});

describe('T1-11d Align icons RTL mirror', () => {
  it('mirrors left/right Align icons when the document is rtl', () => {
    document.documentElement.setAttribute('dir', 'rtl');

    render(
      <InspectorVisualStylePanel
        className=""
        breakpoint=""
        onBreakpointChange={() => undefined}
        onClassNameChange={() => undefined}
      />,
    );

    const left = screen.getByTitle('Align left');
    const right = screen.getByTitle('Align right');
    const center = screen.getByTitle('Align center');

    expect(left.getAttribute('data-align-mirrored')).toBe('true');
    expect(right.getAttribute('data-align-mirrored')).toBe('true');
    expect(center.getAttribute('data-align-mirrored')).toBeNull();
    expect(left.closest('[data-align-rtl="true"]')).toBeTruthy();
  });

  it('does not mirror Align icons when the document is ltr', () => {
    document.documentElement.setAttribute('dir', 'ltr');

    render(
      <InspectorVisualStylePanel
        className=""
        breakpoint=""
        onBreakpointChange={() => undefined}
        onClassNameChange={() => undefined}
      />,
    );

    expect(screen.getByTitle('Align left').getAttribute('data-align-mirrored')).toBeNull();
    expect(screen.getByTitle('Align right').getAttribute('data-align-mirrored')).toBeNull();
  });

  it('renders Breakpoint switcher at the top of the visual Style panel', () => {
    render(
      <InspectorVisualStylePanel
        className=""
        breakpoint="md:"
        onBreakpointChange={() => undefined}
        onClassNameChange={() => undefined}
      />,
    );

    expect(screen.getByRole('group', { name: 'Style breakpoint' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tablet' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeTruthy();
    expect(screen.getByText('Typography')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
  });
});
