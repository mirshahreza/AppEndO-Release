/**
 * Capture annotated Studio screenshots for the public AppEndO guide site.
 * Requires the local dev server at http://127.0.0.1:3000.
 *
 *   npx tsx scripts/cms-phase1/seed/captureAppEndoScreenshots.ts
 */
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import { cmsPackageSeedAssetsDir } from './cmsPackageSeedPaths';

const BASE = process.env.APPENDO_CAPTURE_BASE?.trim() || 'http://127.0.0.1:3000';
const USER = process.env.APPENDO_CAPTURE_USER?.trim() || 'admin@append.os';
const PASS = process.env.APPENDO_CAPTURE_PASS?.trim() || 'admin123';
const assetsDir = () => cmsPackageSeedAssetsDir();
const VIEWPORT = { width: 1440, height: 900 };

const isStudioCapturePath = (pathname: string): boolean => (
  pathname === '/us/studio' || pathname.startsWith('/us/studio/')
);

type Callout = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
};

type ShotSpec = {
  fileName: string;
  path: string;
  wait?: string;
  extra?: (page: Page) => Promise<Callout[]>;
  login?: boolean;
};

const COLORS = ['#2f6bff', '#ff3d7a', '#0f766e', '#f59e0b', '#7c3aed'];

const STUDIO_SHOTS: ShotSpec[] = [
  { fileName: 'shot-login.jpg', path: '/login', login: true },
  { fileName: 'shot-dashboard.jpg', path: '/us/studio' },
  { fileName: 'shot-data-studio.jpg', path: '/us/studio/data-studio' },
  { fileName: 'shot-server-functions.jpg', path: '/us/studio/server-functions' },
  { fileName: 'shot-dev-reference.jpg', path: '/us/studio/dev-reference' },
  { fileName: 'shot-client-components.jpg', path: '/us/studio/client-components' },
  { fileName: 'shot-base-components.jpg', path: '/us/studio/base-components' },
  { fileName: 'shot-portals.jpg', path: '/us/studio/portals' },
  { fileName: 'shot-packages.jpg', path: '/us/studio/package-manager' },
  { fileName: 'shot-workflows.jpg', path: '/us/studio/workflows' },
  { fileName: 'shot-file-manager.jpg', path: '/us/studio/file-manager' },
  { fileName: 'shot-ssh.jpg', path: '/us/studio/ssh-hub' },
  { fileName: 'shot-scheduled-tasks.jpg', path: '/us/studio/scheduled-tasks' },
  { fileName: 'shot-jobs.jpg', path: '/us/studio/jobs' },
  { fileName: 'shot-cache.jpg', path: '/us/studio/cache' },
  { fileName: 'shot-data-sources.jpg', path: '/us/studio/data-sources' },
  { fileName: 'shot-git.jpg', path: '/us/studio/git' },
  { fileName: 'shot-theme.jpg', path: '/us/studio/appearance' },
  { fileName: 'shot-settings.jpg', path: '/us/studio/settings' },
  { fileName: 'shot-platform-transfer.jpg', path: '/us/studio/platform-transfer' },
  { fileName: 'shot-users.jpg', path: '/us/studio/users' },
  { fileName: 'shot-roles.jpg', path: '/us/studio/roles' },
  { fileName: 'shot-base-info.jpg', path: '/us/studio/base-info' },
  { fileName: 'shot-org-chart.jpg', path: '/us/studio/organization-chart' },
  { fileName: 'shot-geo.jpg', path: '/us/studio/geographic-divisions' },
  { fileName: 'shot-chat-history.jpg', path: '/us/studio/chat-history' },
  { fileName: 'shot-logs.jpg', path: '/us/studio/logs' },
  { fileName: 'shot-cms-contents.jpg', path: '/us/studio/cms/contents' },
  { fileName: 'shot-public-home.jpg', path: '/us' },
  { fileName: 'shot-about-page.jpg', path: '/us/about' },
  { fileName: 'shot-guide-studio-map.jpg', path: '/us/studio-map' },
];

const escapeXml = (value: string): string => (
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
);

const boxFromLocator = async (locator: Locator): Promise<Callout | null> => {
  const count = await locator.count();
  if (count === 0) {
    return null;
  }
  const box = await locator.first().boundingBox();
  if (!box || box.width < 8 || box.height < 8) {
    return null;
  }
  return {
    x: Math.max(4, box.x),
    y: Math.max(4, box.y),
    w: Math.min(VIEWPORT.width - 8, box.width),
    h: Math.min(VIEWPORT.height - 8, box.height),
    label: '',
    color: COLORS[0],
  };
};

const studioChromeCallouts = async (page: Page): Promise<Callout[]> => {
  const labeled: Array<{ locator: Locator; label: string }> = [
    { locator: page.locator('#admin-shell-sidebar'), label: 'Studio nav' },
    { locator: page.locator('[data-testid="admin-shell-header-title-row"]'), label: 'Page title' },
    { locator: page.locator('main').first(), label: 'Workspace' },
  ];
  const callouts: Callout[] = [];
  for (const item of labeled) {
    const box = await boxFromLocator(item.locator);
    if (!box) {
      continue;
    }
    callouts.push({ ...box, label: item.label });
  }
  const active = await boxFromLocator(page.locator('#admin-shell-sidebar a[aria-current="page"]'));
  if (active) {
    callouts.push({
      ...active,
      w: Math.min(active.w, 200),
      h: Math.min(active.h, 48),
      label: 'Current page',
    });
  }
  return callouts;
};

const loginCallouts = async (page: Page): Promise<Callout[]> => {
  const labeled: Array<{ locator: Locator; label: string }> = [
    { locator: page.locator('.login-brand-panel'), label: 'Product mark' },
    { locator: page.locator('#login-identifier'), label: 'Username' },
    { locator: page.locator('#login-password'), label: 'Password' },
    { locator: page.locator('#login-form button[type="submit"]'), label: 'Sign in' },
  ];
  const callouts: Callout[] = [];
  for (const item of labeled) {
    const box = await boxFromLocator(item.locator);
    if (box) {
      callouts.push({ ...box, label: item.label });
    }
  }
  return callouts;
};

const publicHomeCallouts = async (page: Page): Promise<Callout[]> => {
  const labeled: Array<{ locator: Locator; label: string }> = [
    { locator: page.locator('header, .site-nav, nav').first(), label: 'Site nav' },
    { locator: page.locator('.site-hero h1, .site-page h1').first(), label: 'Hero' },
    { locator: page.locator('.site-slides, [aria-label="Featured slides"]').first(), label: 'Slides' },
    { locator: page.locator('#work').first(), label: 'Guides' },
  ];
  const callouts: Callout[] = [];
  for (const item of labeled) {
    const box = await boxFromLocator(item.locator);
    if (box) {
      callouts.push({ ...box, label: item.label });
    }
  }
  return callouts;
};

const overlaySvg = (callouts: Callout[]): string => {
  const nodes = callouts.map((callout, index) => {
    const color = COLORS[index % COLORS.length];
    const n = index + 1;
    const pad = 8;
    const x = Math.max(6, callout.x - pad);
    const y = Math.max(6, callout.y - pad);
    const w = Math.min(VIEWPORT.width - x - 6, callout.w + pad * 2);
    const h = Math.min(VIEWPORT.height - y - 6, callout.h + pad * 2);
    const label = callout.label.slice(0, 28);
    const labelW = Math.min(280, Math.max(72, label.length * 8.2 + 20));
    const badgeX = Math.min(VIEWPORT.width - 36, x + 18);
    const badgeY = Math.max(22, y + 18);
    const labelX = Math.min(VIEWPORT.width - labelW - 12, badgeX + 22);
    const labelY = Math.max(8, badgeY - 14);
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
        fill="${color}" fill-opacity="0.07" stroke="${color}" stroke-width="3.5" rx="12"/>
      <circle cx="${badgeX.toFixed(1)}" cy="${badgeY.toFixed(1)}" r="15" fill="${color}"/>
      <text x="${badgeX.toFixed(1)}" y="${(badgeY + 5).toFixed(1)}" text-anchor="middle" fill="#ffffff"
        font-size="15" font-family="Segoe UI, Inter, sans-serif" font-weight="700">${n}</text>
      <rect x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" width="${labelW.toFixed(1)}" height="24" rx="8" fill="${color}"/>
      <text x="${(labelX + 10).toFixed(1)}" y="${(labelY + 16.5).toFixed(1)}" fill="#ffffff"
        font-size="12" font-family="Segoe UI, Inter, sans-serif" font-weight="650">${escapeXml(label)}</text>
    `;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEWPORT.width}" height="${VIEWPORT.height}">${nodes}</svg>`;
};

const annotateJpeg = async (png: Buffer, callouts: Callout[]): Promise<Buffer> => {
  const sharp = (await import('sharp')).default;
  const overlay = Buffer.from(overlaySvg(callouts));
  return sharp(png)
    .resize(VIEWPORT.width, VIEWPORT.height, { fit: 'cover', position: 'northwest' })
    .composite(callouts.length > 0 ? [{ input: overlay, blend: 'over' }] : [])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
};

const launchBrowser = async () => {
  const edgeCandidates = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.LOCALAPPDATA,
  ]
    .filter((root): root is string => Boolean(root))
    .map((root) => path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  const edge = edgeCandidates.find((candidate) => existsSync(candidate));
  try {
    return await chromium.launch({
      headless: true,
      channel: edge ? 'msedge' : undefined,
    });
  } catch {
    return chromium.launch({ headless: true });
  }
};

const dismissOverlays = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"], [data-sonner-toast], .Toastify').forEach((node) => {
      if (node instanceof HTMLElement && !node.closest('#login-form')) {
        node.style.display = 'none';
      }
    });
  }).catch(() => undefined);
};

const setReactInput = async (locator: Locator, value: string): Promise<void> => {
  await locator.waitFor({ timeout: 30_000 });
  await locator.click();
  await locator.fill(value);
  await locator.evaluate((element, next) => {
    const input = element instanceof HTMLInputElement
      ? element
      : element.querySelector('input');
    if (!input) {
      return;
    }
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

const fillLogin = async (page: Page, identifier: string): Promise<void> => {
  await setReactInput(page.locator('#login-identifier'), identifier);
  await setReactInput(page.locator('#login-password'), PASS);
};

const signIn = async (page: Page): Promise<void> => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const identifiers = [...new Set([USER, 'admin', 'admin@append.os'])];
  let lastError = '';
  for (const identifier of identifiers) {
    await page.locator('#login-identifier').waitFor({ timeout: 30_000 });
    await fillLogin(page, identifier);
    const loginResponse = page.waitForResponse(
      (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.locator('#login-form button[type="submit"]').click();
    try {
      const response = await loginResponse;
      if (!response.ok()) {
        lastError = `login ${response.status()} for ${identifier}`;
        continue;
      }
      await page.waitForFunction(() => !window.location.pathname.endsWith('/login'), { timeout: 20_000 });
      await page.goto(`${BASE}/us/studio`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForSelector('#admin-shell-sidebar', { timeout: 45_000 });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (await page.locator('#login-otp').count()) {
        throw new Error('Login requires OTP; cannot capture Studio screenshots unattended.');
      }
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    }
  }
  await page.screenshot({ path: path.join(assetsDir(), 'shot-login-failed.png'), type: 'png' }).catch(() => undefined);
  throw new Error(`Could not sign in to Studio. ${lastError}`);
};

const captureOne = async (page: Page, spec: ShotSpec, signedIn: boolean): Promise<void> => {
  if (spec.login) {
    if (signedIn) {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    } else {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.locator('#login-identifier').waitFor({ timeout: 30_000 });
    }
    await page.waitForTimeout(600);
    await dismissOverlays(page);
    const png = await page.screenshot({ type: 'png', fullPage: false });
    const callouts = await loginCallouts(page);
    const jpeg = await annotateJpeg(png, callouts);
    await fs.writeFile(path.join(assetsDir(), spec.fileName), jpeg);
    return;
  }

  await page.goto(`${BASE}${spec.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (isStudioCapturePath(spec.path)) {
    await page.waitForSelector('#admin-shell-sidebar', { timeout: 30_000 });
  } else if (spec.path === '/us' || spec.path.startsWith('/us/')) {
    await page.waitForSelector('.site-hero h1, .site-page h1, .site-home, .site-home-wrap', { timeout: 60_000 }).catch(() => undefined);
  }
  if (spec.wait) {
    await page.waitForSelector(spec.wait, { timeout: 20_000 }).catch(() => undefined);
  }
  await page.waitForTimeout(isStudioCapturePath(spec.path) ? 1400 : 15000);
  await page.evaluate(() => {
    document.getElementById('app-boot-splash')?.setAttribute('hidden', '');
  });
  await dismissOverlays(page);
  const png = await page.screenshot({ type: 'png', fullPage: false });
  const callouts = isStudioCapturePath(spec.path)
    ? await studioChromeCallouts(page)
    : await publicHomeCallouts(page);
  const jpeg = await annotateJpeg(png, callouts);
  await fs.writeFile(path.join(assetsDir(), spec.fileName), jpeg);
};

const main = async (): Promise<void> => {
  await fs.mkdir(assetsDir(), { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const only = process.env.APPENDO_CAPTURE_ONLY?.trim();
  const shots = only
    ? STUDIO_SHOTS.filter((shot) => shot.fileName === only || shot.path === only)
    : STUDIO_SHOTS;
  try {
    const publicShots = shots.filter((shot) => !shot.login && !isStudioCapturePath(shot.path));
    const studioShots = shots.filter((shot) => isStudioCapturePath(shot.path));
    const loginShot = shots.find((shot) => shot.login);
    if (loginShot) {
      await captureOne(page, loginShot, false);
      console.log(`wrote ${loginShot.fileName}`);
    }
    let signedIn = false;
    if (studioShots.length > 0) {
      try {
        await signIn(page);
        signedIn = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Studio login skipped: ${message}`);
      }
    }
    const remaining = signedIn ? shots.filter((shot) => !shot.login) : publicShots;
    for (const spec of remaining) {
      try {
        await captureOne(page, spec, signedIn);
        console.log(`wrote ${spec.fileName}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`failed ${spec.fileName}: ${message}`);
      }
    }
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
