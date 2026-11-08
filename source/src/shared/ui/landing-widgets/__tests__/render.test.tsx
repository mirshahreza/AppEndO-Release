import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  LANDING_WIDGET_FIXTURES,
  LANDING_WIDGET_IDS,
  LANDING_WIDGET_REGISTRY,
  LandingWidgetRenderer,
} from '..';

describe('landing widget registry and renderer', () => {
  it('registers and renders all 24 named components deterministically', () => {
    expect(Object.keys(LANDING_WIDGET_REGISTRY)).toEqual(LANDING_WIDGET_IDS);
    for (const id of LANDING_WIDGET_IDS) {
      const first = renderToStaticMarkup(
        <LandingWidgetRenderer config={LANDING_WIDGET_FIXTURES[id]} />,
      );
      const second = renderToStaticMarkup(
        <LandingWidgetRenderer config={LANDING_WIDGET_FIXTURES[id]} />,
      );
      expect(first).toBe(second);
      expect(first).toContain(`data-landing-widget-id="${id}"`);
      expect(first).not.toMatch(/<script|<style|(?:src|href)="https?:\/\//i);
    }
  });

  it('projects incompatible app widgets to their declared fallback', () => {
    const markup = renderToStaticMarkup(
      <LandingWidgetRenderer
        target="app"
        config={LANDING_WIDGET_FIXTURES['landing-pricing']}
        invalidFallback="Unavailable in app surfaces"
      />,
    );
    expect(markup).toContain('data-landing-widget-invalid="landing-pricing"');
    expect(markup).toContain('static plans; no checkout logic');
    expect(markup).toContain('Unavailable in app surfaces');
    expect(markup).not.toContain('Plans that grow');
  });
});
