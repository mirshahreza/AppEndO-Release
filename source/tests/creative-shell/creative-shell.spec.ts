import { expect, test } from 'playwright/test';
import type { Page } from 'playwright/test';

async function openHarness(page: Page) {
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.creativeGateReady))
    .toBe('true');
}

async function createShell(page: Page) {
  await page.getByRole('button', { name: 'Create shell' }).click();
  await expect(page.getByRole('heading', { name: 'Deterministic creative shell' })).toBeVisible();
}

async function semanticViolations(page: Page) {
  return page.evaluate(() => {
    const violations: string[] = [];
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const name = (element: Element) => {
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        return labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
      }
      return (
        element.getAttribute('aria-label') ??
        element.getAttribute('alt') ??
        element.textContent ??
        ''
      ).trim();
    };

    if (document.querySelectorAll('main').length !== 1) violations.push('landmark:main-count');
    if (document.querySelectorAll('h1').length < 1) violations.push('heading:h1-missing');
    document.querySelectorAll('nav').forEach((nav, index) => {
      if (!name(nav)) violations.push(`landmark:nav-${index}-unlabelled`);
    });

    let previousHeading = 0;
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
      if (!visible(heading)) return;
      const level = Number(heading.tagName.slice(1));
      if (previousHeading && level > previousHeading + 1) {
        violations.push(`heading:skipped-${previousHeading}-to-${level}`);
      }
      previousHeading = level;
    });

    const ids = new Set<string>();
    document.querySelectorAll('[id]').forEach((element) => {
      if (ids.has(element.id)) violations.push(`id:duplicate-${element.id}`);
      ids.add(element.id);
    });
    document.querySelectorAll('img').forEach((image, index) => {
      if (!image.hasAttribute('alt')) violations.push(`image:${index}-missing-alt`);
    });
    document.querySelectorAll('canvas').forEach((canvas, index) => {
      if (canvas.getAttribute('aria-hidden') !== 'true') {
        violations.push(`canvas:${index}-not-decorative`);
      }
    });
    document.querySelectorAll('button,a[href],input,select,textarea').forEach((control, index) => {
      if (!visible(control) || (control as HTMLInputElement).type === 'hidden') return;
      if (!name(control) && !(control instanceof HTMLInputElement && control.labels?.length)) {
        violations.push(`control:${index}-unnamed`);
      }
      if (control.closest('[aria-hidden="true"]')) {
        violations.push(`control:${index}-inside-aria-hidden`);
      }
      const target = control instanceof HTMLInputElement && control.labels?.[0]
        ? control.labels[0].getBoundingClientRect()
        : control.getBoundingClientRect();
      if (target.width < 24 || target.height < 24) {
        violations.push(`target:${index}-${Math.round(target.width)}x${Math.round(target.height)}`);
      }
    });
    document.querySelectorAll('input:not([type="hidden"]),select,textarea').forEach((control, index) => {
      const input = control as HTMLInputElement;
      if (!input.labels?.length && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
        violations.push(`field:${index}-unlabelled`);
      }
    });
    return violations;
  });
}

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

test('create, edit, preview, and deterministic fallback flow', async ({ page }) => {
  await createShell(page);

  const name = page.getByLabel('Display name');
  await name.fill('Edited deterministic shell');
  await page.getByLabel('Creative scene').selectOption('scene-product-orbit');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status')).toHaveText('Draft saved.');

  await page.getByRole('button', { name: 'Open preview' }).click();
  await expect(page.getByRole('heading', { name: 'Runtime-parity preview' })).toBeVisible();
  await expect(page.locator('[data-creative-scene-id="scene-product-orbit"]')).toBeVisible();
  await expect(page.locator('[data-creative-scene-projection="primary"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Return to editor' }).click();
  await page.getByRole('button', { name: 'Use deterministic fallback' }).click();
  await expect(page.locator('[data-creative-scene-projection="fallback"]')).toHaveCount(1);
  await expect(page.locator('[data-visual-engine-fallback]')).toBeVisible();
});

test('keyboard order, skip link, Escape, and focus return', async ({ page, browserName }) => {
  const skipLink = page.getByRole('link', { name: 'Skip to creative shell content' });
  if (browserName === 'webkit') {
    // Headless WebKit inherits Safari's OS-level setting that excludes links from Tab.
    // Verify document order explicitly, then enter the same keyboard flow at the link.
    expect(await skipLink.evaluate((node) => {
      const focusable = [...document.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      return focusable[0] === node && node.tabIndex === 0;
    })).toBe(true);
    await skipLink.focus();
  } else {
    await page.keyboard.press('Tab');
  }
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  const trigger = page.getByRole('button', { name: 'Account menu', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
});

test('axe-equivalent semantic assertions have no violations', async ({ page }) => {
  await createShell(page);
  await page.getByRole('button', { name: 'Open preview' }).click();
  expect(await semanticViolations(page)).toEqual([]);
});

test('Canvas context loss retries once then exposes a permanent fallback', async ({ page }) => {
  await createShell(page);
  const host = page.locator('[data-creative-scene-host]');
  await expect(host).toHaveAttribute('data-runtime-ready', 'true');
  await page.locator('canvas[data-visual-engine-canvas]').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(host).toHaveAttribute('data-fallback-reason', 'context-lost');
  await expect(page.locator('[data-visual-engine-fallback]')).toBeVisible();
});

test('320px reflow has no two-dimensional page scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await createShell(page);
  await page.getByRole('button', { name: 'Open preview' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('200% text resize preserves content and horizontal reflow', async ({ page }) => {
  await createShell(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(page.getByRole('button', { name: 'Open preview' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('400% zoom-equivalent 1280-to-320 CSS viewport preserves the flow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await createShell(page);
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    mainVisible: document.querySelector('main')?.getBoundingClientRect().width ?? 0,
  }));
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.mainVisible).toBeGreaterThan(0);
});

test.describe('preference fallbacks', () => {
  test('reduced motion selects static output and suppresses animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHarness(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
      true,
    );
    await createShell(page);
    await expect(page.locator('[data-creative-scene-fallback-reason="reduced-motion"]')).toHaveCount(1);
    const duration = await page.locator('[data-creative-scene-id]').evaluate(
      (node) => getComputedStyle(node).animationDuration,
    );
    const durationMs = duration.endsWith('ms')
      ? Number.parseFloat(duration)
      : Number.parseFloat(duration) * 1_000;
    expect(durationMs).toBeLessThanOrEqual(0.001);
  });
});

test.describe('forced color fallback', () => {
  test('forced colors preserves semantics and selects a non-engine projection', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await openHarness(page);
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    await createShell(page);
    await expect(page.locator('[data-creative-scene-fallback-reason="forced-colors"]')).toHaveCount(1);
    expect(await semanticViolations(page)).toEqual([]);
  });
});

test('fixed profile performance uses five runs and gates the median', async ({ page }) => {
  const samples: Array<{ readyMs: number; longTasks: number; layoutShift: number }> = [];
  for (let run = 0; run < 5; run += 1) {
    await page.goto(`/?performance-run=${run}`, { waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.creativeGateReady))
      .toBe('true');
    samples.push(
      await page.evaluate(() => {
        const ready = performance.getEntriesByName('creative-shell-ready').at(-1);
        return {
          readyMs: ready?.startTime ?? Number.POSITIVE_INFINITY,
          longTasks: window.__creativeGateMetrics?.longTasks ?? 0,
          layoutShift: window.__creativeGateMetrics?.layoutShift ?? 0,
        };
      }),
    );
  }
  const median = <Key extends keyof (typeof samples)[number]>(key: Key) =>
    [...samples].sort((left, right) => left[key] - right[key])[Math.floor(samples.length / 2)][key];

  expect(samples).toHaveLength(5);
  expect(median('readyMs')).toBeLessThan(2_500);
  expect(median('longTasks')).toBeLessThanOrEqual(2);
  expect(median('layoutShift')).toBeLessThanOrEqual(0.1);
});
