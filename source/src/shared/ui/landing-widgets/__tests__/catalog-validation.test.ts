import { describe, expect, it } from 'vitest';
import {
  LANDING_APP_WIDGET_IDS,
  LANDING_WIDGET_CATALOG,
  LANDING_WIDGET_FIXTURES,
  LANDING_WIDGET_IDS,
  validateLandingWidgetConfig,
} from '..';

const expectedIds = [
  'landing-announcement', 'landing-hero-centered', 'landing-hero-split',
  'landing-hero-product-stage', 'landing-logo-cloud', 'landing-stat-strip',
  'landing-feature-grid', 'landing-bento-features', 'landing-feature-tabs',
  'landing-process-steps', 'landing-comparison', 'landing-pricing',
  'landing-testimonial-grid', 'landing-featured-quote', 'landing-case-study',
  'landing-integration-grid', 'landing-media-gallery', 'landing-marquee',
  'landing-newsletter', 'landing-cta-band', 'landing-faq', 'landing-team',
  'landing-timeline', 'landing-contact',
] as const;

const expectedAppIds = [
  'landing-announcement', 'landing-hero-centered', 'landing-stat-strip',
  'landing-feature-grid', 'landing-bento-features', 'landing-process-steps',
  'landing-integration-grid', 'landing-cta-band', 'landing-faq', 'landing-timeline',
] as const;

describe('landing widget frozen catalog', () => {
  it('publishes exactly the §6A IDs and app allowlist', () => {
    expect(LANDING_WIDGET_IDS).toEqual(expectedIds);
    expect([...LANDING_APP_WIDGET_IDS]).toEqual(expectedAppIds);
    expect(Object.keys(LANDING_WIDGET_CATALOG)).toEqual(expectedIds);
  });

  it('provides independent strict runtime metadata and deterministic fallbacks', () => {
    for (const entry of Object.values(LANDING_WIDGET_CATALOG)) {
      expect(['static', 'css-svg', 'orchestrated-dom']).toContain(entry.runtimeEngine);
      expect(['low', 'medium', 'high']).toContain(entry.costTier);
      expect(['core', 'enhanced']).toContain(entry.authoringTier);
      expect(entry.compatibility.site).toBe('primary');
      expect(entry.fallback.length).toBeGreaterThan(3);
      expect(entry.compatibility.app).toBe(LANDING_APP_WIDGET_IDS.has(entry.id));
    }
  });
});

describe('landing widget validation', () => {
  it('accepts every deterministic fixture', () => {
    for (const id of LANDING_WIDGET_IDS) {
      expect(validateLandingWidgetConfig(LANDING_WIDGET_FIXTURES[id]).success).toBe(true);
    }
  });

  it('enforces collection bounds and rejects unknown configuration', () => {
    const bounded = validateLandingWidgetConfig({
      id: 'landing-stat-strip',
      props: { heading: 'Outcomes', metrics: [{ label: 'Only', value: '1' }] },
    });
    expect(bounded.success).toBe(false);

    const unknown = validateLandingWidgetConfig({
      id: 'landing-cta-band',
      props: { heading: 'Safe', arbitraryCss: 'position:fixed' },
    } as never);
    expect(unknown.success).toBe(false);
  });

  it('rejects executable content, remote assets, and unsafe links', () => {
    const executable = validateLandingWidgetConfig({
      id: 'landing-hero-centered',
      props: {
        heading: '<script>alert(1)</script>',
        copy: 'Unsafe',
        media: { assetRef: 'https://example.com/image.png', alt: 'Remote image' },
        actions: [{ label: 'Run', href: 'javascript:alert(1)' }],
      },
    });
    expect(executable.success).toBe(false);
    if ('issues' in executable) expect(executable.issues.length).toBeGreaterThanOrEqual(3);

    expect(validateLandingWidgetConfig({
      id: 'landing-newsletter',
      props: {
        heading: 'Updates',
        actionId: 'newsletter-signup',
        consentLabel: 'I agree',
        onSubmit: () => undefined,
      },
    }).success).toBe(false);
  });

  it('fails closed for every site-only widget in app mode', () => {
    for (const id of LANDING_WIDGET_IDS) {
      const result = validateLandingWidgetConfig(LANDING_WIDGET_FIXTURES[id], 'app');
      expect(result.success).toBe(LANDING_APP_WIDGET_IDS.has(id));
    }
  });
});
