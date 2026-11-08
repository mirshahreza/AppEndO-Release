import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_BADGE_CLASS,
  DASHBOARD_CAPTION_ACTION_CLASS,
  DASHBOARD_CAPTION_ACTION_LABEL_CLASS,
  DASHBOARD_EMPTY_STATE_CLASS,
  DASHBOARD_HEADER_ACTIONS_CLASS,
  DASHBOARD_HEADER_CHIP_CLASS,
  DASHBOARD_KPI_GRID_CLASS,
  DASHBOARD_KPI_PAD_CLASS,
  DASHBOARD_KPI_VALUE_CLASS,
  DASHBOARD_QUICK_ACTION_CARD_CLASS,
  dashboardFitCaptionGridClass,
  dashboardMyLinksGridClass,
  dashboardQuickActionGridClass,
} from '../dashboardDensity';
import { DASHBOARD_HEALTH_STATUS_BADGE_CLASS } from '../dashboardWidgetSemantics';

describe('dashboard density tokens', () => {
  it('keeps header actions spaced and KPI values prominent', () => {
    expect(DASHBOARD_HEADER_ACTIONS_CLASS).toContain('h-8');
    expect(DASHBOARD_HEADER_ACTIONS_CLASS).toContain('gap-2');
    expect(DASHBOARD_HEADER_ACTIONS_CLASS).toContain('items-center');
    expect(DASHBOARD_HEADER_CHIP_CLASS).toContain('h-8');
    expect(DASHBOARD_KPI_VALUE_CLASS).toContain('text-2xl');
    expect(DASHBOARD_KPI_VALUE_CLASS).toContain('font-bold');
    expect(DASHBOARD_KPI_PAD_CLASS).toContain('py-2');
    expect(DASHBOARD_KPI_PAD_CLASS).toContain('gap-1');
    expect(DASHBOARD_KPI_GRID_CLASS).toContain('grid-cols-12');
    expect(DASHBOARD_KPI_GRID_CLASS).not.toContain('lg:grid-cols-12');
  });

  it('gives quick-action tiles padding, border, and raised shadow', () => {
    expect(DASHBOARD_QUICK_ACTION_CARD_CLASS).toContain('p-3');
    expect(DASHBOARD_QUICK_ACTION_CARD_CLASS).toContain('h-full');
    expect(DASHBOARD_QUICK_ACTION_CARD_CLASS).toContain('border-slate-200');
    expect(DASHBOARD_QUICK_ACTION_CARD_CLASS).toContain('shadow-sm');
  });

  it('centers empty-state copy in a consistent minimum height', () => {
    expect(DASHBOARD_EMPTY_STATE_CLASS).toContain('text-center');
    expect(DASHBOARD_EMPTY_STATE_CLASS).toContain('items-center');
    expect(DASHBOARD_EMPTY_STATE_CLASS).toContain('min-h-[4.5rem]');
  });

  it('uses AA-safe status badge ink on tinted fills', () => {
    expect(DASHBOARD_BADGE_CLASS).toContain('text-xs');
    expect(DASHBOARD_HEALTH_STATUS_BADGE_CLASS.ok).toContain('text-emerald-950');
    expect(DASHBOARD_HEALTH_STATUS_BADGE_CLASS.warn).toContain('text-amber-950');
    expect(DASHBOARD_HEALTH_STATUS_BADGE_CLASS.error).toContain('text-rose-950');
    expect(DASHBOARD_HEALTH_STATUS_BADGE_CLASS.neutral).toContain('text-slate-900');
  });

  it('stacks three or fewer quick actions so the grid has no empty slot', () => {
    expect(dashboardQuickActionGridClass(3)).toContain('grid-cols-1');
    expect(dashboardQuickActionGridClass(3)).not.toContain('sm:grid-cols-2');
    expect(dashboardQuickActionGridClass(4)).toContain('sm:grid-cols-2');
  });

  it('keeps personal links on at most two columns', () => {
    expect(dashboardMyLinksGridClass(2)).toContain('grid-cols-1');
    expect(dashboardMyLinksGridClass(2)).not.toContain('sm:grid-cols-2');
    expect(dashboardMyLinksGridClass(5)).toContain('sm:grid-cols-2');
    expect(dashboardMyLinksGridClass(5)).not.toContain('xl:grid-cols-3');
  });

  it('lays caption links in a tight icon strip without nested tile chrome', () => {
    expect(dashboardFitCaptionGridClass(6)).toBe('grid grid-cols-6 gap-1');
    expect(dashboardFitCaptionGridClass(4)).toContain('gap-1');
    expect(dashboardFitCaptionGridClass(4)).not.toContain('gap-4');
    expect(DASHBOARD_CAPTION_ACTION_CLASS).toContain('border');
    expect(DASHBOARD_CAPTION_ACTION_CLASS).not.toContain('aspect-square');
    expect(DASHBOARD_CAPTION_ACTION_LABEL_CLASS).toContain('line-clamp-2');
    expect(DASHBOARD_CAPTION_ACTION_LABEL_CLASS).toContain('w-full');
    expect(DASHBOARD_CAPTION_ACTION_LABEL_CLASS).toContain('text-slate-600');
  });
});
