import { describe, expect, it } from 'vitest';
import {
  computeDashboardDropPreview,
  computeDashboardLiveLayout,
  computeDashboardMasonryPlacements,
  computeDashboardUniformPlacements,
  pinDashboardWidgetLayout,
  resolveDashboardGridStart,
  resolveDashboardMasonryItemStyle,
  resolveDashboardOrderAfterDrop,
  resolveDashboardOrderFromPlacements,
} from '../dashboardMasonryLayout';

describe('dashboardMasonryLayout', () => {
  it('stacks widgets vertically in single-column mode', () => {
    const result = computeDashboardMasonryPlacements(
      ['health', 'feedback'],
      { health: 120, feedback: 80 },
      12,
      false,
    );

    expect(result.placements).toEqual([
      { id: 'health', start: 0, span: 1, top: 0 },
      { id: 'feedback', start: 0, span: 1, top: 132 },
    ]);
    expect(result.totalHeight).toBe(212);
  });

  it('uses a stored span when the operator resized the tile', () => {
    const result = computeDashboardMasonryPlacements(
      ['health', 'quick-actions'],
      { health: 200, 'quick-actions': 80 },
      12,
      true,
      { health: { span: 8 }, 'quick-actions': { span: 4 } },
    );

    expect(result.placements).toEqual([
      { id: 'health', start: 0, span: 8, top: 0 },
      { id: 'quick-actions', start: 8, span: 4, top: 0 },
    ]);
  });

  it('places a half-width tile beside another half-width tile', () => {
    const result = computeDashboardMasonryPlacements(
      ['health', 'quick-actions', 'module:chip'],
      { health: 200, 'quick-actions': 80, 'module:chip': 100 },
      12,
      true,
      { 'module:chip': { span: 3 } },
    );

    expect(result.placements).toEqual([
      { id: 'health', start: 0, span: 6, top: 0 },
      { id: 'quick-actions', start: 6, span: 6, top: 0 },
      { id: 'module:chip', start: 6, span: 3, top: 92 },
    ]);
  });

  it('sits a half-width tile beside a narrow tile, then another half-width tile below', () => {
    const result = computeDashboardMasonryPlacements(
      ['insights', 'module:chip', 'my-inbox'],
      { insights: 200, 'module:chip': 80, 'my-inbox': 120 },
      12,
      true,
      { 'module:chip': { span: 3 } },
    );

    expect(result.placements).toEqual([
      { id: 'insights', start: 0, span: 6, top: 0 },
      { id: 'module:chip', start: 6, span: 3, top: 0 },
      { id: 'my-inbox', start: 6, span: 6, top: 92 },
    ]);
    expect(result.totalHeight).toBe(212);
  });

  it('honors a stored Uniform column start and still slides up into the hole', () => {
    const result = computeDashboardUniformPlacements(
      ['quick-actions', 'health', 'my-links'],
      { 'quick-actions': 80, health: 240, 'my-links': 100 },
      16,
      true,
      {
        'quick-actions': { span: 3, start: 0 },
        health: { span: 4, start: 8 },
        'my-links': { span: 3, start: 0 },
      },
    );

    expect(result.placements).toEqual([
      { id: 'quick-actions', start: 0, span: 3, top: 0 },
      { id: 'health', start: 8, span: 4, top: 0 },
      { id: 'my-links', start: 0, span: 3, top: 96 },
    ]);
  });

  it('slides a Uniform tile up under Feedback when the hole is wide enough', () => {
    const result = computeDashboardUniformPlacements(
      ['feedback', 'health', 'my-inbox'],
      { feedback: 80, health: 240, 'my-inbox': 120 },
      16,
      true,
      {
        feedback: { span: 6, start: 0 },
        health: { span: 6, start: 6 },
        'my-inbox': { span: 6, start: 0 },
      },
    );

    expect(result.placements).toEqual([
      { id: 'feedback', start: 0, span: 6, top: 0 },
      { id: 'health', start: 6, span: 6, top: 0 },
      { id: 'my-inbox', start: 0, span: 6, top: 96 },
    ]);
  });

  it('fills the Uniform hole under a short tile the way GridStack gravity does', () => {
    const result = computeDashboardUniformPlacements(
      ['quick-actions', 'health', 'my-links'],
      { 'quick-actions': 80, health: 240, 'my-links': 100 },
      16,
      true,
    );

    expect(result.placements).toEqual([
      { id: 'quick-actions', start: 0, span: 6, top: 0 },
      { id: 'health', start: 6, span: 6, top: 0 },
      { id: 'my-links', start: 0, span: 6, top: 96 },
    ]);
    expect(result.totalHeight).toBe(240);
  });

  it('fills the hole under a short tile instead of starting a new row', () => {
    const result = computeDashboardMasonryPlacements(
      ['quick-actions', 'health', 'my-links'],
      { 'quick-actions': 80, health: 240, 'my-links': 100 },
      16,
      true,
    );

    expect(result.placements).toEqual([
      { id: 'quick-actions', start: 0, span: 6, top: 0 },
      { id: 'health', start: 6, span: 6, top: 0 },
      { id: 'my-links', start: 0, span: 6, top: 96 },
    ]);
  });

  it('honors a stored column start instead of first-fit', () => {
    const result = computeDashboardMasonryPlacements(
      ['health', 'quick-actions'],
      { health: 200, 'quick-actions': 80 },
      12,
      true,
      { health: { span: 6, start: 6 }, 'quick-actions': { span: 6, start: 0 } },
    );

    expect(result.placements).toEqual([
      { id: 'health', start: 6, span: 6, top: 0 },
      { id: 'quick-actions', start: 0, span: 6, top: 0 },
    ]);
  });

  it('previews a drop in the hole left by the dragged tile', () => {
    expect(computeDashboardDropPreview(
      ['quick-actions', 'health', 'my-links'],
      { 'quick-actions': 80, health: 240, 'my-links': 100 },
      16,
      true,
      undefined,
      'my-links',
      0,
      6,
    )).toEqual({
      id: 'my-links',
      start: 0,
      span: 6,
      top: 96,
    });
  });

  it('snaps an overlay to a 12-column track', () => {
    expect(resolveDashboardGridStart(
      { left: 608, width: 400 },
      { left: 0, width: 1200 },
      6,
    )).toBe(6);
    expect(resolveDashboardGridStart(
      { left: 0, width: 400 },
      { left: 0, width: 1200 },
      6,
    )).toBe(0);
  });

  it('keeps the current column until the overlay crosses the hysteresis band', () => {
    expect(resolveDashboardGridStart(
      { left: 560, width: 400 },
      { left: 0, width: 1200 },
      6,
      false,
      16,
      12,
      5,
    )).toBe(5);
  });

  it('snaps one column farther when drop ignores the preview hysteresis', () => {
    expect(resolveDashboardGridStart(
      { left: 560, width: 400 },
      { left: 0, width: 1200 },
      6,
    )).toBe(6);
  });

  it('stores the displayed start and span so a drop can be recalled', () => {
    expect(pinDashboardWidgetLayout(
      { health: { span: 6 } },
      [
        { id: 'health', start: 3, span: 6, top: 0 },
        { id: 'feedback', start: 9, span: 3, top: 0 },
      ],
    )).toEqual({
      health: { span: 6, start: 3 },
      feedback: { span: 3, start: 9 },
    });
  });

  it('orders widgets by the displayed cells', () => {
    expect(resolveDashboardOrderFromPlacements(
      [
        { id: 'health', start: 6, span: 6, top: 0 },
        { id: 'quick-actions', start: 0, span: 6, top: 0 },
        { id: 'my-links', start: 0, span: 6, top: 200 },
      ],
      ['health', 'quick-actions', 'my-links'],
    )).toEqual(['quick-actions', 'health', 'my-links']);
  });

  it('pins the drop cell instead of re-banding from the left', () => {
    const committed = computeDashboardMasonryPlacements(
      ['quick-actions', 'health'],
      { 'quick-actions': 80, health: 240 },
      16,
      true,
    );
    const live = computeDashboardLiveLayout(
      ['quick-actions', 'health'],
      committed.placements,
      { 'quick-actions': 80, health: 240 },
      16,
      true,
      undefined,
      'health',
      3,
      0,
    );

    expect(live.placements).toEqual([
      { id: 'quick-actions', start: 0, span: 6, top: 0 },
      { id: 'health', start: 3, span: 6, top: 96 },
    ]);
  });

  it('reflows neighbors around the live drop cell', () => {
    const committed = computeDashboardMasonryPlacements(
      ['quick-actions', 'health', 'my-links'],
      { 'quick-actions': 80, health: 240, 'my-links': 100 },
      16,
      true,
    );
    const live = computeDashboardLiveLayout(
      ['quick-actions', 'health', 'my-links'],
      committed.placements,
      { 'quick-actions': 80, health: 240, 'my-links': 100 },
      16,
      true,
      undefined,
      'my-links',
      6,
      80,
    );

    expect(live.placements).toEqual([
      { id: 'quick-actions', start: 0, span: 6, top: 0 },
      { id: 'health', start: 6, span: 6, top: 0 },
      { id: 'my-links', start: 6, span: 6, top: 256 },
    ]);
  });

  it('reorders by the drop cell, not list adjacency', () => {
    expect(resolveDashboardOrderAfterDrop(
      ['health', 'quick-actions', 'my-links'],
      [
        { id: 'health', start: 6, span: 6, top: 0 },
        { id: 'quick-actions', start: 0, span: 6, top: 0 },
        { id: 'my-links', start: 0, span: 6, top: 200 },
      ],
      'health',
      0,
      90,
    )).toEqual(['quick-actions', 'health', 'my-links']);
  });

  it('resolves packed item geometry for mixed spans', () => {
    expect(resolveDashboardMasonryItemStyle(0, 6, 24, 12)).toEqual({
      top: 24,
      insetInlineStart: 'calc(0 * ((100% - 132px) / 12 + 12px))',
      width: 'calc(6 * (100% - 132px) / 12 + 60px)',
    });
    expect(resolveDashboardMasonryItemStyle(6, 6, 40, 12)).toEqual({
      top: 40,
      insetInlineStart: 'calc(6 * ((100% - 132px) / 12 + 12px))',
      width: 'calc(6 * (100% - 132px) / 12 + 60px)',
    });
  });
});
