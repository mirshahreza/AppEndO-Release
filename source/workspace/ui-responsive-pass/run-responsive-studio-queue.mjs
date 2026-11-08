/**
 * Full studio responsive capture (phone/tablet/desktop per route).
 * Usage: node workspace/ui-responsive-pass/run-responsive-studio-queue.mjs
 * Env: CAPTURE_PACKAGES=1
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendLog,
  assertClean,
  collect,
  launchOptions,
  loadProgress,
  loginViaApi,
  resetHits,
  saveProgress,
  DEFAULT_BASE,
  DEFAULT_CULTURE,
} from '../qa-runners/lib.mjs';
import { studioRoutesForCapture } from '../qa-runners/studio-routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, 'screenshots');
const PROGRESS = join(__dirname, 'progress.json');
const LOG = join(__dirname, 'run.log');
const BASE = process.env.APPENDO_URL ?? DEFAULT_BASE;
const CULTURE = process.env.RESPONSIVE_CULTURE ?? DEFAULT_CULTURE;

const VIEWPORTS = [
  { id: 'phone', width: 390, height: 844 },
  { id: 'tablet', width: 834, height: 1194 },
  { id: 'desktop', width: 1280, height: 800 },
];

const routes = studioRoutesForCapture({ packages: process.env.CAPTURE_PACKAGES === '1' });

if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const progress = loadProgress(PROGRESS);
const browser = await chromium.launch(launchOptions());
const context = await browser.newContext();
await loginViaApi(context, BASE);
const page = await context.newPage();
const hits = collect(page);

for (const route of routes) {
  const slug = route.replace(/\//g, '-').replace(/^-/, '') || 'root';
  for (const vp of VIEWPORTS) {
    const key = `responsive:${slug}:${vp.id}`;
    if (progress.done[key]?.status === 'PASS') continue;
    resetHits(hits);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const res = await page.goto(`${BASE}/${CULTURE}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    if (res && res.status() === 404) {
      progress.done[key] = { status: 'skip', reason: '404' };
      saveProgress(PROGRESS, progress);
      appendLog(LOG, `skip ${key} 404`);
      continue;
    }
    try {
      assertClean(hits, await page.locator('body').innerText());
      const file = join(SHOTS, `responsive-${slug}-${vp.id}.png`);
      await page.screenshot({ path: file, fullPage: true });
      progress.done[key] = { status: 'PASS', file };
      appendLog(LOG, `PASS ${key}`);
    } catch (err) {
      progress.done[key] = { status: 'FAIL', error: String(err.message) };
      progress.fails.push({ key, error: String(err.message) });
      appendLog(LOG, `FAIL ${key} ${err.message}`);
    }
    saveProgress(PROGRESS, progress);
  }
}

await browser.close();
appendLog(LOG, `Done studio responsive queue. fails=${progress.fails.length}`);
