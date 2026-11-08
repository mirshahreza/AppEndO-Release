import { LANDING_WIDGET_IDS } from './catalog';
import type { LandingTarget, LandingWidgetConfig, LandingWidgetId } from './types';

export type LandingValidationIssue = Readonly<{ path: string; message: string }>;
export type LandingValidationResult<T> =
  | Readonly<{ success: true; value: T }>
  | Readonly<{ success: false; issues: readonly LandingValidationIssue[] }>;

const FORBIDDEN_CONTENT = /<[^>]+>|javascript:|data:text\/html|(?:^|[\s"'`])(?:on\w+)\s*=/i;
const REMOTE_ASSET = /^(?:https?:)?\/\//i;
const SAFE_HREF = /^(?:\/(?!\/)|#|mailto:|tel:)/i;
const MAX_STRING = 500;

// `className` remains available to trusted React callers, but is deliberately
// excluded from serialized config: authored widgets cannot carry CSS.
const COMMON_KEYS = ['id', 'ariaLabel'] as const;
const SECTION_KEYS = [...COMMON_KEYS, 'eyebrow', 'heading', 'copy', 'actions'] as const;

const KEYS: Record<LandingWidgetId, readonly string[]> = {
  'landing-announcement': [...COMMON_KEYS, 'message', 'action', 'dismissLabel'],
  'landing-hero-centered': [...COMMON_KEYS, 'eyebrow', 'heading', 'copy', 'actions', 'media', 'trustCue'],
  'landing-hero-split': [...COMMON_KEYS, 'eyebrow', 'heading', 'copy', 'actions', 'media', 'trustCue'],
  'landing-hero-product-stage': [...COMMON_KEYS, 'eyebrow', 'heading', 'copy', 'actions', 'media', 'trustCue'],
  'landing-logo-cloud': [...SECTION_KEYS, 'integrations'],
  'landing-stat-strip': [...SECTION_KEYS, 'metrics'],
  'landing-feature-grid': [...SECTION_KEYS, 'features'],
  'landing-bento-features': [...SECTION_KEYS, 'features'],
  'landing-feature-tabs': [...SECTION_KEYS, 'features'],
  'landing-process-steps': [...SECTION_KEYS, 'steps'],
  'landing-comparison': [...SECTION_KEYS, 'offerings', 'rows'],
  'landing-pricing': [...SECTION_KEYS, 'plans'],
  'landing-testimonial-grid': [...SECTION_KEYS, 'quotes'],
  'landing-featured-quote': [...COMMON_KEYS, 'quote', 'name', 'role', 'portrait'],
  'landing-case-study': [...SECTION_KEYS, 'metrics', 'media'],
  'landing-integration-grid': [...SECTION_KEYS, 'integrations'],
  'landing-media-gallery': [...SECTION_KEYS, 'media'],
  'landing-marquee': [...COMMON_KEYS, 'items'],
  'landing-newsletter': [...SECTION_KEYS, 'actionId', 'consentLabel'],
  'landing-cta-band': SECTION_KEYS,
  'landing-faq': [...SECTION_KEYS, 'items'],
  'landing-team': [...SECTION_KEYS, 'people'],
  'landing-timeline': [...SECTION_KEYS, 'milestones'],
  'landing-contact': [...SECTION_KEYS, 'routes', 'actionId'],
};

const COLLECTIONS: Partial<Record<LandingWidgetId, readonly [string, number, number][]>> = {
  'landing-stat-strip': [['metrics', 2, 6]],
  'landing-feature-grid': [['features', 2, 12]],
  'landing-bento-features': [['features', 3, 8]],
  'landing-feature-tabs': [['features', 2, 8]],
  'landing-process-steps': [['steps', 2, 8]],
  'landing-comparison': [['offerings', 2, 4], ['rows', 1, 20]],
  'landing-pricing': [['plans', 1, 4]],
  'landing-testimonial-grid': [['quotes', 1, 9]],
  'landing-case-study': [['metrics', 1, 6]],
  'landing-logo-cloud': [['integrations', 1, 24]],
  'landing-integration-grid': [['integrations', 1, 24]],
  'landing-media-gallery': [['media', 1, 12]],
  'landing-marquee': [['items', 2, 20]],
  'landing-faq': [['items', 2, 20]],
  'landing-team': [['people', 1, 12]],
  'landing-timeline': [['milestones', 2, 12]],
  'landing-contact': [['routes', 1, 8]],
};

const REQUIRED: Record<LandingWidgetId, readonly string[]> = {
  'landing-announcement': ['message'],
  'landing-hero-centered': ['heading', 'copy'],
  'landing-hero-split': ['heading', 'copy'],
  'landing-hero-product-stage': ['heading', 'copy'],
  'landing-logo-cloud': ['heading', 'integrations'],
  'landing-stat-strip': ['heading', 'metrics'],
  'landing-feature-grid': ['heading', 'features'],
  'landing-bento-features': ['heading', 'features'],
  'landing-feature-tabs': ['heading', 'features'],
  'landing-process-steps': ['heading', 'steps'],
  'landing-comparison': ['heading', 'offerings', 'rows'],
  'landing-pricing': ['heading', 'plans'],
  'landing-testimonial-grid': ['heading', 'quotes'],
  'landing-featured-quote': ['quote', 'name'],
  'landing-case-study': ['heading', 'metrics'],
  'landing-integration-grid': ['heading', 'integrations'],
  'landing-media-gallery': ['heading', 'media'],
  'landing-marquee': ['ariaLabel', 'items'],
  'landing-newsletter': ['heading', 'actionId', 'consentLabel'],
  'landing-cta-band': ['heading'],
  'landing-faq': ['heading', 'items'],
  'landing-team': ['heading', 'people'],
  'landing-timeline': ['heading', 'milestones'],
  'landing-contact': ['heading', 'routes'],
};

function inspect(value: unknown, path: string, issues: LandingValidationIssue[]): void {
  if (typeof value === 'string') {
    if (!value.trim()) issues.push({ path, message: 'Must not be empty.' });
    if (value.length > MAX_STRING) issues.push({ path, message: `Must be at most ${MAX_STRING} characters.` });
    if (FORBIDDEN_CONTENT.test(value)) issues.push({ path, message: 'HTML, CSS, scripts, and event handlers are not allowed.' });
    if (path.endsWith('.assetRef') && (REMOTE_ASSET.test(value) || !/^(?:\/assets\/|asset:)[a-z0-9/_\-.]+$/i.test(value))) {
      issues.push({ path, message: 'Asset references must use a local /assets/ or asset: reference.' });
    }
    if (path.endsWith('.href') && !SAFE_HREF.test(value)) {
      issues.push({ path, message: 'Links must be app-relative, fragments, mailto, or tel links.' });
    }
    return;
  }
  if (typeof value === 'function') {
    issues.push({ path, message: 'Callbacks and executable code are not allowed in serialized widget config.' });
    return;
  }
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, `${path}[${index}]`, issues));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      inspect(child, `${path}.${key}`, issues);
    }
  }
}

export function validateLandingWidgetConfig<I extends LandingWidgetId>(
  config: LandingWidgetConfig<I>,
  target: LandingTarget = 'site',
): LandingValidationResult<LandingWidgetConfig<I>> {
  const issues: LandingValidationIssue[] = [];
  if (!LANDING_WIDGET_IDS.includes(config.id)) {
    return { success: false, issues: [{ path: 'id', message: 'Unknown landing widget ID.' }] };
  }
  const props = config.props as Record<string, unknown>;
  for (const key of Object.keys(props)) {
    if (!KEYS[config.id].includes(key)) issues.push({ path: `props.${key}`, message: 'Unknown property.' });
  }
  for (const key of REQUIRED[config.id]) {
    const value = props[key];
    if (value == null || (typeof value === 'string' && !value.trim())) {
      issues.push({ path: `props.${key}`, message: 'Required property is missing.' });
    }
  }
  if (target === 'app' && ![
    'landing-announcement', 'landing-hero-centered', 'landing-stat-strip',
    'landing-feature-grid', 'landing-bento-features', 'landing-process-steps',
    'landing-integration-grid', 'landing-cta-band', 'landing-faq', 'landing-timeline',
  ].includes(config.id)) {
    issues.push({ path: 'id', message: 'Widget is not compatible with app surfaces.' });
  }
  for (const [key, min, max] of COLLECTIONS[config.id] ?? []) {
    const value = props[key];
    if (!Array.isArray(value) || value.length < min || value.length > max) {
      issues.push({ path: `props.${key}`, message: `Must contain ${min}–${max} items.` });
    }
  }
  const actions = props.actions;
  if (Array.isArray(actions) && actions.length > 2) {
    issues.push({ path: 'props.actions', message: 'Must contain at most 2 actions.' });
  }
  if (config.id === 'landing-newsletter' && typeof props.actionId !== 'string') {
    issues.push({ path: 'props.actionId', message: 'A registered form action ID is required.' });
  }
  inspect(props, 'props', issues);
  return issues.length ? { success: false, issues } : { success: true, value: config };
}

export function assertLandingWidgetConfig<I extends LandingWidgetId>(
  config: LandingWidgetConfig<I>,
  target: LandingTarget = 'site',
): LandingWidgetConfig<I> {
  const result = validateLandingWidgetConfig(config, target);
  if ('issues' in result) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join(' '));
  }
  return result.value;
}
