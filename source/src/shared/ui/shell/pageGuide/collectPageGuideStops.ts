import {
  PAGE_GUIDE_ATTR,
  PAGE_GUIDE_HINT_ATTR,
  PAGE_GUIDE_IGNORE_ATTR,
  PAGE_GUIDE_MEMBERS_ATTR,
  PAGE_GUIDE_PRIORITY_ATTR,
  PAGE_GUIDE_REVEAL_ATTR,
  PAGE_GUIDE_SCOPE_ATTR,
  PAGE_GUIDE_SURFACE_ATTR,
  PAGE_GUIDE_TITLE_ATTR,
  PAGE_GUIDE_TOPIC_ATTR,
  resolvePageGuideTopic,
} from './pageGuide.attrs';
import { formatPageGuideIncludesHint } from './pageGuideChrome';
import { resolvePageGuideGroupRoot } from './pageGuideReveal';
import type { PageGuideStop, PageGuideTopic } from './pageGuide.types';

const MIN_HIGHLIGHT_PX = 24;

const readRect = (element: HTMLElement): DOMRect | null => {
  try {
    return element.getBoundingClientRect();
  } catch {
    return null;
  }
};

const isHiddenStyle = (element: HTMLElement): boolean => {
  try {
    if (element.hidden) return true;
    const style = window.getComputedStyle(element);
    return style.display === 'none'
      || style.visibility === 'hidden'
      || style.opacity === '0'
      || style.contentVisibility === 'hidden';
  } catch {
    return true;
  }
};

const isVisible = (element: HTMLElement): boolean => {
  try {
    if (!element.isConnected) return false;
    let current: HTMLElement | null = element;
    while (current) {
      if (isHiddenStyle(current)) return false;
      current = current.parentElement;
    }
    const rect = readRect(element);
    return Boolean(rect && rect.width >= 2 && rect.height >= 2);
  } catch {
    return false;
  }
};

const isHugeLandmark = (element: HTMLElement): boolean => {
  const rect = readRect(element);
  if (!rect) return true;
  const viewportHeight = window.innerHeight || 1;
  const viewportWidth = window.innerWidth || 1;
  return rect.height > viewportHeight * 0.55
    || (rect.width * rect.height) > (viewportWidth * viewportHeight * 0.35);
};

const slugStopId = (title: string, index: number): string => {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'stop'}-${index}`;
};

const resolveHighlightElement = (element: HTMLElement): HTMLElement => {
  try {
    const surface = element.closest<HTMLElement>(`[${PAGE_GUIDE_SURFACE_ATTR}]`);
    if (surface) return surface;
  } catch {
    return element;
  }

  const rect = readRect(element);
  if (rect && rect.width >= MIN_HIGHLIGHT_PX && rect.height >= MIN_HIGHLIGHT_PX) {
    return element;
  }

  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const next = readRect(current);
    if (next && next.width >= 72 && next.height >= MIN_HIGHLIGHT_PX) {
      return current;
    }
    current = current.parentElement;
  }
  return element;
};

export const collectPageGuideStops = (root: ParentNode = document): PageGuideStop[] => {
  let nodes: HTMLElement[] = [];
  try {
    nodes = Array.from(root.querySelectorAll<HTMLElement>(`[${PAGE_GUIDE_ATTR}]`));
  } catch {
    return [];
  }
  const collected: PageGuideStop[] = [];

  nodes.forEach((element, index) => {
    try {
      if (element.closest(`[${PAGE_GUIDE_IGNORE_ATTR}]`)) return;
      const title = element.getAttribute(PAGE_GUIDE_TITLE_ATTR)?.trim() ?? '';
      const hint = element.getAttribute(PAGE_GUIDE_HINT_ATTR)?.trim() ?? '';
      if (!title || !hint) return;

      const target = resolveHighlightElement(element);
      if (!isVisible(target) || isHugeLandmark(target)) return;

      const priorityRaw = Number(element.getAttribute(PAGE_GUIDE_PRIORITY_ATTR));
      const scope = element.getAttribute(PAGE_GUIDE_SCOPE_ATTR) === 'chrome' ? 'chrome' : 'local';
      collected.push({
        id: slugStopId(title, index),
        title,
        hint,
        priority: Number.isFinite(priorityRaw) ? priorityRaw : 50,
        scope,
        topic: resolvePageGuideTopic(scope, element.getAttribute(PAGE_GUIDE_TOPIC_ATTR)),
        element: target,
      });
    } catch {
      // A single broken node must not crash the tour.
    }
  });

  const uniqueByElement = new Map<HTMLElement, PageGuideStop>();
  for (const stop of collected) {
    const existing = uniqueByElement.get(stop.element);
    if (!existing || stop.priority < existing.priority) {
      uniqueByElement.set(stop.element, stop);
    }
  }

  const uniqueByTitle = new Map<string, PageGuideStop>();
  for (const stop of uniqueByElement.values()) {
    const key = stop.title.trim().toLowerCase();
    const existing = uniqueByTitle.get(key);
    if (!existing) {
      uniqueByTitle.set(key, stop);
      continue;
    }
    uniqueByTitle.set(key, preferPageGuideStop(existing, stop));
  }

  try {
    return enrichPageGuideGroupHints([...uniqueByTitle.values()].sort(comparePageGuideStops));
  } catch {
    return [...uniqueByTitle.values()];
  }
};

const chromeRank = (stop: PageGuideStop): number => (stop.scope === 'chrome' ? 1 : 0);

const preferPageGuideStop = (left: PageGuideStop, right: PageGuideStop): PageGuideStop => {
  const leftChrome = chromeRank(left);
  const rightChrome = chromeRank(right);
  if (leftChrome !== rightChrome) return leftChrome < rightChrome ? left : right;
  return right.priority < left.priority ? right : left;
};

const comparePageGuideStops = (left: PageGuideStop, right: PageGuideStop): number => {
  try {
    const position = left.element.compareDocumentPosition(right.element);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  } catch {
    return 0;
  }
  if (left.priority !== right.priority) return left.priority - right.priority;
  return 0;
};

const readDeclaredMembers = (element: HTMLElement): string[] => {
  try {
    return (element.getAttribute(PAGE_GUIDE_MEMBERS_ATTR) ?? '')
      .split('|')
      .map((name) => name.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const isGroupIntroStop = (stop: PageGuideStop, stops: readonly PageGuideStop[], index: number): boolean => {
  try {
    if (stop.element.hasAttribute(PAGE_GUIDE_REVEAL_ATTR) || stop.element.closest(`[${PAGE_GUIDE_REVEAL_ATTR}]`)) {
      return true;
    }
  } catch {
    return false;
  }
  const group = resolvePageGuideGroupRoot(stop.element);
  if (!group) return false;
  return !stops.slice(0, index).some((other) => {
    try {
      return group.contains(other.element);
    } catch {
      return false;
    }
  });
};

const enrichPageGuideGroupHints = (stops: PageGuideStop[]): PageGuideStop[] => (
  stops.map((stop, index) => {
    if (!isGroupIntroStop(stop, stops, index)) return stop;
    const declared = readDeclaredMembers(stop.element);
    const group = resolvePageGuideGroupRoot(stop.element);
    const fromDom = group
      ? stops
        .filter((other) => other !== stop)
        .filter((other) => {
          try {
            return group.contains(other.element);
          } catch {
            return false;
          }
        })
        .map((other) => other.title)
      : [];
    const members = (declared.length ? declared : fromDom)
      .filter((title) => title.trim().toLowerCase() !== stop.title.trim().toLowerCase());
    const includes = formatPageGuideIncludesHint(members);
    if (!includes || stop.hint.includes(includes) || /\bIncludes\b/.test(stop.hint)) {
      return stop;
    }
    return { ...stop, hint: `${stop.hint} ${includes}` };
  })
);

export const filterPageGuideStopsByTopic = (
  stops: readonly PageGuideStop[],
  topic: PageGuideTopic,
): PageGuideStop[] => stops.filter((stop) => stop.topic === topic);

export const pageGuideTopicAvailability = (
  stops: readonly PageGuideStop[],
): Record<PageGuideTopic, boolean> => {
  const available: Record<PageGuideTopic, boolean> = {
    page: false,
    navigation: false,
    capabilities: false,
  };
  for (const stop of stops) {
    available[stop.topic] = true;
  }
  return available;
};
