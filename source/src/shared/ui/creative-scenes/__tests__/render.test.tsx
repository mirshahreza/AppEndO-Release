import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CREATIVE_SCENE_CATALOG,
  CREATIVE_SCENE_FIXTURES,
  CreativeSceneCompositionHost,
  CreativeSceneRenderer,
  buildCreativeSceneEngine,
  buildCreativeSceneMotion,
  buildCreativeSceneWidgets,
  createCreativeSceneFixture,
  resolveCreativeSceneProjection,
} from '..';

describe('creative scene production composition', () => {
  it('renders all scenes deterministically with semantic DOM fallbacks', () => {
    for (const fixture of CREATIVE_SCENE_FIXTURES) {
      const first = renderToStaticMarkup(<CreativeSceneRenderer config={fixture} />);
      const second = renderToStaticMarkup(<CreativeSceneRenderer config={fixture} />);
      expect(first, fixture.sceneId).toBe(second);
      expect(first, fixture.sceneId).toContain(`data-creative-scene-id="${fixture.sceneId}"`);
      expect(first, fixture.sceneId).toContain(fixture.content.heading);
      expect(first, fixture.sceneId).toContain(
        `data-creative-scene-fallback="${CREATIVE_SCENE_CATALOG[fixture.sceneId].fallbackId}"`,
      );
      expect(first, fixture.sceneId).toContain('data-landing-widget-id=');
      expect(first, fixture.sceneId).toContain('data-creative-motion-target=');
    }
  });

  it('builds compositions only through production widget, motion and engine configs', () => {
    for (const fixture of CREATIVE_SCENE_FIXTURES) {
      expect(buildCreativeSceneWidgets(fixture).length, fixture.sceneId).toBeGreaterThan(0);
      expect(buildCreativeSceneMotion(fixture).id, fixture.sceneId).toBeTruthy();
      const expectedEngine = CREATIVE_SCENE_CATALOG[fixture.sceneId].advancedModule;
      expect(buildCreativeSceneEngine(fixture)?.engineId ?? null, fixture.sceneId).toBe(
        expectedEngine,
      );
    }
  });

  it('keeps actions, labels and chapter content in DOM without advanced engines', () => {
    const fixture = createCreativeSceneFixture('scene-product-orbit');
    const markup = renderToStaticMarkup(
      <CreativeSceneRenderer
        config={fixture}
        capabilities={{ server: false, advancedEngines: false }}
      />,
    );
    expect(markup).toContain('Explore every important angle');
    expect(markup).toContain('Learn more');
    expect(markup).toContain('data-creative-scene-projection="fallback"');
    expect(markup).toContain('data-creative-semantic-callouts=');
  });

  it('fails closed for an invalid host while preserving ordinary document children', () => {
    const fixture = createCreativeSceneFixture('scene-layered-hero');
    const markup = renderToStaticMarkup(
      <CreativeSceneCompositionHost
        experienceMode="site"
        scenes={[fixture, fixture, fixture, fixture]}
      >
        <main>Safe document content</main>
      </CreativeSceneCompositionHost>,
    );
    expect(markup).toContain('data-invalid-scene-count="4"');
    expect(markup).not.toContain('data-creative-scene-id=');
    expect(markup).toContain('Safe document content');
  });

  it.each([
    ['server', { server: true }],
    ['print', { server: false, print: true }],
    ['forced-colors', { server: false, forcedColors: true }],
    ['reduced-data', { server: false, reducedData: true }],
    ['reduced-motion', { server: false, reducedMotion: true }],
    ['phone', { server: false, viewport: 'phone' as const }],
    ['offscreen', { server: false, visible: false }],
    ['budget', { server: false, budgetEligible: false }],
  ])('uses the semantic %s projection without advanced rendering', (reason, capabilities) => {
    const projection = resolveCreativeSceneProjection(
      createCreativeSceneFixture('scene-product-orbit'),
      capabilities,
    );
    expect(projection).toMatchObject({
      mode: 'fallback',
      reason,
      renderAdvancedModule: false,
    });
  });
});
