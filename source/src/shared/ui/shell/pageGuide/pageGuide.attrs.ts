import { PAGE_GUIDE_TOPICS, type PageGuideTopic } from './pageGuide.types';

export const PAGE_GUIDE_ATTR = 'data-page-guide';
export const PAGE_GUIDE_TITLE_ATTR = 'data-page-guide-title';
export const PAGE_GUIDE_HINT_ATTR = 'data-page-guide-hint';
export const PAGE_GUIDE_PRIORITY_ATTR = 'data-page-guide-priority';
export const PAGE_GUIDE_SCOPE_ATTR = 'data-page-guide-scope';
export const PAGE_GUIDE_TOPIC_ATTR = 'data-page-guide-topic';
export const PAGE_GUIDE_SURFACE_ATTR = 'data-page-guide-surface';
export const PAGE_GUIDE_IGNORE_ATTR = 'data-page-guide-ignore';
export const PAGE_GUIDE_GROUP_ATTR = 'data-page-guide-group';
export const PAGE_GUIDE_REVEAL_ATTR = 'data-page-guide-reveal';
export const PAGE_GUIDE_MEMBERS_ATTR = 'data-page-guide-members';

export type PageGuideScope = 'chrome' | 'local';

export type PageGuideAttrInput = {
  title: string;
  hint: string;
  priority?: number;
  scope?: PageGuideScope;
  topic?: PageGuideTopic;
  surface?: boolean;
  /** Click this control to reveal grouped child stops (accordion / nav category). */
  reveal?: boolean;
  /** Child titles for a group intro stop, even when those children are not in the DOM yet. */
  members?: readonly string[];
};

export const isPageGuideTopic = (value: string | null | undefined): value is PageGuideTopic => (
  Boolean(value && (PAGE_GUIDE_TOPICS as readonly string[]).includes(value))
);

export const resolvePageGuideTopic = (
  scope: PageGuideScope,
  topic: string | null | undefined,
): PageGuideTopic => {
  if (isPageGuideTopic(topic)) return topic;
  return scope === 'chrome' ? 'navigation' : 'page';
};

/**
 * Spread onto a control so the page guide can read it.
 * Requires both `title` and `hint`. Also picked up from FormField/FormSection
 * `hint`, FieldHintTooltip, Settings `labelInfo`, and PageHeaderToolbar `description`.
 */
export const pageGuideProps = (input: PageGuideAttrInput): Record<string, string> => {
  const title = String(input.title ?? '').trim();
  const hint = String(input.hint ?? '').trim();
  if (!title || !hint) return {};

  const props: Record<string, string> = {
    [PAGE_GUIDE_ATTR]: '',
    [PAGE_GUIDE_TITLE_ATTR]: title,
    [PAGE_GUIDE_HINT_ATTR]: hint,
    [PAGE_GUIDE_PRIORITY_ATTR]: String(input.priority ?? 50),
  };
  if (input.scope) props[PAGE_GUIDE_SCOPE_ATTR] = input.scope;
  const topic = input.topic ?? (input.scope === 'chrome' ? 'navigation' : 'page');
  props[PAGE_GUIDE_TOPIC_ATTR] = topic;
  if (input.surface) props[PAGE_GUIDE_SURFACE_ATTR] = '';
  if (input.reveal) props[PAGE_GUIDE_REVEAL_ATTR] = 'click';
  const members = (input.members ?? [])
    .map((name) => String(name ?? '').trim())
    .filter(Boolean);
  if (members.length) props[PAGE_GUIDE_MEMBERS_ATTR] = members.join('|');
  return props;
};

export const pickPageGuideDomProps = (
  props: Record<string, unknown>,
): Record<string, string> => {
  const keys = [
    PAGE_GUIDE_ATTR,
    PAGE_GUIDE_TITLE_ATTR,
    PAGE_GUIDE_HINT_ATTR,
    PAGE_GUIDE_PRIORITY_ATTR,
    PAGE_GUIDE_SCOPE_ATTR,
    PAGE_GUIDE_TOPIC_ATTR,
    PAGE_GUIDE_SURFACE_ATTR,
    PAGE_GUIDE_GROUP_ATTR,
    PAGE_GUIDE_REVEAL_ATTR,
    PAGE_GUIDE_MEMBERS_ATTR,
  ] as const;
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'string') {
      picked[key] = value;
    }
  }
  return picked;
};
