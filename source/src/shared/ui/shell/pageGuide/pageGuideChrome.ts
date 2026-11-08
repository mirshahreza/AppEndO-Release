import { pageGuideProps } from './pageGuide.attrs';
import type { PageGuideTopic } from './pageGuide.types';

/** Landing chrome everyone already understands — do not tour it. */
const PAGE_GUIDE_SKIP_CHROME_KEYS = new Set(['logo']);
const PAGE_GUIDE_SKIP_NAV_PAGE_KEYS = new Set(['dashboard', 'home']);
const PAGE_GUIDE_SKIP_NAV_TITLES = new Set(['home', 'studio home']);

const PAGE_GUIDE_CHROME_TOPIC: Record<string, PageGuideTopic> = {
  location: 'page',
  content: 'page',
  header: 'page',
  canvasToolbar: 'page',
  workspaceBack: 'page',
  refresh: 'page',
  filter: 'page',
  filterSummary: 'page',
  search: 'navigation',
  menu: 'navigation',
  sidebar: 'navigation',
  sidebarCollapse: 'navigation',
  sidebarSearch: 'navigation',
  appSwitcher: 'navigation',
  logo: 'navigation',
  account: 'capabilities',
  assistant: 'capabilities',
  feedback: 'capabilities',
  accent: 'capabilities',
  fullscreen: 'capabilities',
  pageWidth: 'capabilities',
  footer: 'capabilities',
};

export const pageGuideTopicForChromeKey = (key: string): PageGuideTopic => (
  PAGE_GUIDE_CHROME_TOPIC[key.trim()] ?? 'navigation'
);

const asGuideText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const skipsPageGuideChromeKey = (key: string): boolean => (
  PAGE_GUIDE_SKIP_CHROME_KEYS.has(key.trim())
);

export const skipsPageGuideNavItem = (title: string, pageKey?: string): boolean => {
  const key = asGuideText(pageKey).toLowerCase();
  if (key && PAGE_GUIDE_SKIP_NAV_PAGE_KEYS.has(key)) {
    return true;
  }

  return PAGE_GUIDE_SKIP_NAV_TITLES.has(asGuideText(title).toLowerCase());
};

const PAGE_GUIDE_INCLUDES_CAP = 5;

export const formatPageGuideIncludesHint = (titles: readonly string[]): string => {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const title of titles) {
    const name = asGuideText(title);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  if (!names.length) return '';
  if (names.length === 1) return `Includes ${names[0]}.`;
  if (names.length === 2) return `Includes ${names[0]} and ${names[1]}.`;
  if (names.length <= PAGE_GUIDE_INCLUDES_CAP) {
    return `Includes ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}.`;
  }
  const shown = names.slice(0, PAGE_GUIDE_INCLUDES_CAP);
  return `Includes ${shown.join(', ')}, and ${names.length - PAGE_GUIDE_INCLUDES_CAP} more.`;
};

export const pageGuideNavGroupProps = (
  title: string,
  memberTitles: readonly string[],
  priority = 84,
): Record<string, string> => {
  const trimmedTitle = asGuideText(title);
  if (!trimmedTitle || skipsPageGuideNavItem(trimmedTitle)) {
    return {};
  }

  const members = memberTitles.map((name) => asGuideText(name)).filter(Boolean);
  const hint = formatPageGuideIncludesHint(members) || `Pages in ${trimmedTitle}.`;
  return pageGuideProps({
    title: trimmedTitle,
    hint,
    priority,
    scope: 'chrome',
    topic: 'navigation',
    reveal: true,
    members,
  });
};

export const pageGuideChromeProps = (
  t: (key: string) => string,
  key: string,
  priority: number,
): Record<string, string> => {
  if (skipsPageGuideChromeKey(key)) {
    return {};
  }

  return pageGuideProps({
    title: t(`pageGuide.chrome.${key}.title`),
    hint: t(`pageGuide.chrome.${key}.hint`),
    priority,
    scope: 'chrome',
    topic: pageGuideTopicForChromeKey(key),
  });
};

export const pageGuideNavItemProps = (
  title: string,
  hint: string | undefined,
  priority = 86,
  pageKey?: string,
): Record<string, string> => {
  const trimmedTitle = asGuideText(title);
  const trimmedHint = asGuideText(hint);
  if (!trimmedTitle || !trimmedHint || skipsPageGuideNavItem(trimmedTitle, pageKey)) {
    return {};
  }

  return pageGuideProps({
    title: trimmedTitle,
    hint: trimmedHint,
    priority,
    scope: 'chrome',
    topic: 'navigation',
  });
};

export const pageGuideLocalProps = (
  title: string,
  hint: string,
  priority = 50,
): Record<string, string> => pageGuideProps({
  title,
  hint,
  priority,
  scope: 'local',
  topic: 'page',
});
