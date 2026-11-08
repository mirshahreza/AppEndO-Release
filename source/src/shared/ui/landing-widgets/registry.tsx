import * as React from 'react';
import {
  LandingAnnouncement,
  LandingBentoFeatures,
  LandingCaseStudy,
  LandingComparison,
  LandingContact,
  LandingCtaBand,
  LandingFaq,
  LandingFeatureGrid,
  LandingFeatureTabs,
  LandingFeaturedQuote,
  LandingHeroCentered,
  LandingHeroProductStage,
  LandingHeroSplit,
  LandingIntegrationGrid,
  LandingLogoCloud,
  LandingMarquee,
  LandingMediaGallery,
  LandingNewsletter,
  LandingPricing,
  LandingProcessSteps,
  LandingStatStrip,
  LandingTeam,
  LandingTestimonialGrid,
  LandingTimeline,
} from './components';
import { LANDING_WIDGET_CATALOG } from './catalog';
import type {
  LandingTarget,
  LandingWidgetConfig,
  LandingWidgetId,
  LandingWidgetPropsMap,
} from './types';
import { validateLandingWidgetConfig } from './validation';

type LandingComponent<I extends LandingWidgetId> = React.ComponentType<LandingWidgetPropsMap[I]>;
type LandingRegistry = { readonly [I in LandingWidgetId]: LandingComponent<I> };

export const LANDING_WIDGET_REGISTRY = Object.freeze({
  'landing-announcement': LandingAnnouncement,
  'landing-hero-centered': LandingHeroCentered,
  'landing-hero-split': LandingHeroSplit,
  'landing-hero-product-stage': LandingHeroProductStage,
  'landing-logo-cloud': LandingLogoCloud,
  'landing-stat-strip': LandingStatStrip,
  'landing-feature-grid': LandingFeatureGrid,
  'landing-bento-features': LandingBentoFeatures,
  'landing-feature-tabs': LandingFeatureTabs,
  'landing-process-steps': LandingProcessSteps,
  'landing-comparison': LandingComparison,
  'landing-pricing': LandingPricing,
  'landing-testimonial-grid': LandingTestimonialGrid,
  'landing-featured-quote': LandingFeaturedQuote,
  'landing-case-study': LandingCaseStudy,
  'landing-integration-grid': LandingIntegrationGrid,
  'landing-media-gallery': LandingMediaGallery,
  'landing-marquee': LandingMarquee,
  'landing-newsletter': LandingNewsletter,
  'landing-cta-band': LandingCtaBand,
  'landing-faq': LandingFaq,
  'landing-team': LandingTeam,
  'landing-timeline': LandingTimeline,
  'landing-contact': LandingContact,
}) satisfies LandingRegistry;

export type LandingWidgetRendererProps<I extends LandingWidgetId = LandingWidgetId> = Readonly<{
  config: LandingWidgetConfig<I>;
  target?: LandingTarget;
  invalidFallback?: React.ReactNode;
}>;

export function LandingWidgetRenderer<I extends LandingWidgetId>({
  config,
  target = 'site',
  invalidFallback = null,
}: LandingWidgetRendererProps<I>) {
  const validation = validateLandingWidgetConfig(config, target);
  if (!validation.success) {
    return (
      <div
        role="status"
        data-landing-widget-invalid={config.id}
        data-landing-widget-fallback={LANDING_WIDGET_CATALOG[config.id]?.fallback ?? 'hidden'}
      >
        {invalidFallback}
      </div>
    );
  }
  const Component = LANDING_WIDGET_REGISTRY[config.id] as React.ComponentType<LandingWidgetPropsMap[I]>;
  return (
    <div
      data-landing-widget-id={config.id}
      data-runtime-engine={LANDING_WIDGET_CATALOG[config.id].runtimeEngine}
      data-cost-tier={LANDING_WIDGET_CATALOG[config.id].costTier}
    >
      <Component {...validation.value.props} />
    </div>
  );
}
