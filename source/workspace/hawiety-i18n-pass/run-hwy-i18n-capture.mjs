/**
 * Hawiety i18n capture queue (iq/ir). Agent patches keys after reviewing PNGs.
 * Usage: node workspace/hawiety-i18n-pass/run-hwy-i18n-capture.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendLog,
  collect,
  launchOptions,
  loadProgress,
  loginViaApi,
  resetHits,
  saveProgress,
  DEFAULT_BASE,
} from '../qa-runners/lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, 'screenshots');
const PROGRESS = join(__dirname, 'progress.json');
const LOG = join(__dirname, 'run.log');
const BASE = process.env.APPENDO_URL ?? DEFAULT_BASE;

const CULTURES = (process.env.HWY_CULTURES ?? 'iq,ir').split(',').map((s) => s.trim());
const ROUTES = (process.env.HWY_ROUTES ?? '/studio/hwy/members').split(',').map((s) => s.trim());

if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const progress = loadProgress(PROGRESS);
const browser = await chromium.launch(launchOptions());
const context = await browser.newContext();
await loginViaApi(context, BASE);
const page = await context.newPage();
const hits = collect(page);

for (const culture of CULTURES) {
  for (const route of ROUTES) {
    const slug = route.replace(/\//g, '-').replace(/^-/, '');
    const key = `hwy-i18n:${culture}:${slug}`;
    if (progress.done[key]?.status === 'PASS') continue;
    resetHits(hits);
    await page.goto(`${BASE}/${culture}${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    const missing = hits.console.filter((c) => /Missing translation key/.test(c.text));
    const file = join(SHOTS, `hwy-${culture}-${slug}.png`);
    await page.screenshot({ path: file, fullPage: true });
    progress.done[key] = {
      status: missing.length ? 'FAIL' : 'PASS',
      file,
      missingKeys: missing.map((m) => m.text).slice(0, 5),
    };
    if (missing.length) progress.fails.push({ key, missing: missing.length });
    if (/Hawiety|Members|English-only literal/i.test(body) && culture !== 'us') {
      /* heuristic — agent reviews screenshot */
    }
    saveProgress(PROGRESS, progress);
    appendLog(LOG, `${key} ${progress.done[key].status}`);
  }
}

await browser.close();
appendLog(LOG, `Done. fails=${progress.fails.length}`);
