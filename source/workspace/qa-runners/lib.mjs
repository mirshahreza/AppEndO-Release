/**
 * Shared Playwright helpers for long-running AppEndO QA runners.
 * See .claude/skills/BACKGROUND-EXECUTION.md
 */
import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

export const DEFAULT_BASE = process.env.APPENDO_URL ?? 'http://127.0.0.1:3200';
export const DEFAULT_CULTURE = 'us';

export const DEFAULT_IGNORE = [
  /Download the React DevTools/,
  /\[culture\] Missing translation key.*dev-reference/,
  /favicon\.ico/,
  /\[PackageSlotRegistry\]/,
];

export function loadProgress(path) {
  if (!existsSync(path)) return { done: {}, fails: [] };
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveProgress(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

export function appendLog(path, msg) {
  appendFileSync(path, `[${new Date().toISOString()}] ${msg}\n`);
}

export function collect(page, ignore = DEFAULT_IGNORE) {
  const hits = { console: [], pageErrors: [] };
  const filter = (text) => !ignore.some((re) => re.test(text));
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (!filter(text)) return;
    hits.console.push({ level: type === 'warning' ? 'warn' : 'error', text });
  });
  page.on('pageerror', (err) => {
    hits.pageErrors.push({ message: String(err.message || err) });
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    const errText = req.failure()?.errorText ?? '';
    if (errText.includes('ERR_ABORTED') || errText.includes('NS_BINDING_ABORTED')) return;
    if (url.includes('/api/')) {
      hits.console.push({ level: 'error', text: `requestfailed ${url} ${errText}` });
    }
  });
  return hits;
}

export function resetHits(hits) {
  hits.console.length = 0;
  hits.pageErrors.length = 0;
}

export function assertClean(hits, bodyText, ignore = DEFAULT_IGNORE) {
  const filter = (text) => !ignore.some((re) => re.test(text));
  const bad = /Unexpected Application Error|Something went wrong|Minified React error|ReferenceError:/.test(
    bodyText,
  );
  const p0 = hits.console.filter(
    (c) =>
      c.level === 'error' &&
      filter(c.text) &&
      !/Failed to load resource: the server responded with a status of 404/.test(c.text),
  );
  if (bad || hits.pageErrors.length || p0.length) {
    throw new Error(`P0: ${p0[0]?.text ?? hits.pageErrors[0]?.message ?? 'page error'}`);
  }
}

export async function loginViaApi(context, base = DEFAULT_BASE) {
  const password = process.env.APPENDO_SMOKE_PASSWORD ?? 'AdminSmoke123!';
  for (const data of [
    { identifier: 'admin@append.os', password },
    { identifier: 'admin', password },
  ]) {
    const res = await context.request.post(`${base}/api/auth/login`, { data });
    if (res.ok() && (await context.request.get(`${base}/api/auth/me`)).ok()) return;
  }
  throw new Error('Login failed — set APPENDO_SMOKE_PASSWORD');
}

export async function dismissOverlays(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
}

export async function resetBaseSection(page) {
  await dismissOverlays(page);
  const reset = page.getByRole('button', { name: 'Reset' }).first();
  if (await reset.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reset.click({ force: true, timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
}

export async function installBaseComponentsDock(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('appendo-base-components-properties-docked', '1');
    } catch {
      /* ignore */
    }
  });
}

export async function waitForStudioSettle(page) {
  await page.waitForSelector('[data-bc-preview-root]', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3200);
}

export function launchOptions() {
  return {
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  };
}
