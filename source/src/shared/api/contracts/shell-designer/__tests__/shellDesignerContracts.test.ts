import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import generatedShellRecipeSchema from '../generated/shellRecipe.schema.json';
import { shellRecipeV1Schema } from '../schemas';
import { semantic, validShellRecipe, visibility } from './shellDesignerTestFixture';

describe('Shell recipe contracts', () => {
  it('keeps the generated Draft 2020-12 schema strict', () => {
    const validate = new Ajv2020({ strict: false }).compile(generatedShellRecipeSchema);
    expect(validate(validShellRecipe())).toBe(true);
    expect(validate({ ...validShellRecipe(), rawCss: '.shell{}' })).toBe(false);
  });

  it('accepts a strict valid app recipe', () => {
    expect(shellRecipeV1Schema.safeParse(validShellRecipe()).success).toBe(true);
  });

  it('rejects unknown keys and stale hidden-region options', () => {
    const unknown = validShellRecipe() as Record<string, unknown>;
    unknown.rawCss = '.shell{}';
    expect(shellRecipeV1Schema.safeParse(unknown).success).toBe(false);

    const hidden = validShellRecipe();
    hidden.regions.hero = { presence: 'hidden', mode: 'compact' } as never;
    expect(shellRecipeV1Schema.safeParse(hidden).success).toBe(false);
  });

  it('rejects incompatible navigation branches and missing route outlet', () => {
    const branch = validShellRecipe();
    (branch.navigation as typeof branch.navigation & { top: unknown }).top = {
      mode: 'standard',
      componentId: 'core:TopBarNav',
      density: 'default',
      alignment: 'start',
    } as never;
    expect(shellRecipeV1Schema.safeParse(branch).success).toBe(false);

    const outlet = validShellRecipe();
    outlet.regions.content.routeOutlet.count = 2 as never;
    expect(shellRecipeV1Schema.safeParse(outlet).success).toBe(false);
  });

  it('rejects unsafe assets, executable links and raw style/source fields', () => {
    const asset = validShellRecipe();
    asset.visual.logo.main = { source: 'local-asset', assetRef: 'https://example.com/logo.svg' } as never;
    expect(shellRecipeV1Schema.safeParse(asset).success).toBe(false);

    const href = validShellRecipe();
    (href.visual.logo as typeof href.visual.logo & { href: string }).href = 'javascript:alert(1)';
    expect(shellRecipeV1Schema.safeParse(href).success).toBe(false);

    const effect = validShellRecipe();
    effect.visual.effects.layers.push({
      id: 'layer-test',
      effectId: 'section-reveal',
      target: 'content-host',
      plane: 'background',
      palette: [semantic],
      intensity: 'subtle',
      speed: 'slow',
      density: 'sparse',
      scale: 'md',
      direction: 'forward',
      opacity: 'subtle',
      blend: 'normal',
      interaction: 'none',
      seed: 1,
      visibility,
      config: {
        style: 'fade',
        distance: 0,
        stagger: 0,
        threshold: 0.1,
        once: true,
        css: 'display:none',
      },
    } as never);
    expect(shellRecipeV1Schema.safeParse(effect).success).toBe(false);
  });

  it.each([
    ['raw HTML', 'rawHtml', '<script>alert(1)</script>'],
    ['raw CSS', 'rawCss', '.shell{display:none}'],
    ['Tailwind classes', 'className', 'fixed inset-0'],
    ['JavaScript', 'javascript', 'globalThis.fetch("/")'],
    ['GLSL', 'fragmentShader', 'void main(){gl_FragColor=vec4(1.0);}'],
    ['module identifier', 'modulePath', 'https://cdn.test/runtime.mjs'],
  ])('rejects authored %s fields throughout Creative config', (_label, field, value) => {
    const recipe = validShellRecipe();
    recipe.visual.creative.widgets.push({
      instanceId: 'creative-test',
      widgetId: 'landing-feature-grid',
      host: 'content',
      [field]: value,
    } as never);
    expect(shellRecipeV1Schema.safeParse(recipe).success).toBe(false);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.test/id',
    '//attacker.test/logo',
  ])('rejects executable or scheme-relative URL %s', (unsafeHref) => {
    const recipe = validShellRecipe();
    (recipe.visual.logo as typeof recipe.visual.logo & { href: string }).href = unsafeHref;
    expect(shellRecipeV1Schema.safeParse(recipe).success).toBe(false);
  });

  it('requires a readability treatment over gradients and patterns', () => {
    const recipe = validShellRecipe();
    recipe.visual.backdrop = {
      mode: 'gradient',
      baseColor: semantic,
      gradient: {
        type: 'linear',
        direction: 'top-end',
        stops: [
          { color: semantic, position: 0 },
          { color: { source: 'semantic', token: 'accent' }, position: 100 },
        ],
        intensity: 'strong',
      },
    } as never;
    expect(shellRecipeV1Schema.safeParse(recipe).success).toBe(false);
    recipe.regions.header.readability = 'auto-scrim';
    recipe.regions.sidebar.readability = 'solid-panel';
    recipe.regions.content.readability = 'solid-panel';
    expect(shellRecipeV1Schema.safeParse(recipe).success).toBe(true);
  });

  it('enforces site-primary Creative compatibility in app mode', () => {
    const app = validShellRecipe();
    app.visual.creative.widgets.push({
      instanceId: 'hero-split',
      widgetId: 'landing-hero-split',
      host: 'content',
    } as never);
    expect(shellRecipeV1Schema.safeParse(app).success).toBe(false);

    const site = validShellRecipe();
    site.experienceMode = 'site' as never;
    site.recipeId = 'site-dashboard' as never;
    site.visual.creative.widgets = app.visual.creative.widgets;
    expect(shellRecipeV1Schema.safeParse(site).success).toBe(true);
  });
});
