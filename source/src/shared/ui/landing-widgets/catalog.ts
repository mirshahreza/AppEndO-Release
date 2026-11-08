import type {
  LandingAuthoringTier,
  LandingCostTier,
  LandingRuntimeEngine,
  LandingWidgetCatalogEntry,
  LandingWidgetId,
} from './types';

const APP_WIDGET_IDS = [
  'landing-announcement',
  'landing-hero-centered',
  'landing-stat-strip',
  'landing-feature-grid',
  'landing-bento-features',
  'landing-process-steps',
  'landing-integration-grid',
  'landing-cta-band',
  'landing-faq',
  'landing-timeline',
] as const satisfies readonly LandingWidgetId[];

export const LANDING_APP_WIDGET_IDS: ReadonlySet<LandingWidgetId> = new Set(APP_WIDGET_IDS);

type Seed = readonly [
  LandingWidgetId,
  string,
  LandingCostTier,
  string,
  string,
];

const SEEDS = [
  ['landing-announcement', 'LandingAnnouncement', 'low', 'header/content only', 'static message'],
  ['landing-hero-centered', 'LandingHeroCentered', 'low', 'app home/empty-state only', 'compact hero'],
  ['landing-hero-split', 'LandingHeroSplit', 'medium', 'site only', 'phone stacks copy before media'],
  ['landing-hero-product-stage', 'LandingHeroProductStage', 'high', 'site only', 'poster image replaces stage'],
  ['landing-logo-cloud', 'LandingLogoCloud', 'low', 'site only', 'wrapped static grid'],
  ['landing-stat-strip', 'LandingStatStrip', 'low', 'read-only metrics', 'no live dashboard query'],
  ['landing-feature-grid', 'LandingFeatureGrid', 'low', 'app home/help only', 'static feature grid'],
  ['landing-bento-features', 'LandingBentoFeatures', 'medium', 'DOM/CSS only in app', 'regular grid on phone'],
  ['landing-feature-tabs', 'LandingFeatureTabs', 'medium', 'site only', 'first panel expanded in print/no-script'],
  ['landing-process-steps', 'LandingProcessSteps', 'low', 'app onboarding/help only', 'ordered static sequence'],
  ['landing-comparison', 'LandingComparison', 'medium', 'site only', 'horizontal table becomes stacked groups'],
  ['landing-pricing', 'LandingPricing', 'medium', 'site only', 'static plans; no checkout logic'],
  ['landing-testimonial-grid', 'LandingTestimonialGrid', 'low', 'site only', 'static attributed quotes'],
  ['landing-featured-quote', 'LandingFeaturedQuote', 'low', 'site only', 'quote without optional portrait'],
  ['landing-case-study', 'LandingCaseStudy', 'medium', 'site only', 'static narrative and metrics'],
  ['landing-integration-grid', 'LandingIntegrationGrid', 'low', 'informative app catalog only', 'no implicit install'],
  ['landing-media-gallery', 'LandingMediaGallery', 'medium', 'site only', 'static grid'],
  ['landing-marquee', 'LandingMarquee', 'medium', 'site only', 'wrapped static list for reduced motion'],
  ['landing-newsletter', 'LandingNewsletter', 'low', 'site only', 'registered form action required'],
  ['landing-cta-band', 'LandingCtaBand', 'low', 'actions use normal authorization/routing', 'static message and actions'],
  ['landing-faq', 'LandingFaq', 'low', 'app help surfaces only', 'expanded semantic disclosures'],
  ['landing-team', 'LandingTeam', 'low', 'site only', 'static profile summaries'],
  ['landing-timeline', 'LandingTimeline', 'medium', 'app onboarding/status only', 'static vertical phone form'],
  ['landing-contact', 'LandingContact', 'low', 'site only', 'registered form/map poster; no third-party embed'],
] as const satisfies readonly Seed[];

function engineFor(cost: LandingCostTier): LandingRuntimeEngine {
  if (cost === 'high') return 'orchestrated-dom';
  if (cost === 'medium') return 'css-svg';
  return 'static';
}

function authoringFor(cost: LandingCostTier): LandingAuthoringTier {
  return cost === 'high' ? 'enhanced' : 'core';
}

export const LANDING_WIDGET_CATALOG = Object.freeze(
  Object.fromEntries(
    SEEDS.map(([id, componentName, costTier, appConstraint, fallback]) => [
      id,
      Object.freeze({
        id,
        componentName,
        runtimeEngine: engineFor(costTier),
        costTier,
        authoringTier: authoringFor(costTier),
        compatibility: Object.freeze({
          site: 'primary' as const,
          app: LANDING_APP_WIDGET_IDS.has(id),
        }),
        appConstraint,
        fallback,
      }),
    ]),
  ),
) as Readonly<Record<LandingWidgetId, LandingWidgetCatalogEntry>>;

export const LANDING_WIDGET_IDS = Object.freeze(SEEDS.map(([id]) => id)) as readonly LandingWidgetId[];

export function isLandingWidgetCompatible(id: LandingWidgetId, target: 'site' | 'app'): boolean {
  return target === 'site' || LANDING_WIDGET_CATALOG[id].compatibility.app;
}
