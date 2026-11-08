/**
 * Studio smoke queue runner (users → end). Uses cookie login + console capture.
 * Usage: node workspace/smoke-pass/run-studio-queue.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  appendLog,
  launchOptions,
  loadProgress,
  loginViaApi as loginShared,
  saveProgress,
} from '../qa-runners/lib.mjs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.APPENDO_URL ?? 'http://127.0.0.1:3200';
const CULTURE = 'us';

const START_FROM = process.env.SMOKE_FROM ?? 'dashboard';

const QUEUE_ALL = [
  { pageKey: 'dashboard', route: '/studio', tiers: 'T0-T1' },
  { pageKey: 'users', route: '/studio/users', tiers: 'T0-T3', t3: null },
  { pageKey: 'server-functions', route: '/studio/server-functions', tiers: 'T0-T3', t3: '/studio/server-functions/edit/new' },
  { pageKey: 'package-manager', route: '/studio/package-manager', tiers: 'T0-T2', t2: ['Build a new package'] },
  { pageKey: 'roles', route: '/studio/roles', tiers: 'T0-T2', t2: ['Add Role'] },
  { pageKey: 'base-info', route: '/studio/base-info', tiers: 'T0-T2', t2: ['Create'] },
  { pageKey: 'logs', route: '/studio/logs', tiers: 'T0-T2' },
  { pageKey: 'record-events', route: '/studio/record-events', tiers: 'T0-T2' },
  { pageKey: 'in-app-notifications', route: '/studio/in-app-notifications', tiers: 'T0-T2' },
  { pageKey: 'chat-history', route: '/studio/chat-history', tiers: 'T0-T2' },
  { pageKey: 'libraries', route: '/studio/libraries', tiers: 'T0-T2', t2: ['Install'] },
  { pageKey: 'jobs', route: '/studio/jobs', tiers: 'T0-T2', t2: ['Enqueue'] },
  { pageKey: 'cache', route: '/studio/cache', tiers: 'T0-T2' },
  { pageKey: 'scheduled-tasks', route: '/studio/scheduled-tasks', tiers: 'T0-T2', t2: ['Create'] },
  { pageKey: 'data-sources', route: '/studio/data-sources', tiers: 'T0-T2', t2: ['Create'] },
  { pageKey: 'my-apis', route: '/studio/my-apis', tiers: 'T0-T2' },
  { pageKey: 'my-feedback', route: '/studio/my-feedback', tiers: 'T0-T2' },
  { pageKey: 'my-messages', route: '/studio/my-messages', tiers: 'T0-T2' },
  { pageKey: 'feedback-inbox', route: '/studio/feedback-inbox', tiers: 'T0-T2' },
  { pageKey: 'platform-portals', route: '/studio/platform-portals', tiers: 'T0-T2', t2: ['Add portal'] },
  { pageKey: 'platform-navigations', route: '/studio/platform-navigations', tiers: 'T0-T2', t2: ['Add navigation'] },
  { pageKey: 'file-manager', route: '/studio/file-manager', tiers: 'T0-T2' },
  { pageKey: 'git', route: '/studio/git', tiers: 'T0-T2' },
  { pageKey: 'workbooks', route: '/studio/workbooks', tiers: 'T0-T3', t3: '/studio/workbooks/edit/new', t2: ['Create'] },
  { pageKey: 'my-workbooks', route: '/studio/my-workbooks', tiers: 'T0-T2' },
  { pageKey: 'workflows', route: '/studio/workflows', tiers: 'T0-T3', t3: '/studio/workflows/edit/new', t2: ['Create'] },
  { pageKey: 'work-items', route: '/studio/work-items', tiers: 'T0-T2' },
  { pageKey: 'idea-foundry', route: '/studio/idea-foundry', tiers: 'T0-T3', t3: '/studio/idea-foundry/edit/new', t2: ['Create'] },
  { pageKey: 'component-designer', route: '/studio/component-designer', tiers: 'T0-T2' },
  { pageKey: 'client-components', route: '/studio/client-components', tiers: 'T0-T3', t3: '/studio/client-components/edit/new', t2: ['Create'] },
  { pageKey: 'settings', route: '/studio/settings', tiers: 'T0-T2', t2: ['AI Models'] },
  { pageKey: 'organization-chart', route: '/studio/organization-chart', tiers: 'T0-T2' },
  { pageKey: 'geographic-divisions', route: '/studio/geographic-divisions', tiers: 'T0-T2' },
  { pageKey: 'data-studio', route: '/studio/data-studio', tiers: 'T0-T3', t3: null },
  { pageKey: 'sql-console', route: '/studio/sql-console', tiers: 'T0-T1' },
  { pageKey: 'api-talk', route: '/studio/api-talk', tiers: 'T0-T1' },
  { pageKey: 'appearance', route: '/studio/appearance', tiers: 'T0-T2' },
  { pageKey: 'base-components', route: '/studio/base-components', tiers: 'T0-T2' },
  { pageKey: 'dev-reference', route: '/studio/dev-reference', tiers: 'T0-T1' },
  { pageKey: 'platform-transfer', route: '/studio/platform-transfer', tiers: 'T0-T1' },
];

const startIdx = QUEUE_ALL.findIndex((e) => e.pageKey === START_FROM);
const QUEUE_CORE = startIdx >= 0 ? QUEUE_ALL.slice(startIdx) : QUEUE_ALL;

/** Installed package / hub routes (see ROUTES.md §Package). */
const PACKAGE_QUEUE = [
  { pageKey: 'cms-contents-list', route: '/studio/cms/contents', tiers: 'T0-T2', t2: ['Create'] },
  { pageKey: 'cms-contents-edit-new', route: '/studio/cms/contents/edit/new', tiers: 'T0-T3' },
  { pageKey: 'cms-settings', route: '/studio/cms/settings', tiers: 'T0-T2' },
  { pageKey: 'cms-settings-types', route: '/studio/cms/settings/content-types', tiers: 'T0-T2' },
  { pageKey: 'cms-redirect', route: '/studio/cms', tiers: 'T0-T1' },
  { pageKey: 'ssh-hub', route: '/studio/ssh', tiers: 'T0-T2', t2: ['Create'] },
  { pageKey: 'file-hub-sftp', route: '/studio/sftp', tiers: 'T0-T2', t2: ['Create'] },
  { pageKey: 'rdp-hub', route: '/studio/rdp', tiers: 'T0-T2', t2: ['Create'] },
];

const RUN_PACKAGES = process.env.SMOKE_PACKAGES === '1';
const QUEUE = RUN_PACKAGES ? PACKAGE_QUEUE : QUEUE_CORE;

const IGNORE = [
  /Download the React DevTools/,
  /\[culture\] Missing translation key.*dev-reference/,
  /favicon\.ico/,
];

function filterMsg(text) {
  return !IGNORE.some((re) => re.test(text));
}

async function loginViaApi(context) {
  const password = process.env.APPENDO_SMOKE_PASSWORD ?? 'AdminSmoke123!';
  const attempts = [
    { identifier: 'admin@append.os', password },
    { identifier: 'admin', password },
    { email: 'admin@append.os', password },
  ];
  for (const data of attempts) {
    const res = await context.request.post(`${BASE}/api/auth/login`, { data });
    if (res.ok()) {
      const me = await context.request.get(`${BASE}/api/auth/me`);
      if (me.ok()) return;
    }
  }
  const page = await context.newPage();
  await page.goto(`${BASE}/${CULTURE}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: /username|email|identifier/i }).first().fill('admin');
  await page.locator('input[name="password"], input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});
  await page.close();
  const me = await context.request.get(`${BASE}/api/auth/me`);
  if (!me.ok()) {
    throw new Error('Login failed — set APPENDO_SMOKE_PASSWORD to your dev admin password.');
  }
}

function collect(page) {
  const hits = { console: [], pageErrors: [], rejections: [] };
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (!filterMsg(text)) return;
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

function rank(hits, bodyText) {
  const bad = /Unexpected Application Error|Something went wrong|Minified React error|This page failed to load|ReferenceError:/.test(bodyText);
  const p0Console = hits.console.filter((c) => {
    if (c.level !== 'error') return false;
    if (/Failed to load resource: the server responded with a status of 404/.test(c.text)) return false;
    if (/\[PackageSlotRegistry\]/.test(c.text)) return false;
    if (/Failed to load resource: the server responded with a status of 500/.test(c.text) && !bad) return false;
    return true;
  });
  const p1Warn = hits.console.filter((c) => c.level === 'warn' && !/\[culture\] Missing translation key/.test(c.text));
  if (bad || hits.pageErrors.length || p0Console.length) return { status: 'FAIL', p0: true, hits };
  if (p1Warn.length) return { status: 'PASS', p0: false, p1: p1Warn.length, hits };
  return { status: 'PASS', p0: false, hits };
}

async function tryT2(page, labels) {
  for (const label of labels) {
    const btn = page.getByRole('button', { name: label, exact: true }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(800);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      return label;
    }
  }
  return 'skip';
}

async function runPage(context, entry) {
  let page = await context.newPage();
  const hits = collect(page);

  const url = `${BASE}/${CULTURE}${entry.route}`;
  const result = { pageKey: entry.pageKey, url, tiers: entry.tiers, notes: [] };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2200);
    let bodyText = await page.locator('body').innerText();
    let r = rank(hits, bodyText);
    if (r.status === 'FAIL') {
      result.status = 'FAIL';
      result.errors = r.hits;
      await page.screenshot({ path: join(__dirname, `${entry.pageKey}-smoke-fail.png`), fullPage: false });
      await page.close();
      return result;
    }

    if (entry.t2?.length) {
      const probe = await tryT2(page, entry.t2);
      result.notes.push(`T2:${probe}`);
      bodyText = await page.locator('body').innerText();
      r = rank(hits, bodyText);
      if (r.status === 'FAIL') {
        result.status = 'FAIL';
        result.errors = r.hits;
        await page.screenshot({ path: join(__dirname, `${entry.pageKey}-smoke-t2-fail.png`) });
        await page.close();
        return result;
      }
    }

    if (entry.t3) {
      await page.goto(`${BASE}/${CULTURE}${entry.t3}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      bodyText = await page.locator('body').innerText();
      r = rank(hits, bodyText);
      if (r.status === 'FAIL') {
        result.status = 'FAIL';
        result.errors = r.hits;
        result.notes.push(`T3 fail ${entry.t3}`);
        await page.screenshot({ path: join(__dirname, `${entry.pageKey}-smoke-t3-fail.png`) });
        await page.close();
        return result;
      }
      result.notes.push('T3:ok');
    } else if (entry.tiers.includes('T3') && entry.pageKey === 'data-studio') {
      result.notes.push('T3:skip (no fixture object)');
    } else if (entry.pageKey === 'users') {
      result.notes.push('T3:skip (no nested editor URL)');
    }

    result.status = 'PASS';
    if (r.p1) result.notes.push(`P2 warns:${r.p1}`);
  } catch (err) {
    result.status = 'FAIL';
    result.errors = { message: String(err.message || err) };
  } finally {
    await page.close().catch(() => {});
  }
  return result;
}

const PROGRESS = join(__dirname, 'progress.json');
const LOG = join(__dirname, 'run.log');
const progress = loadProgress(PROGRESS);

const browser = await chromium.launch(launchOptions());
const context = await browser.newContext({ baseURL: `${BASE}/${CULTURE}` });
await loginShared(context, BASE);
const results = [];
for (const entry of QUEUE) {
  const key = `smoke:${entry.pageKey}`;
  if (progress.done[key]?.status === 'PASS') {
    process.stdout.write(`[smoke] ${entry.pageKey}… skip-done\n`);
    continue;
  }
  process.stdout.write(`[smoke] ${entry.pageKey}… `);
  const r = await runPage(context, entry);
  results.push(r);
  progress.done[key] = { status: r.status, notes: r.notes, at: new Date().toISOString() };
  if (r.status === 'FAIL') progress.fails.push({ key, errors: r.errors });
  saveProgress(PROGRESS, progress);
  appendLog(LOG, `${entry.pageKey} ${r.status}`);
  process.stdout.write(`${r.status}\n`);
}
await context.close();
await browser.close();

const outPath = join(__dirname, RUN_PACKAGES ? 'queue-results-packages.json' : 'queue-results.json');
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`Wrote ${outPath}`);
