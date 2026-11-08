import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

/**
 * Bug found: the Component Designer's Style panel assembles Tailwind utility classes at
 * *runtime* from user-picked values (`grid-cols-${cols}`, `gap-${value}`, `p-${value}`, …) —
 * reported as "the Columns property in the Columns/Row element does nothing above 6 columns."
 * Tailwind v4 has no config file and no default safelist; it only emits CSS for utility classes
 * it can see as literal text in scanned source, so most of these dynamically-assembled values
 * silently never got a CSS rule. Fixed with an explicit `@source inline()` safelist in
 * `src/index.css` covering every value the Style panel can actually produce. This test compiles
 * the real stylesheet and proves the full ranges are present, so a future edit to `index.css`
 * (or to the option lists in `inspectorRegistry.ts` / `tailwindSpacingCodec.ts` widening a scale)
 * can't silently reintroduce the gap.
 */

const require = createRequire(import.meta.url);

const loadStylesheet = async (id: string, base: string) => {
  const resolved = id.startsWith('.')
    ? path.resolve(base, id)
    : path.join(path.dirname(require.resolve(`${id}/package.json`, { paths: [base, process.cwd()] })), 'index.css');
  const content = await readFile(resolved, 'utf8');
  return { path: resolved, base: path.dirname(resolved), content };
};

const SPACING_SCALE = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];
const OPACITY_SCALE = [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100];
const BREAKPOINTS = ['', 'md:', 'lg:'];

const compileDesignerCss = async (): Promise<string> => {
  const cssPath = path.resolve(process.cwd(), 'src/index.css');
  const rawCss = await readFile(cssPath, 'utf8');
  // Only `@import "tailwindcss"` matters for verifying utility-class generation — the
  // `@heroui/react/styles` and `animate.css` imports pull in package subpaths this test's
  // minimal loadStylesheet doesn't need to (and can't easily) resolve via package `exports`.
  const css = rawCss
    .split('\n')
    .filter((line) => !/@import\s+["']@heroui\/react\/styles["']/.test(line) && !/@import\s+["']animate\.css["']/.test(line))
    .join('\n');
  const { build } = await compile(css, { base: path.dirname(cssPath), loadStylesheet });
  return build([]);
};

/** Tailwind emits `.<escaped-class-name> {` — escape `:`, `.`, and `!` the same way Tailwind does. */
const hasGeneratedRuleFor = (output: string, className: string): boolean =>
  output.includes(
    `.${className.replace(/:/g, '\\:').replace(/\./g, '\\.').replace(/!/g, '\\!')} {`,
  );

describe('Tailwind Designer safelist (src/index.css)', () => {
  it('generates CSS for every grid-cols value the Style panel can produce (1-12, all breakpoints)', async () => {
    const output = await compileDesignerCss();
    for (const prefix of BREAKPOINTS) {
      for (let n = 1; n <= 12; n += 1) {
        expect(hasGeneratedRuleFor(output, `${prefix}grid-cols-${n}`), `${prefix}grid-cols-${n} should have generated CSS`).toBe(true);
      }
    }
  });

  it('generates CSS for every opacity value on the Tailwind opacity scale', async () => {
    const output = await compileDesignerCss();
    for (const value of OPACITY_SCALE) {
      expect(hasGeneratedRuleFor(output, `opacity-${value}`), `opacity-${value} should have generated CSS`).toBe(true);
    }
  });

  it('generates CSS for every gap value on the spacing scale, at every breakpoint', async () => {
    const output = await compileDesignerCss();
    for (const prefix of BREAKPOINTS) {
      for (const value of SPACING_SCALE) {
        expect(hasGeneratedRuleFor(output, `${prefix}gap-${value}`), `${prefix}gap-${value} should have generated CSS`).toBe(true);
      }
    }
  });

  it('generates CSS for every padding/margin axis-variant across the full spacing scale, at every breakpoint', async () => {
    const output = await compileDesignerCss();
    const sampleValues = [0, 0.5, 7, 52, 96];
    const paddingAxes = ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'];
    const marginAxes = ['m', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me'];
    for (const prefix of BREAKPOINTS) {
      for (const axis of paddingAxes) {
        for (const value of sampleValues) {
          expect(hasGeneratedRuleFor(output, `${prefix}${axis}-${value}`), `${prefix}${axis}-${value} should have generated CSS`).toBe(true);
        }
      }
      for (const axis of marginAxes) {
        for (const value of [...sampleValues, 'auto']) {
          expect(hasGeneratedRuleFor(output, `${prefix}${axis}-${value}`), `${prefix}${axis}-${value} should have generated CSS`).toBe(true);
        }
      }
    }
  });

  it('generates important padding/margin variants (HeroUI chrome promotion path)', async () => {
    const output = await compileDesignerCss();
    // Designer runtime promotes fixed-scale padding/margin to `!…` so Style-panel
    // values beat HeroUI chrome — without these rules, CMS Settings General's
    // `px-5 py-6` (rendered as `!px-5 !py-6`) had no left inset while vocab
    // catalog grids (literal `px-5` in React source) looked correctly padded.
    for (const className of ['!px-5', '!py-6', '!p-4', '!ps-5', '!pe-5', '!mx-auto', '!ms-4']) {
      expect(hasGeneratedRuleFor(output, className), `${className} should have generated CSS`).toBe(true);
    }
  });
});
