import { PAGE_GUIDE_GROUP_ATTR, PAGE_GUIDE_REVEAL_ATTR } from './pageGuide.attrs';

export const resolvePageGuideRevealTrigger = (element: HTMLElement): HTMLElement | null => {
  try {
    if (element.hasAttribute(PAGE_GUIDE_REVEAL_ATTR)) return element;
    return element.closest<HTMLElement>(`[${PAGE_GUIDE_REVEAL_ATTR}]`);
  } catch {
    return null;
  }
};

export const isPageGuideRevealCollapsed = (element: HTMLElement): boolean => {
  const trigger = resolvePageGuideRevealTrigger(element);
  if (!trigger) return false;
  const expanded = trigger.getAttribute('data-expanded') ?? trigger.getAttribute('aria-expanded');
  return expanded === 'false';
};

export const revealPageGuideGroup = (element: HTMLElement): boolean => {
  const trigger = resolvePageGuideRevealTrigger(element);
  if (!trigger || !isPageGuideRevealCollapsed(element)) return false;
  try {
    trigger.click();
    return true;
  } catch {
    return false;
  }
};

export const resolvePageGuideGroupRoot = (element: HTMLElement): HTMLElement | null => {
  try {
    return element.closest<HTMLElement>(`[${PAGE_GUIDE_GROUP_ATTR}]`);
  } catch {
    return null;
  }
};
