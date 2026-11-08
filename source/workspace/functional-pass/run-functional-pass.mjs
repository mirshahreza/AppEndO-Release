/**
 * Full appendo-qa-functional-pass runner (Phases 1–4 + finish gate tests).
 * Usage: node workspace/functional-pass/run-functional-pass.mjs
 * Env: APPENDO_URL, APPENDO_SMOKE_PASSWORD, FUNCTIONAL_PHASE=1|2|3|4|all
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const SHOTS = join(__dirname, 'screenshots');
const BASE = process.env.APPENDO_URL ?? 'http://127.0.0.1:3200';
const CULTURE = 'us';
const PHASE = process.env.FUNCTIONAL_PHASE ?? 'all';

if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const IGNORE = [
  /Download the React DevTools/,
  /\[culture\] Missing translation key.*dev-reference/,
  /favicon\.ico/,
  /\[PackageSlotRegistry\]/,
];

function filterMsg(text) {
  return !IGNORE.some((re) => re.test(text));
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
  const bad = /Unexpected Application Error|Something went wrong|Minified React error|This page failed to load|ReferenceError:/.test(
    bodyText,
  );
  const p0Console = hits.console.filter((c) => {
    if (c.level !== 'error') return false;
    if (/Failed to load resource: the server responded with a status of 404/.test(c.text)) return false;
    if (/Failed to load resource: the server responded with a status of 500/.test(c.text) && !bad) return false;
    return true;
  });
  if (bad || hits.pageErrors.length || p0Console.length) return { ok: false, hits, p0Console };
  return { ok: true, hits };
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
  throw new Error('Login failed — set APPENDO_SMOKE_PASSWORD');
}

async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

async function assertClean(page, hits, label) {
  const bodyText = await page.locator('body').innerText();
  const r = rank(hits, bodyText);
  if (!r.ok) {
    await shot(page, `${label}-fail.png`);
    throw new Error(`${label} P0: ${JSON.stringify(r.p0Console?.slice(0, 3) ?? r.hits.pageErrors)}`);
  }
}

function loadBaseComponentSectionIds() {
  const src = readFileSync(
    join(ROOT, 'src/features/base-components/catalog/sections/catalogSections.options.ts'),
    'utf8',
  );
  const block = src.match(/export const TARGET_BASE_COMPONENT_SECTION_IDS = \[([\s\S]*?)\] as const;/);
  if (!block) throw new Error('Could not parse TARGET_BASE_COMPONENT_SECTION_IDS');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const SETTINGS_SECTIONS = [
  'server-functions',
  'logs',
  'email',
  'pwa',
  'cache',
  'auth',
  'jwt-secrets',
  'identity-providers',
  'cultures',
  'web-fonts',
  'feedback',
  'ai-models',
  'mcp-servers',
  'eua-assist',
  'profile-fields',
  'user-attributes',
  'role-attributes',
  'session-context',
  'node-identity',
  'node-runtime',
  'platform-transfer',
];

const STUDIO_ROUTES = [
  { pageKey: 'dashboard', route: '/studio', t2: null, functional: null },
  { pageKey: 'users', route: '/studio/users', t2: ['Add Individual'], functional: 'filter' },
  { pageKey: 'server-functions', route: '/studio/server-functions', t2: ['Create'], functional: null },
  { pageKey: 'package-manager', route: '/studio/package-manager', t2: ['Build a new package'], functional: null },
  { pageKey: 'roles', route: '/studio/roles', t2: ['Add Role'], functional: 'row' },
  { pageKey: 'base-info', route: '/studio/base-info', t2: ['Create'], functional: 'tree' },
  { pageKey: 'logs', route: '/studio/logs', t2: null, functional: null },
  { pageKey: 'record-events', route: '/studio/record-events', t2: null, functional: null },
  { pageKey: 'in-app-notifications', route: '/studio/in-app-notifications', t2: null, functional: null },
  { pageKey: 'chat-history', route: '/studio/chat-history', t2: null, functional: null },
  { pageKey: 'libraries', route: '/studio/libraries', t2: ['Install'], functional: null },
  { pageKey: 'jobs', route: '/studio/jobs', t2: ['Enqueue'], functional: null },
  { pageKey: 'cache', route: '/studio/cache', t2: null, functional: 'view' },
  { pageKey: 'scheduled-tasks', route: '/studio/scheduled-tasks', t2: ['Create'], functional: null },
  { pageKey: 'data-sources', route: '/studio/data-sources', t2: ['Create'], functional: null },
  { pageKey: 'my-apis', route: '/studio/my-apis', t2: null, functional: null },
  { pageKey: 'my-feedback', route: '/studio/my-feedback', t2: null, functional: null },
  { pageKey: 'my-messages', route: '/studio/my-messages', t2: null, functional: null },
  { pageKey: 'feedback-inbox', route: '/studio/feedback-inbox', t2: null, functional: null },
  { pageKey: 'platform-portals', route: '/studio/platform-portals', t2: ['Add portal'], functional: null },
  { pageKey: 'platform-navigations', route: '/studio/platform-navigations', t2: ['Add navigation'], functional: null },
  { pageKey: 'file-manager', route: '/studio/file-manager', t2: null, functional: 'folder' },
  { pageKey: 'git', route: '/studio/git', t2: null, functional: 'branch' },
  { pageKey: 'workbooks', route: '/studio/workbooks', t2: ['Create'], functional: null },
  { pageKey: 'my-workbooks', route: '/studio/my-workbooks', t2: null, functional: null },
  { pageKey: 'workflows', route: '/studio/workflows', t2: ['Create'], functional: null },
  { pageKey: 'work-items', route: '/studio/work-items', t2: null, functional: null },
  { pageKey: 'idea-foundry', route: '/studio/idea-foundry', t2: ['Create'], functional: null },
  { pageKey: 'component-designer', route: '/studio/component-designer', t2: null, functional: 'list' },
  { pageKey: 'client-components', route: '/studio/client-components', t2: ['Create'], functional: null },
  { pageKey: 'settings', route: '/studio/settings', t2: null, functional: null },
  { pageKey: 'organization-chart', route: '/studio/organization-chart', t2: null, functional: null },
  { pageKey: 'geographic-divisions', route: '/studio/geographic-divisions', t2: null, functional: null },
  { pageKey: 'data-studio', route: '/studio/data-studio', t2: null, functional: 'tree' },
  { pageKey: 'sql-console', route: '/studio/sql-console', t2: null, functional: 'editor' },
  { pageKey: 'api-talk', route: '/studio/api-talk', t2: null, functional: null },
  { pageKey: 'appearance', route: '/studio/appearance', t2: null, functional: null },
  { pageKey: 'base-components', route: '/studio/base-components', t2: null, functional: null },
  { pageKey: 'dev-reference', route: '/studio/dev-reference', t2: null, functional: null },
  { pageKey: 'platform-transfer', route: '/studio/platform-transfer', t2: null, functional: null },
];

const PACKAGE_ROUTES = [
  { pageKey: 'cms-contents-list', route: '/studio/cms/contents', t2: ['Create'] },
  { pageKey: 'cms-settings', route: '/studio/cms/settings', t2: null },
  { pageKey: 'ssh-hub', route: '/studio/ssh', t2: ['Create'] },
  { pageKey: 'file-hub-sftp', route: '/studio/sftp', t2: ['Create'] },
  { pageKey: 'rdp-hub', route: '/studio/rdp', t2: ['Create'] },
];

const results = { phase1: [], phase2: [], phase3: [], phase4: [], fixes: [] };

async function restorePortalRail(context) {
  await context.request.put(`${BASE}/api/appearance/portal-defaults/studio`, {
    data: { sidebarCollapsePolicy: 'rail' },
  });
}

async function runAppearance(context) {
  const page = await context.newPage();
  const hits = collect(page);
  const url = `${BASE}/${CULTURE}/studio/appearance`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await assertClean(page, hits, 'appearance-shell-baseline');
  await shot(page, 'appearance-shell-baseline.png');

  await page.locator('main').getByLabel(/Accent color/i).first().click();
  await page.getByRole('button', { name: /Green — Core/ }).click();
  await page.waitForTimeout(600);
  await shot(page, 'appearance-accent-matrix.png');

  const startSwitch = page.getByRole('switch', { name: 'Start with sidebar collapsed' });
  if (await startSwitch.isVisible().catch(() => false)) {
    await startSwitch.click({ force: true });
    await page.waitForTimeout(400);
    await startSwitch.click({ force: true });
    await page.waitForTimeout(400);
    await shot(page, 'appearance-start-collapsed-dirty.png');
  }

  const widthSelect = page.getByRole('combobox', { name: 'Page width' });
  await widthSelect.selectOption('fluid');
  await page.waitForTimeout(800);
  await shot(page, 'appearance-width-fluid-preview.png');
  const saveMe = page.getByRole('button', { name: 'Save my preferences' });
  if (await saveMe.isEnabled().catch(() => false)) {
    await saveMe.click();
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await shot(page, 'appearance-width-fluid-saved.png');
  }

  await widthSelect.selectOption('bounded');
  await page.waitForTimeout(500);
  if (await saveMe.isEnabled().catch(() => false)) {
    await saveMe.click();
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }
  await shot(page, 'appearance-width-bounded-saved.png');

  const resetBtn = page.getByRole('button', { name: 'Reset to portal default' });
  if (await resetBtn.isEnabled().catch(() => false)) {
    await resetBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, 'appearance-reset-user.png');
  }

  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.waitForTimeout(800);
  await shot(page, 'appearance-sidebar-rail.png');
  await page.getByRole('button', { name: 'Expand sidebar' }).click().catch(async () => {
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  });
  await page.waitForTimeout(800);
  await shot(page, 'appearance-sidebar-expanded.png');

  const portalCollapsed = page.getByRole('switch', { name: 'Default sidebar collapsed' });
  await portalCollapsed.click({ force: true });
  await page.waitForTimeout(400);
  await shot(page, 'appearance-portal-dirty.png');

  await page.getByRole('combobox', { name: 'Sidebar collapse policy' }).selectOption('hidden');
  const savePortal = page.getByRole('button', { name: 'Save portal defaults' });
  if (await savePortal.isEnabled().catch(() => false)) {
    await savePortal.click();
    await page.waitForTimeout(1500);
  }
  await shot(page, 'appearance-portal-hidden-policy.png');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click().catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, 'appearance-hidden-collapsed.png');
  const navMenu = page.getByRole('button', { name: /Open navigation menu/i });
  if (await navMenu.isVisible().catch(() => false)) {
    await navMenu.click();
    await page.waitForTimeout(800);
    await shot(page, 'appearance-hidden-menu-open.png');
    await page.keyboard.press('Escape');
  }

  await page.getByRole('combobox', { name: 'Sidebar collapse policy' }).selectOption('rail');
  if (await savePortal.isEnabled().catch(() => false)) {
    await savePortal.click();
    await page.waitForTimeout(1200);
  }
  await shot(page, 'appearance-portal-rail-restored.png');

  const defaultBounded = page.getByRole('switch', { name: 'Default bounded page width' });
  await defaultBounded.click({ force: true });
  await page.waitForTimeout(400);
  if (await savePortal.isEnabled().catch(() => false)) {
    await savePortal.click();
    await page.waitForTimeout(1200);
  }
  await shot(page, 'appearance-portal-bounded-default.png');

  const headerWidth = page.getByTestId('shell-page-width-header-control');
  if (await headerWidth.isVisible().catch(() => false)) {
    await headerWidth.click();
    await page.waitForTimeout(600);
    await headerWidth.click();
    await shot(page, 'appearance-header-width-toggle.png');
  }

  await defaultBounded.click({ force: true });
  if (await savePortal.isEnabled().catch(() => false)) {
    await savePortal.click();
    await page.waitForTimeout(1200);
  }
  await shot(page, 'appearance-header-control-hidden-fluid-portal.png');

  await page.getByRole('radio', { name: 'Atmosphere tokens' }).click();
  await page.waitForTimeout(1500);
  await assertClean(page, hits, 'appearance-atmosphere');
  await shot(page, 'appearance-atmosphere-overview.png');

  const geoSwitch = page.getByRole('switch', { name: /Geometric shapes/i }).first();
  if (await geoSwitch.isVisible().catch(() => false)) {
    await geoSwitch.click({ force: true });
    await page.waitForTimeout(600);
    await shot(page, 'appearance-geometric-off.png');
    await geoSwitch.click({ force: true });
  }

  const sidebarFill = page.locator('input[type="range"]').first();
  if (await sidebarFill.isVisible().catch(() => false)) {
    await sidebarFill.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    await shot(page, 'appearance-sidebar-fill-slider.png');
    const undo = page.getByRole('button', { name: /^Undo$/i }).first();
    if (await undo.isEnabled().catch(() => false)) {
      await undo.click();
      await shot(page, 'appearance-atmosphere-undo.png');
    }
  }

  await assertClean(page, hits, 'appearance-atmosphere-end');
  await page.close();
  await restorePortalRail(context);
  results.phase1.push({ id: 'appearance', status: 'PASS' });
}

async function probeSettings(page, sectionId) {
  switch (sectionId) {
    case 'identity-providers': {
      const add = page.getByRole('button', { name: /add|create/i }).first();
      if (await add.isVisible({ timeout: 2000 }).catch(() => false)) {
        await add.click();
        await page.waitForTimeout(600);
        await page.getByRole('button', { name: /cancel/i }).first().click().catch(() => page.keyboard.press('Escape'));
      }
      break;
    }
    case 'cultures': {
      const row = page.locator('[role="row"]').nth(1);
      if (await row.isVisible().catch(() => false)) await row.click();
      await page.keyboard.press('Escape');
      break;
    }
    case 'mcp-servers': {
      const create = page.getByRole('button', { name: /create|add/i }).first();
      if (await create.isVisible({ timeout: 2000 }).catch(() => false)) {
        await create.click();
        await page.waitForTimeout(600);
        await page.keyboard.press('Escape');
      }
      break;
    }
    case 'user-attributes':
    case 'role-attributes': {
      const add = page.getByRole('button', { name: /add|create/i }).first();
      if (await add.isVisible({ timeout: 2000 }).catch(() => false)) {
        await add.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
      }
      break;
    }
    case 'web-fonts': {
      const upload = page.getByRole('button', { name: /upload|add/i }).first();
      if (await upload.isVisible({ timeout: 2000 }).catch(() => false)) {
        await upload.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
      }
      break;
    }
    case 'feedback':
    case 'eua-assist':
    case 'session-context': {
      const sw = page.getByRole('switch').first();
      if (await sw.isVisible().catch(() => false)) {
        await sw.click({ force: true });
        await page.waitForTimeout(300);
        await sw.click({ force: true });
      }
      break;
    }
    case 'pwa': {
      const sw = page.getByRole('switch').first();
      if (await sw.isVisible().catch(() => false)) {
        await sw.click({ force: true });
        await page.waitForTimeout(300);
        await sw.click({ force: true });
      }
      break;
    }
    case 'cache': {
      const test = page.getByRole('button', { name: /test connection/i }).first();
      if (await test.isVisible({ timeout: 2000 }).catch(() => false)) await test.click();
      break;
    }
    case 'node-identity': {
      const input = page.locator('input[type="text"]').first();
      if (await input.isVisible().catch(() => false)) {
        const prev = await input.inputValue();
        await input.fill(`${prev}-fp`);
        await input.fill(prev);
      }
      break;
    }
    default:
      await page.mouse.wheel(0, 200);
  }
}

async function runSettings(context) {
  for (const sectionId of SETTINGS_SECTIONS) {
    const page = await context.newPage();
    const hits = collect(page);
    const url = `${BASE}/${CULTURE}/studio/settings/${sectionId}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2200);
      await assertClean(page, hits, `settings-${sectionId}`);
      await shot(page, `settings-${sectionId}-loaded.png`);
      await probeSettings(page, sectionId);
      await page.waitForTimeout(500);
      await shot(page, `settings-${sectionId}-probe.png`);
      await assertClean(page, hits, `settings-${sectionId}-probe`);
      results.phase2.push({ sectionId, status: 'PASS' });
      process.stdout.write(`[settings] ${sectionId} PASS\n`);
    } catch (err) {
      results.phase2.push({ sectionId, status: 'FAIL', error: String(err.message || err) });
      process.stdout.write(`[settings] ${sectionId} FAIL ${err.message}\n`);
    } finally {
      await page.close().catch(() => {});
    }
  }
}

async function runBaseComponents(context) {
  const ids = loadBaseComponentSectionIds();
  for (const sectionId of ids) {
    const page = await context.newPage();
    const hits = collect(page);
    const url = `${BASE}/${CULTURE}/studio/base-components/${sectionId}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2200);
      const body = await page.locator('body').innerText();
      if (/empty dump|failed to load/i.test(body) && body.length < 200) {
        throw new Error('Preview empty or failed');
      }
      await assertClean(page, hits, `base-${sectionId}`);
      await shot(page, `base-${sectionId}-preview.png`);
      const seg = page.locator('[data-testid*="segmented"] button, [role="radio"]').first();
      if (await seg.isVisible({ timeout: 1500 }).catch(() => false)) {
        await seg.click();
        await page.waitForTimeout(400);
        await shot(page, `base-${sectionId}-prop-change.png`);
      }
      results.phase3.push({ sectionId, status: 'PASS' });
      process.stdout.write(`[base] ${sectionId} PASS\n`);
    } catch (err) {
      results.phase3.push({ sectionId, status: 'FAIL', error: String(err.message || err) });
      process.stdout.write(`[base] ${sectionId} FAIL ${err.message}\n`);
    } finally {
      await page.close().catch(() => {});
    }
  }
}

async function functionalProbe(page, kind) {
  switch (kind) {
    case 'filter': {
      const f = page.getByRole('button', { name: /filter/i }).first();
      if (await f.isVisible({ timeout: 2000 }).catch(() => false)) await f.click();
      break;
    }
    case 'row': {
      const cb = page.locator('[role="checkbox"]').nth(1);
      if (await cb.isVisible().catch(() => false)) await cb.click({ force: true });
      break;
    }
    case 'tree': {
      const node = page.locator('[role="treeitem"]').first();
      if (await node.isVisible({ timeout: 3000 }).catch(() => false)) await node.click();
      break;
    }
    case 'editor': {
      const ed = page.locator('textarea, [contenteditable="true"]').first();
      if (await ed.isVisible().catch(() => false)) await ed.fill('SELECT 1');
      break;
    }
    case 'folder': {
      const folder = page.locator('[role="row"], [role="treeitem"]').nth(1);
      if (await folder.isVisible().catch(() => false)) await folder.click();
      break;
    }
    case 'branch': {
      const sel = page.locator('select, [role="combobox"]').first();
      if (await sel.isVisible().catch(() => false)) await sel.click();
      break;
    }
    case 'list': {
      const row = page.locator('[role="row"]').nth(1);
      if (await row.isVisible().catch(() => false)) await row.click();
      break;
    }
    case 'view':
      await page.mouse.wheel(0, 300);
      break;
    default:
      break;
  }
  await page.waitForTimeout(500);
}

async function runStudioRoutes(context, routes, label) {
  for (const entry of routes) {
    const page = await context.newPage();
    const hits = collect(page);
    const url = `${BASE}/${CULTURE}${entry.route}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2200);
      await assertClean(page, hits, `studio-${entry.pageKey}-t0`);
      await shot(page, `studio-${entry.pageKey}-t0.png`);
      await page.waitForTimeout(800);
      await shot(page, `studio-${entry.pageKey}-t1.png`);

      if (entry.t2?.length) {
        for (const btn of entry.t2) {
          const b = page.getByRole('button', { name: btn, exact: true }).first();
          if (await b.isVisible({ timeout: 1500 }).catch(() => false)) {
            await b.click();
            await page.waitForTimeout(800);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            break;
          }
        }
        await shot(page, `studio-${entry.pageKey}-t2.png`);
      }

      if (entry.functional) await functionalProbe(page, entry.functional);
      await shot(page, `studio-${entry.pageKey}-functional.png`);
      await assertClean(page, hits, `studio-${entry.pageKey}`);
      results.phase4.push({ pageKey: entry.pageKey, block: label, status: 'PASS' });
      process.stdout.write(`[studio] ${entry.pageKey} PASS\n`);
    } catch (err) {
      results.phase4.push({ pageKey: entry.pageKey, block: label, status: 'FAIL', error: String(err.message || err) });
      process.stdout.write(`[studio] ${entry.pageKey} FAIL ${err.message}\n`);
    } finally {
      await page.close().catch(() => {});
    }
  }
}

async function packageRoutesInNav(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/${CULTURE}/studio`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const text = await page.locator('body').innerText();
  await page.close();
  const hasCms = /CMS/i.test(text);
  const hasSsh = /\bSSH\b|Remote Hubs|SFTP|RDP/i.test(text);
  return { hasCms, hasSsh: hasSsh || hasCms };
}

function runPreflightTests() {
  execSync('node workspace/smoke-pass/run-appearance-automated-tests.mjs', {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
});
const context = await browser.newContext({ baseURL: `${BASE}/${CULTURE}` });
await loginViaApi(context);

if (PHASE === 'all' || PHASE === '1') {
  runPreflightTests();
  await runAppearance(context);
  runPreflightTests();
}

if (PHASE === 'all' || PHASE === '2') await runSettings(context);

if (PHASE === 'all' || PHASE === '3') {
  execSync('npx vitest run src/features/base-components/__tests__/allCatalogOptionLiveness.test.tsx', {
    cwd: ROOT,
    stdio: 'inherit',
  });
  await runBaseComponents(context);
}

if (PHASE === 'all' || PHASE === '4') {
  await runStudioRoutes(context, STUDIO_ROUTES, 'core');
  const nav = await packageRoutesInNav(context);
  if (nav.hasCms || nav.hasSsh) {
    await runStudioRoutes(context, PACKAGE_ROUTES, 'packages');
  } else {
    results.phase4.push({ pageKey: 'packages', block: 'packages', status: 'skip', reason: 'CMS/SSH not prominent in nav' });
  }
}

if (PHASE === 'all') runPreflightTests();

await context.close();
await browser.close();

writeFileSync(join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
console.log('Wrote workspace/functional-pass/results.json');
