import type { LucideIcon } from 'lucide-react';

export type LandingWidgetId =
  | 'landing-announcement'
  | 'landing-hero-centered'
  | 'landing-hero-split'
  | 'landing-hero-product-stage'
  | 'landing-logo-cloud'
  | 'landing-stat-strip'
  | 'landing-feature-grid'
  | 'landing-bento-features'
  | 'landing-feature-tabs'
  | 'landing-process-steps'
  | 'landing-comparison'
  | 'landing-pricing'
  | 'landing-testimonial-grid'
  | 'landing-featured-quote'
  | 'landing-case-study'
  | 'landing-integration-grid'
  | 'landing-media-gallery'
  | 'landing-marquee'
  | 'landing-newsletter'
  | 'landing-cta-band'
  | 'landing-faq'
  | 'landing-team'
  | 'landing-timeline'
  | 'landing-contact';

export type LandingRuntimeEngine = 'static' | 'css-svg' | 'orchestrated-dom';
export type LandingCostTier = 'low' | 'medium' | 'high';
export type LandingAuthoringTier = 'core' | 'enhanced';
export type LandingTarget = 'site' | 'app';

export type LandingWidgetCatalogEntry = Readonly<{
  id: LandingWidgetId;
  componentName: string;
  runtimeEngine: LandingRuntimeEngine;
  costTier: LandingCostTier;
  authoringTier: LandingAuthoringTier;
  compatibility: Readonly<{ site: 'primary'; app: boolean }>;
  appConstraint: string;
  fallback: string;
}>;

export type LandingAction = Readonly<{
  label: string;
  href: string;
  kind?: 'primary' | 'secondary';
}>;

export type LandingMedia = Readonly<{
  assetRef: string;
  alt: string;
  caption?: string;
}>;

export type LandingFeature = Readonly<{
  title: string;
  description: string;
  icon?: LucideIcon;
}>;

export type LandingMetric = Readonly<{ value: string; label: string }>;
export type LandingQuote = Readonly<{ quote: string; name: string; role?: string }>;

export type LandingWidgetCommonProps = Readonly<{
  id?: string;
  className?: string;
  ariaLabel?: string;
}>;

export type LandingAnnouncementProps = LandingWidgetCommonProps & Readonly<{
  message: string;
  action?: LandingAction;
  dismissLabel?: string;
  onDismiss?: () => void;
}>;

export type LandingHeroProps = LandingWidgetCommonProps & Readonly<{
  eyebrow?: string;
  heading: string;
  copy: string;
  actions?: readonly LandingAction[];
  media?: LandingMedia;
  trustCue?: string;
}>;

export type LandingSectionProps = LandingWidgetCommonProps & Readonly<{
  eyebrow?: string;
  heading: string;
  copy?: string;
  actions?: readonly LandingAction[];
}>;

export type LandingMetricProps = LandingSectionProps & Readonly<{ metrics: readonly LandingMetric[] }>;
export type LandingFeatureProps = LandingSectionProps & Readonly<{ features: readonly LandingFeature[] }>;
export type LandingFeatureTabsProps = LandingSectionProps & Readonly<{ features: readonly LandingFeature[] }>;
export type LandingProcessStepsProps = LandingSectionProps & Readonly<{ steps: readonly LandingFeature[] }>;

export type LandingComparisonProps = LandingSectionProps & Readonly<{
  offerings: readonly string[];
  rows: readonly Readonly<{ feature: string; values: readonly string[] }>[];
}>;

export type LandingPricingProps = LandingSectionProps & Readonly<{
  plans: readonly Readonly<{
    name: string;
    price: string;
    description: string;
    features: readonly string[];
    action?: LandingAction;
  }>[];
}>;

export type LandingQuotesProps = LandingSectionProps & Readonly<{ quotes: readonly LandingQuote[] }>;
export type LandingFeaturedQuoteProps = LandingWidgetCommonProps & LandingQuote & Readonly<{ portrait?: LandingMedia }>;
export type LandingCaseStudyProps = LandingSectionProps & Readonly<{ metrics: readonly LandingMetric[]; media?: LandingMedia }>;
export type LandingIntegrationProps = LandingSectionProps & Readonly<{ integrations: readonly Readonly<{ name: string; assetRef?: string }>[] }>;
export type LandingGalleryProps = LandingSectionProps & Readonly<{ media: readonly LandingMedia[] }>;
export type LandingMarqueeProps = LandingWidgetCommonProps & Readonly<{ items: readonly string[]; ariaLabel: string }>;
export type LandingNewsletterProps = LandingSectionProps & Readonly<{ actionId: string; consentLabel: string; onSubmit?: (email: string) => void }>;
export type LandingFaqProps = LandingSectionProps & Readonly<{ items: readonly Readonly<{ question: string; answer: string }>[] }>;
export type LandingTeamProps = LandingSectionProps & Readonly<{ people: readonly Readonly<{ name: string; role: string; portrait?: LandingMedia }>[] }>;
export type LandingTimelineProps = LandingSectionProps & Readonly<{ milestones: readonly Readonly<{ date: string; title: string; description: string }>[] }>;
export type LandingContactProps = LandingSectionProps & Readonly<{ routes: readonly Readonly<{ label: string; value: string; href?: string }>[]; actionId?: string }>;

export type LandingWidgetPropsMap = {
  'landing-announcement': LandingAnnouncementProps;
  'landing-hero-centered': LandingHeroProps;
  'landing-hero-split': LandingHeroProps;
  'landing-hero-product-stage': LandingHeroProps;
  'landing-logo-cloud': LandingIntegrationProps;
  'landing-stat-strip': LandingMetricProps;
  'landing-feature-grid': LandingFeatureProps;
  'landing-bento-features': LandingFeatureProps;
  'landing-feature-tabs': LandingFeatureTabsProps;
  'landing-process-steps': LandingProcessStepsProps;
  'landing-comparison': LandingComparisonProps;
  'landing-pricing': LandingPricingProps;
  'landing-testimonial-grid': LandingQuotesProps;
  'landing-featured-quote': LandingFeaturedQuoteProps;
  'landing-case-study': LandingCaseStudyProps;
  'landing-integration-grid': LandingIntegrationProps;
  'landing-media-gallery': LandingGalleryProps;
  'landing-marquee': LandingMarqueeProps;
  'landing-newsletter': LandingNewsletterProps;
  'landing-cta-band': LandingSectionProps;
  'landing-faq': LandingFaqProps;
  'landing-team': LandingTeamProps;
  'landing-timeline': LandingTimelineProps;
  'landing-contact': LandingContactProps;
};

export type LandingWidgetConfig<I extends LandingWidgetId = LandingWidgetId> = Readonly<{
  id: I;
  props: LandingWidgetPropsMap[I];
}>;
