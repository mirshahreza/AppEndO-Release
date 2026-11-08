import { describe, expect, it } from 'vitest';
import {
  buildDefaultDashboardWidgetOrder,
} from '../../../features/dashboard/dashboardLayout';
import {
  isDashboardLayoutBlockId,
  isDashboardLayoutFullWidthBlock,
  filterDashboardWidgetOrderForDisplay,
  mergeDashboardWidgetOrder,
  normalizeDashboardLayoutPayload,
  parseDashboardLayout,
  resolveVisibleDashboardWidgets,
  stripDashboardWidgetStarts,
} from '../userDashboardLayout';

describe('userDashboardLayout', () => {
  const defaultAdminOrder = buildDefaultDashboardWidgetOrder({
    isAdmin: true,
    feedbackEnabled: true,
  });

  it('returns null for invalid stored values', () => {
    expect(parseDashboardLayout(null)).toBeNull();
    expect(parseDashboardLayout('bad')).toBeNull();
    expect(parseDashboardLayout([])).toBeNull();
    expect(parseDashboardLayout({ layoutMode: 'grid' })).toBeNull();
  });

  it('recalls a stored layout even when layoutMode was omitted', () => {
    expect(parseDashboardLayout({
      widgetOrder: ['kpi', 'feedback'],
      widgetSizes: { kpi: { span: 8, start: 0 } },
      homeShortcuts: [{ kind: 'nav', pageKey: 'cms', path: '/studio/cms', label: 'CMS' }],
    })).toEqual({
      layoutMode: 'masonry',
      widgetOrder: ['kpi', 'feedback'],
      hiddenWidgets: [],
      widgetSizes: { kpi: { span: 8, start: 0 } },
      widgetChrome: {},
      homeShortcuts: [{
        id: 'nav:cms',
        kind: 'nav',
        pageKey: 'cms',
        path: '/studio/cms',
        label: 'CMS',
      }],
    });
  });

  it('parses valid layout preferences and keeps dynamic widget ids', () => {
    expect(parseDashboardLayout({
      layoutMode: 'masonry',
      widgetOrder: ['kpi', 'unknown', 'feedback', 'module:users'],
    })).toEqual({
      layoutMode: 'masonry',
      widgetOrder: ['kpi', 'feedback', 'module:users'],
      hiddenWidgets: [],
      widgetSizes: {},
      widgetChrome: {},
      homeShortcuts: [],
    });
  });

  it('parses widget sizes and drops invalid spans', () => {
    expect(parseDashboardLayout({
      layoutMode: 'masonry',
      widgetOrder: ['kpi'],
      widgetSizes: {
        kpi: { span: 8, start: 2, height: 240 },
        unknown: { span: 6 },
        feedback: { span: 2, height: 20 },
        health: { start: 10, span: 6 },
      },
    })).toEqual({
      layoutMode: 'masonry',
      widgetOrder: ['kpi'],
      hiddenWidgets: [],
      widgetSizes: {
        kpi: { span: 8, start: 2, height: 240 },
        health: { span: 6, start: 6 },
      },
      widgetChrome: {},
      homeShortcuts: [],
    });
  });

  it('parses home shortcuts and ignores unsafe entries', () => {
    expect(parseDashboardLayout({
      layoutMode: 'masonry',
      widgetOrder: ['my-shortcuts'],
      homeShortcuts: [
        { kind: 'nav', pageKey: 'data-studio', path: '/studio/data-studio', label: 'Data Studio' },
        { kind: 'custom', path: 'javascript:alert(1)', label: 'Bad' },
        { kind: 'nav', pageKey: 'dashboard', path: '/studio', label: 'Home' },
      ],
    })).toEqual({
      layoutMode: 'masonry',
      widgetOrder: ['my-shortcuts'],
      hiddenWidgets: [],
      widgetSizes: {},
      widgetChrome: {},
      homeShortcuts: [{
        id: 'nav:data-studio',
        kind: 'nav',
        pageKey: 'data-studio',
        path: '/studio/data-studio',
        label: 'Data Studio',
      }],
    });
  });

  it('parses widget chrome and drops unknown accents', () => {
    expect(parseDashboardLayout({
      layoutMode: 'masonry',
      widgetChrome: {
        kpi: { accent: 'violet', showHeader: true, headerStyle: 'inline', lockSize: true },
        health: { accent: 'neon', showHeader: 'yes', headerStyle: 'wide' },
        'my-inbox': { hideWhenEmpty: true },
        unknown: { accent: 'rose' },
      },
    })).toEqual({
      layoutMode: 'masonry',
      widgetOrder: [],
      hiddenWidgets: [],
      widgetSizes: {},
      widgetChrome: {
        kpi: { accent: 'violet', showHeader: true, headerStyle: 'inline', lockSize: true },
        'my-inbox': { hideWhenEmpty: true },
      },
      homeShortcuts: [],
    });
  });

  it('filters widgets that opt into hide-when-empty while not designing', () => {
    expect(filterDashboardWidgetOrderForDisplay(
      ['kpi', 'my-inbox', 'feedback'],
      { 'my-inbox': { hideWhenEmpty: true } },
      { 'my-inbox': true },
      { isDesigning: false },
    )).toEqual(['kpi', 'feedback']);

    expect(filterDashboardWidgetOrderForDisplay(
      ['kpi', 'my-inbox'],
      { 'my-inbox': { hideWhenEmpty: true } },
      { 'my-inbox': true },
      { isDesigning: true },
    )).toEqual(['kpi', 'my-inbox']);
  });

  it('parses hidden widgets', () => {
    expect(parseDashboardLayout({
      layoutMode: 'uniform',
      widgetOrder: ['kpi', 'feedback'],
      hiddenWidgets: ['feedback', 'unknown'],
    })).toEqual({
      layoutMode: 'masonry',
      widgetOrder: ['kpi', 'feedback'],
      hiddenWidgets: ['feedback'],
      widgetSizes: {},
      widgetChrome: {},
      homeShortcuts: [],
    });
  });

  it('merges stored order with defaults and available widgets', () => {
    const available = ['kpi', 'my-inbox', 'feedback', 'quick-actions'] as const;
    const defaultOrder = ['kpi', 'my-inbox', 'feedback', 'quick-actions'] as const;

    expect(mergeDashboardWidgetOrder(
      ['quick-actions', 'kpi'],
      [...available],
      [...defaultOrder],
    )).toEqual(['quick-actions', 'kpi', 'my-inbox', 'feedback']);
  });

  it('appends newly available widgets after stored and default order', () => {
    expect(mergeDashboardWidgetOrder(
      ['my-shortcuts'],
      ['kpi', 'my-shortcuts', 'feedback', 'quick-actions'],
      defaultAdminOrder,
    )).toEqual(['my-shortcuts', 'kpi', 'quick-actions', 'feedback']);
  });

  it('normalizes payload safely', () => {
    expect(normalizeDashboardLayoutPayload({
      layoutMode: 'uniform',
      widgetOrder: ['kpi', 'kpi', 'feedback'],
    })).toEqual({
      layoutMode: 'masonry',
      widgetOrder: ['kpi', 'feedback'],
      hiddenWidgets: [],
      widgetSizes: {},
      widgetChrome: {},
      homeShortcuts: [],
    });
    expect(normalizeDashboardLayoutPayload(null)).toBeNull();
  });

  it('strips stored column starts and keeps spans', () => {
    expect(stripDashboardWidgetStarts({
      health: { span: 8, start: 2, height: 240 },
      feedback: { start: 3 },
    })).toEqual({
      health: { span: 8, height: 240 },
    });
  });

  it('filters hidden widgets from visible order', () => {
    expect(resolveVisibleDashboardWidgets(
      ['kpi', 'feedback', 'quick-actions'],
      ['feedback'],
    )).toEqual(['kpi', 'quick-actions']);
  });

  it('identifies block ids and full-width blocks', () => {
    expect(isDashboardLayoutBlockId('kpi')).toBe(true);
    expect(isDashboardLayoutBlockId('missing')).toBe(false);
    expect(isDashboardLayoutFullWidthBlock('kpi')).toBe(true);
    expect(isDashboardLayoutFullWidthBlock('my-inbox')).toBe(false);
    expect(isDashboardLayoutFullWidthBlock('feedback')).toBe(false);
  });

  it('puts overview tiles after kpi for admins', () => {
    expect(defaultAdminOrder).toEqual([
      'kpi',
      'insights',
      'my-inbox',
      'health',
      'my-links',
      'my-shortcuts',
      'quick-actions',
      'feedback',
    ]);
  });

  it('puts personal links before quick actions for every role', () => {
    expect(buildDefaultDashboardWidgetOrder({
      isAdmin: false,
      feedbackEnabled: false,
    })).toEqual([
      'my-inbox',
      'my-links',
      'my-shortcuts',
      'quick-actions',
    ]);
    expect(buildDefaultDashboardWidgetOrder({
      isAdmin: false,
      feedbackEnabled: false,
    })).not.toContain('insights');
  });
});
