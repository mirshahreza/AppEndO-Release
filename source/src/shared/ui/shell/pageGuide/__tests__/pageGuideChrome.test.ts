import { describe, expect, it } from 'vitest';
import { PAGE_GUIDE_ATTR, PAGE_GUIDE_TITLE_ATTR, PAGE_GUIDE_TOPIC_ATTR } from '../pageGuide.attrs';
import {
  pageGuideChromeProps,
  pageGuideNavItemProps,
  pageGuideTopicForChromeKey,
  skipsPageGuideChromeKey,
  skipsPageGuideNavItem,
} from '../pageGuideChrome';

const t = (key: string) => {
  if (key === 'pageGuide.chrome.logo.title') return 'Studio home';
  if (key === 'pageGuide.chrome.logo.hint') return 'Returns to the studio home dashboard.';
  if (key === 'pageGuide.chrome.sidebarCollapse.title') return 'Collapse sidebar';
  if (key === 'pageGuide.chrome.sidebarCollapse.hint') return 'Narrows or expands the navigation rail.';
  return key;
};

describe('pageGuideChrome', () => {
  it('skips Home landing nav even when it has a description', () => {
    expect(skipsPageGuideNavItem('Home', 'dashboard')).toBe(true);
    expect(pageGuideNavItemProps('Home', 'System overview and core metrics tracking.', 86, 'dashboard')).toEqual({});
    expect(pageGuideNavItemProps('Home', 'System overview and core metrics tracking.')).toEqual({});
  });

  it('skips the studio logo chrome stop', () => {
    expect(skipsPageGuideChromeKey('logo')).toBe(true);
    expect(pageGuideChromeProps(t, 'logo', 15)).toEqual({});
  });

  it('keeps explainable nav and chrome', () => {
    expect(skipsPageGuideNavItem('Data Studio', 'data-studio')).toBe(false);
    expect(pageGuideNavItemProps('Data Studio', 'Design models and query live data.')[PAGE_GUIDE_TITLE_ATTR]).toBe(
      'Data Studio',
    );
    expect(pageGuideChromeProps(t, 'sidebarCollapse', 82)[PAGE_GUIDE_ATTR]).toBe('');
    expect(pageGuideChromeProps(t, 'sidebarCollapse', 82)[PAGE_GUIDE_TOPIC_ATTR]).toBe('navigation');
    expect(pageGuideNavItemProps('Data Studio', 'Design models and query live data.')[PAGE_GUIDE_TOPIC_ATTR]).toBe(
      'navigation',
    );
    expect(pageGuideTopicForChromeKey('account')).toBe('capabilities');
    expect(pageGuideTopicForChromeKey('location')).toBe('page');
    expect(pageGuideChromeProps(t, 'account', 16)[PAGE_GUIDE_TOPIC_ATTR]).toBe('capabilities');
  });

  it('does not invent a filler hint for unlabeled nav items', () => {
    expect(pageGuideNavItemProps('Users', undefined)).toEqual({});
    expect(pageGuideNavItemProps('Users', '   ')).toEqual({});
  });
});
