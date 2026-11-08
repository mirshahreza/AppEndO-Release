/**
 * Multi-viewport capture for appendo-qa-ui-responsive-pass (critic stays agent-driven).
 * Usage: RESPONSIVE_ROUTES=/studio/users  or read RESPONSIVE_PAGE_KEY
 *        node workspace/ui-responsive-pass/run-responsive-capture.mjs
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

if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const route = process.env.RESPONSIVE_ROUTES?.split(',')[0]?.trim()
  ?? `/studio/${process.env.RESPONSIVE_PAGE_KEY ?? 'users'}`;
const slug = route.replace(/\//g, '-').replace(/^-/, '');

const progress = loadProgress(PROGRESS);
const browser = await chromium.launch(launchOptions());
const context = await browser.newContext();
await loginViaApi(context, BASE);
const page = await context.newPage();
const hits = collect(page);

for (const vp of VIEWPORTS) {
  const key = `responsive:${slug}:${vp.id}`;
  if (progress.done[key]?.status === 'PASS') continue;
  resetHits(hits);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`${BASE}/${CULTURE}${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
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

await browser.close();
appendLog(LOG, `Done. fails=${progress.fails.length}`);
