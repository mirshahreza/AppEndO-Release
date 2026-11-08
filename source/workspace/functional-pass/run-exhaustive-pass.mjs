/**
 * Exhaustive end-user QA: every catalog option value + DOM config scan + deep settings/routes.
 * Usage: node workspace/functional-pass/run-exhaustive-pass.mjs
 * Env: EXHAUSTIVE_PHASE=matrix|base|settings|appearance|routes|all
 *      EXHAUSTIVE_FROM=<sectionId or step key> for resume
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  DEFAULT_BASE,
  collect,
  resetHits,
  assertClean,
  loginViaApi,
  resetBaseSection,
  installBaseComponentsDock,
  waitForStudioSettle,
  loadProgress as loadProgressFile,
  saveProgress as saveProgressFile,
  appendLog,
  launchOptions,
} from '../qa-runners/lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const SHOTS = join(__dirname, 'screenshots', 'exhaustive');
const PROGRESS = join(__dirname, 'exhaustive-progress.json');
const LOG = join(__dirname, 'exhaustive-run.log');
const BASE = DEFAULT_BASE;
const CULTURE = 'us';
const PHASE = process.env.EXHAUSTIVE_PHASE ?? 'all';

if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

function log(msg) {
  appendLog(LOG, msg);
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

function loadProgress() {
  return loadProgressFile(PROGRESS);
}

function saveProgress(p) {
  saveProgressFile(PROGRESS, p);
}

function slugValue(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('md5').update(raw).digest('hex').slice(0, 10);
}

async function expandConfigSections(page) {
  const headers = page.locator('[data-bc-config-mode="docked"] button, [data-bc-config-mode="floating"] button');
  const n = await headers.count();
  for (let i = 0; i < Math.min(n, 40); i++) {
    const btn = headers.nth(i);
    const label = (await btn.innerText().catch(() => '')).trim();
    if (!label || /^(Reset|Dock|Undock|Search)/i.test(label)) continue;
    await btn.click().catch(() => {});
    await page.waitForTimeout(80);
  }
}

async function setOptionHost(page, host, value) {
  const select = host.locator('select').first();
  if (await select.count()) {
    const v = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
    await select.selectOption(v).catch(async () => {
      await select.selectOption({ label: v });
    });
    return true;
  }
  const input = host.locator('input, textarea').first();
  if (await input.count()) {
    await input.fill(String(value));
    return true;
  }
  return false;
}

async function runCatalogStep(page, step, progress) {
  const key = `cat:${step.sectionId}:${step.optionId}:${slugValue(step.value)}`;
  if (progress.done[key]) return { key, status: 'skip-done' };
  if (step.skipReason) {
    progress.done[key] = { status: 'skip', reason: step.skipReason };
    return { key, status: 'skip', reason: step.skipReason };
  }

  if (!step._skipGoto) {
    resetHits(globalHits);
    const url = `${BASE}/${CULTURE}/studio/base-components/${step.sectionId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1800);
  }
  await resetBaseSection(page);
  await expandConfigSections(page);

  for (const [optId, val] of Object.entries(step.preValues ?? {})) {
    const preHost = page.locator(`[data-bc-option="${optId}"]`).first();
    if (await preHost.count()) await setOptionHost(page, preHost, val);
  }

  const host = page.locator(`[data-bc-option="${step.optionId}"]`).first();
  if (!(await host.count())) {
    progress.done[key] = { status: 'skip', reason: 'no data-bc-option (dedicated workspace)' };
    return { key, status: 'skip', reason: 'no data-bc-option' };
  }

  const ok = await setOptionHost(page, host, step.value);
  if (!ok) {
    progress.done[key] = { status: 'skip', reason: 'no control in host' };
    return { key, status: 'skip', reason: 'no control' };
  }

  await page.waitForTimeout(450);
  const body = await page.locator('body').innerText();
  assertClean(globalHits, body);

  const file = join(SHOTS, `cat-${step.sectionId}-${step.optionId}-${slugValue(step.value)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  progress.done[key] = { status: 'PASS', file };
  return { key, status: 'PASS' };
}

async function configRootLocator(page) {
  const docked = page.locator('[data-bc-config-mode="docked"]');
  if (await docked.count()) return docked;
  return page.locator('[data-bc-preview-root]').locator('xpath=ancestor::div[contains(@class,"flex")][1]');
}

async function runDomScanSection(page, sectionId, progress) {
  resetHits(globalHits);
  const url = `${BASE}/${CULTURE}/studio/base-components/${sectionId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitForStudioSettle(page);
  await resetBaseSection(page);
  await expandConfigSections(page);

  const configRoot = page.locator('[data-bc-config-mode="docked"]');
  if ((await configRoot.count()) === 0) {
    await page.getByRole('button', { name: /dock properties|undock/i }).first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  const triggers = configRoot.locator(
    'select, button[aria-haspopup="listbox"], [role="combobox"]',
  );
  const count = await triggers.count();
  const results = [];

  for (let i = 0; i < count; i++) {
    const trigger = triggers.nth(i);
    if (!(await trigger.isVisible().catch(() => false))) continue;
    const tag = await trigger.evaluate((el) => el.tagName.toLowerCase());
    const aria =
      (await trigger.getAttribute('aria-label')) ??
      (await trigger.getAttribute('name')) ??
      `control-${i}`;

    if (tag === 'select') {
      const optCount = await trigger.locator('option').count();
      for (let o = 0; o < optCount; o++) {
        const val = (await trigger.locator('option').nth(o).getAttribute('value')) ?? String(o);
        const key = `hero:${sectionId}:${aria}:${val}`;
        if (progress.done[key]) continue;
        await resetBaseSection(page);
        await expandConfigSections(page);
        await (await configRootLocator(page)).locator('select').nth(i).selectOption(val).catch(() => {});
        await page.waitForTimeout(400);
        try {
          assertClean(globalHits, await page.locator('body').innerText());
          const file = join(SHOTS, `hero-${sectionId}-${i}-${slugValue(val)}.png`);
          await page.screenshot({ path: file, fullPage: true });
          progress.done[key] = { status: 'PASS', aria, value: val, file };
          results.push({ key, status: 'PASS' });
        } catch (err) {
          progress.done[key] = { status: 'FAIL', error: String(err.message || err) };
          progress.fails.push({ key, error: String(err.message || err) });
          log(`FAIL ${key} ${err.message}`);
        }
      }
      continue;
    }

    await trigger.click().catch(() => {});
    await page.waitForTimeout(250);
    const options = page.locator('[role="listbox"]:visible [role="option"]');
    const oc = await options.count();
    for (let o = 0; o < oc; o++) {
      const opt = options.nth(o);
      const val = (await opt.getAttribute('data-key')) ?? (await opt.innerText()).trim();
      const key = `hero:${sectionId}:${aria}:${slugValue(val)}`;
      if (progress.done[key]) continue;
      await resetBaseSection(page);
      await expandConfigSections(page);
      const tri = (await configRootLocator(page))
        .locator('button[aria-haspopup="listbox"], [role="combobox"]')
        .nth(i);
      await tri.click().catch(() => {});
      await page.waitForTimeout(200);
      const opt2 = page.locator('[role="listbox"]:visible [role="option"]').nth(o);
      await opt2.click().catch(() => {});
      await page.waitForTimeout(400);
      try {
        assertClean(globalHits, await page.locator('body').innerText());
        const file = join(SHOTS, `hero-${sectionId}-${i}-${slugValue(val)}.png`);
        await page.screenshot({ path: file, fullPage: true });
        progress.done[key] = { status: 'PASS', aria, value: val, file };
        results.push({ key, status: 'PASS' });
      } catch (err) {
        progress.done[key] = { status: 'FAIL', error: String(err.message || err) };
        progress.fails.push({ key, error: String(err.message || err) });
        log(`FAIL ${key} ${err.message}`);
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
  }
  return results;
}

const SETTINGS = [
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

async function exhaustSettings(page, progress) {
  for (const sectionId of SETTINGS) {
    const url = `${BASE}/${CULTURE}/studio/settings/${sectionId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2000);

    const selects = page.locator('main select, main [role=combobox]');
    const sc = await selects.count();
    for (let i = 0; i < sc; i++) {
      const sel = selects.nth(i);
      if (!(await sel.isVisible().catch(() => false))) continue;
      const opts = await sel.locator('option').count().catch(() => 0);
      for (let o = 0; o < opts; o++) {
        const val = await sel.locator('option').nth(o).getAttribute('value');
        const key = `settings:${sectionId}:${i}:${val}`;
        if (progress.done[key]) continue;
        await sel.selectOption(val ?? String(o)).catch(() => {});
        await page.waitForTimeout(300);
        try {
          assertClean(globalHits, await page.locator('body').innerText());
          const file = join(SHOTS, `settings-${sectionId}-${i}-${slugValue(val)}.png`);
          await page.screenshot({ path: file, fullPage: true });
          progress.done[key] = { status: 'PASS', file };
        } catch (err) {
          progress.done[key] = { status: 'FAIL', error: String(err.message) };
          progress.fails.push({ key, sectionId, error: String(err.message) });
        }
      }
    }

    const switches = page.locator('main [role=switch]');
    const swc = await switches.count();
    for (let i = 0; i < swc; i++) {
      const sw = switches.nth(i);
      if (!(await sw.isVisible().catch(() => false))) continue;
      for (const pass of [0, 1]) {
        const key = `settings-sw:${sectionId}:${i}:${pass}`;
        if (progress.done[key]) continue;
        await sw.click({ force: true }).catch(() => {});
        await page.waitForTimeout(250);
        try {
          assertClean(globalHits, await page.locator('body').innerText());
          const file = join(SHOTS, `settings-sw-${sectionId}-${i}-${pass}.png`);
          await page.screenshot({ path: file, fullPage: true });
          progress.done[key] = { status: 'PASS', file };
        } catch (err) {
          progress.done[key] = { status: 'FAIL', error: String(err.message) };
          progress.fails.push({ key, error: String(err.message) });
        }
      }
    }
  }
}

function loadSectionIds() {
  const src = readFileSync(
    join(ROOT, 'src/features/base-components/catalog/sections/catalogSections.options.ts'),
    'utf8',
  );
  const block = src.match(/export const TARGET_BASE_COMPONENT_SECTION_IDS = \[([\s\S]*?)\] as const;/);
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

let globalHits = { console: [], pageErrors: [] };

async function main() {
  const progress = loadProgress();
  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext();
  await loginViaApi(context, BASE);
  const page = await context.newPage();
  await installBaseComponentsDock(page);
  globalHits = collect(page);

  if (PHASE === 'all' || PHASE === 'matrix') {
    execSync('npx tsx workspace/functional-pass/export-exhaustive-matrix.ts', { cwd: ROOT, stdio: 'inherit' });
  }

  if (PHASE === 'all' || PHASE === 'base') {
    const matrix = JSON.parse(
      readFileSync(join(__dirname, 'exhaustive-catalog-matrix.json'), 'utf8'),
    );
    log(`Catalog steps: ${matrix.steps.length}`);

    const bySection = new Map();
    for (const step of matrix.steps) {
      if (!bySection.has(step.sectionId)) bySection.set(step.sectionId, []);
      bySection.get(step.sectionId).push(step);
    }

    for (const [sectionId, steps] of bySection) {
      resetHits(globalHits);
      const url = `${BASE}/${CULTURE}/studio/base-components/${sectionId}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await waitForStudioSettle(page);
      const hasBcOptions = (await page.locator('[data-bc-option]').count()) > 0;

      if (!hasBcOptions) {
        for (const step of steps) {
          const key = `cat:${step.sectionId}:${step.optionId}:${slugValue(step.value)}`;
          if (progress.done[key]) continue;
          progress.done[key] = { status: 'skip', reason: 'dedicated workspace (DOM scan covers)' };
        }
        saveProgress(progress);
        log(`Catalog skip section ${sectionId} (${steps.length} steps) → DOM scan`);
        continue;
      }

      for (const step of steps) {
        try {
          const r = await runCatalogStep(page, { ...step, _skipGoto: true }, progress);
          if (r.status === 'PASS') log(`PASS ${r.key}`);
          saveProgress(progress);
        } catch (err) {
          const key = `cat:${step.sectionId}:${step.optionId}:${slugValue(step.value)}`;
          progress.done[key] = { status: 'FAIL', error: String(err.message) };
          progress.fails.push({ key, error: String(err.message) });
          saveProgress(progress);
          log(`FAIL ${key} ${err.message}`);
        }
      }
    }

    for (const sectionId of loadSectionIds()) {
      log(`DOM scan ${sectionId}`);
      try {
        await runDomScanSection(page, sectionId, progress);
      } catch (err) {
        const key = `dom-scan:${sectionId}:fatal`;
        progress.done[key] = { status: 'FAIL', error: String(err.message) };
        progress.fails.push({ key, sectionId, error: String(err.message) });
        log(`DOM scan abort ${sectionId}: ${err.message}`);
      }
      saveProgress(progress);
    }
  }

  if (PHASE === 'all' || PHASE === 'settings') {
    log('Settings exhaustive…');
    await exhaustSettings(page, progress);
    saveProgress(progress);
  }

  if (PHASE === 'all' || PHASE === 'appearance') {
    log('Appearance via functional runner phase 1…');
    execSync('node workspace/functional-pass/run-functional-pass.mjs', {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, FUNCTIONAL_PHASE: '1' },
    });
  }

  if (PHASE === 'all' || PHASE === 'routes') {
    log('Studio routes via functional runner phase 4…');
    execSync('node workspace/functional-pass/run-functional-pass.mjs', {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, FUNCTIONAL_PHASE: '4' },
    });
  }

  await browser.close();
  log(`Done. Fails: ${progress.fails.length}. Progress: ${PROGRESS}`);
}

main().catch((err) => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
