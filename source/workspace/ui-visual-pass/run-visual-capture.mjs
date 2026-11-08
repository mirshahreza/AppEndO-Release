/**
 * Capture-only queue for appendo-qa-ui-visual-pass (critic stays agent-driven).
 * Usage: set VISUAL_ROUTES=/studio/users,/studio/roles  or VISUAL_PAGE_KEY=users
 *        node workspace/ui-visual-pass/run-visual-capture.mjs
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
const CULTURE = process.env.VISUAL_CULTURE ?? DEFAULT_CULTURE;

if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const routes = process.env.VISUAL_ROUTES
  ? process.env.VISUAL_ROUTES.split(',').map((s) => s.trim())
  : [`/studio/${process.env.VISUAL_PAGE_KEY ?? 'users'}`];

const progress = loadProgress(PROGRESS);
const browser = await chromium.launch(launchOptions());
const context = await browser.newContext();
await loginViaApi(context, BASE);
const page = await context.newPage();
const hits = collect(page);

for (const route of routes) {
  const slug = route.replace(/\//g, '-').replace(/^-/, '') || 'root';
  const key = `visual:${slug}:desktop`;
  if (progress.done[key]?.status === 'PASS') continue;
  resetHits(hits);
  await page.goto(`${BASE}/${CULTURE}${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  try {
    assertClean(hits, await page.locator('body').innerText());
    const file = join(SHOTS, `visual-${slug}-desktop.png`);
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
