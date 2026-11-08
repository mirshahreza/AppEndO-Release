import { describe, expect, it } from 'vitest';
import {
  formatNavigationIconRef,
  formatNavigationIconRefLabel,
  isExplicitNavigationIconRef,
  parseNavigationIconRef,
} from '../navigationIconRef';

describe('navigationIconRef', () => {
  it('parses explicit pack refs and legacy lucide names', () => {
    expect(parseNavigationIconRef('lucide:LayoutDashboard')).toEqual({
      packId: 'lucide',
      iconName: 'LayoutDashboard',
    });
    expect(parseNavigationIconRef('tabler:IconHome')).toEqual({
      packId: 'tabler',
      iconName: 'IconHome',
    });
    expect(parseNavigationIconRef('LayoutDashboard')).toEqual({
      packId: 'lucide',
      iconName: 'LayoutDashboard',
    });
  });

  it('formats icon refs for storage', () => {
    expect(formatNavigationIconRef('phosphor', 'House')).toBe('phosphor:House');
    expect(formatNavigationIconRef('solar', 'Home')).toBe('solar:Home');
    expect(formatNavigationIconRefLabel('LayoutDashboard')).toBe('lucide:LayoutDashboard');
  });

  it('detects explicit pack refs for adornment rendering', () => {
    expect(isExplicitNavigationIconRef('lucide:AlarmSmoke')).toBe(true);
    expect(isExplicitNavigationIconRef('tabler:IconHome')).toBe(true);
    expect(isExplicitNavigationIconRef('Search')).toBe(false);
    expect(isExplicitNavigationIconRef('@')).toBe(false);
  });
});
