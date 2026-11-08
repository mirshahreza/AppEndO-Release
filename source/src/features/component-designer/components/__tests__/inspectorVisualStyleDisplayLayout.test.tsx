// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InspectorVisualStylePanel } from '../InspectorVisualStylePanel';

afterEach(() => {
  cleanup();
});

const openDisplayAndChoose = (optionLabel: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Display' }));
  fireEvent.click(screen.getByRole('button', { name: optionLabel }));
};

describe('InspectorVisualStylePanel display-aware layout controls', () => {
  it('hides flex/grid subcontrols until Display is Flex or Grid', () => {
    render(
      <InspectorVisualStylePanel
        className="min-h-6"
        breakpoint=""
        showContainerLayout
        onBreakpointChange={() => undefined}
        onClassNameChange={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Display' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Flex layout' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Grid columns' })).toBeNull();
    expect(screen.queryByLabelText('Top start')).toBeNull();
  });

  it('shows flex controls and co-writes flex when Direction is set', () => {
    const onClassNameChange = vi.fn();
    render(
      <InspectorVisualStylePanel
        className="min-h-6 flex"
        breakpoint=""
        showContainerLayout
        onBreakpointChange={() => undefined}
        onClassNameChange={onClassNameChange}
      />,
    );

    expect(screen.getByRole('group', { name: 'Flex layout' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Flex column' }));

    expect(onClassNameChange).toHaveBeenCalled();
    const next = String(onClassNameChange.mock.calls.at(-1)?.[0] ?? '');
    expect(next.split(/\s+/)).toEqual(expect.arrayContaining(['flex', 'flex-col']));
  });

  it('injects flex when aligning on a container that only has inferred flex utilities', () => {
    const onClassNameChange = vi.fn();
    render(
      <InspectorVisualStylePanel
        className="flex-row gap-2"
        breakpoint=""
        showContainerLayout
        onBreakpointChange={() => undefined}
        onClassNameChange={onClassNameChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Center' }));

    const next = String(onClassNameChange.mock.calls.at(-1)?.[0] ?? '');
    expect(next.split(/\s+/)).toEqual(
      expect.arrayContaining(['flex', 'flex-row', 'justify-center', 'items-center']),
    );
  });

  it('shows grid columns for grid display and writes grid-cols', () => {
    const onClassNameChange = vi.fn();
    render(
      <InspectorVisualStylePanel
        className="grid gap-4"
        breakpoint=""
        showContainerLayout
        onBreakpointChange={() => undefined}
        onClassNameChange={onClassNameChange}
      />,
    );

    expect(screen.getByRole('group', { name: 'Grid columns' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Flex layout' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '3 columns' }));

    const next = String(onClassNameChange.mock.calls.at(-1)?.[0] ?? '');
    expect(next.split(/\s+/)).toEqual(expect.arrayContaining(['grid', 'grid-cols-3']));
  });

  it('switching Display from flex to block strips flex-direction and wrap', () => {
    const onClassNameChange = vi.fn();
    render(
      <InspectorVisualStylePanel
        className="flex flex-col flex-wrap gap-2"
        breakpoint=""
        showContainerLayout
        onBreakpointChange={() => undefined}
        onClassNameChange={onClassNameChange}
      />,
    );

    openDisplayAndChoose('Block');

    const next = String(onClassNameChange.mock.calls.at(-1)?.[0] ?? '');
    const tokens = next.split(/\s+/).filter(Boolean);
    expect(tokens).toContain('block');
    expect(tokens).not.toContain('flex');
    expect(tokens).not.toContain('flex-col');
    expect(tokens).not.toContain('flex-wrap');
    expect(tokens).toContain('gap-2');
  });

  it('setting Display to Flex reveals layout controls', () => {
    const onClassNameChange = vi.fn();
    const { rerender } = render(
      <InspectorVisualStylePanel
        className="min-h-6"
        breakpoint=""
        showContainerLayout
        onBreakpointChange={() => undefined}
        onClassNameChange={onClassNameChange}
      />,
    );

    openDisplayAndChoose('Flex');
    const next = String(onClassNameChange.mock.calls.at(-1)?.[0] ?? '');
    expect(next.split(/\s+/)).toContain('flex');

    rerender(
      <InspectorVisualStylePanel
        className={next}
        breakpoint=""
        showContainerLayout
        onBreakpointChange={() => undefined}
        onClassNameChange={onClassNameChange}
      />,
    );

    expect(screen.getByRole('group', { name: 'Flex layout' })).toBeTruthy();
    expect(screen.getByLabelText('Center')).toBeTruthy();
  });
});
