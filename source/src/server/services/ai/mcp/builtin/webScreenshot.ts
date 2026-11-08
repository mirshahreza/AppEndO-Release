import type { Browser } from 'playwright';
import { validateMcpRemoteUrl } from '../mcpUrlGuard';

export const SCREENSHOT_URL_TOOL_NAME = 'screenshot_url';
export const SCREENSHOT_TIMEOUT_MS = 30_000;

export type ScreenshotWaitUntil = 'load' | 'domcontentloaded' | 'networkidle';

export type ScreenshotUrlDeps = {
  validateUrl?: typeof validateMcpRemoteUrl;
  captureImpl?: (input: {
    url: string;
    fullPage: boolean;
    waitUntil: ScreenshotWaitUntil;
    width: number;
    height: number;
  }) => Promise<{ buffer: Buffer; finalUrl: string }>;
};

const WAIT_UNTIL: readonly ScreenshotWaitUntil[] = ['load', 'domcontentloaded', 'networkidle'];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const resolveWaitUntil = (raw: unknown): ScreenshotWaitUntil => {
  if (typeof raw === 'string' && (WAIT_UNTIL as readonly string[]).includes(raw.trim().toLowerCase())) {
    return raw.trim().toLowerCase() as ScreenshotWaitUntil;
  }
  return 'load';
};

const resolveDimension = (raw: unknown, fallback: number, min: number, max: number): number => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clamp(Math.floor(raw), min, max);
  }
  return fallback;
};

const captureWithPlaywright = async (input: {
  url: string;
  fullPage: boolean;
  waitUntil: ScreenshotWaitUntil;
  width: number;
  height: number;
  validateUrl: typeof validateMcpRemoteUrl;
}): Promise<{ buffer: Buffer; finalUrl: string }> => {
  let browser: Browser | null = null;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({
      viewport: { width: input.width, height: input.height },
      userAgent: 'AppEndO-Agent/1.0',
    });
    page.setDefaultTimeout(SCREENSHOT_TIMEOUT_MS);

    await page.route('**/*', async (route) => {
      try {
        await input.validateUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort('blockedbyclient');
      }
    });

    await page.goto(input.url, { waitUntil: input.waitUntil, timeout: SCREENSHOT_TIMEOUT_MS });
    const finalUrl = page.url();
    await input.validateUrl(finalUrl);
    const buffer = await page.screenshot({
      type: 'jpeg',
      quality: 72,
      fullPage: input.fullPage,
      timeout: SCREENSHOT_TIMEOUT_MS,
    });
    return { buffer, finalUrl };
  } finally {
    await browser?.close();
  }
};

export const executeScreenshotUrl = async (
  args: Record<string, unknown>,
  deps: ScreenshotUrlDeps = {},
): Promise<{ ok: true; summary: string; data: Record<string, unknown> } | { ok: false; summary: string; error: string }> => {
  const urlInput = typeof args.url === 'string' ? args.url.trim() : '';
  if (!urlInput) {
    return { ok: false, summary: 'URL is required.', error: 'missing_url' };
  }

  const validateUrl = deps.validateUrl ?? validateMcpRemoteUrl;
  let validatedUrl: URL;
  try {
    validatedUrl = await validateUrl(urlInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, summary: message, error: 'url_blocked' };
  }

  const fullPage = args.fullPage === true;
  const waitUntil = resolveWaitUntil(args.waitUntil);
  const width = resolveDimension(args.width, 1280, 320, 1920);
  const height = resolveDimension(args.height, 720, 320, 1200);
  const capture = deps.captureImpl ?? ((input) => captureWithPlaywright({ ...input, validateUrl }));

  try {
    const { buffer, finalUrl } = await capture({
      url: validatedUrl.toString(),
      fullPage,
      waitUntil,
      width,
      height,
    });
    const imageBase64 = buffer.toString('base64');
    return {
      ok: true,
      summary: `Screenshot of ${new URL(finalUrl).hostname} (${width}×${height}${fullPage ? ', full page' : ''}, ${buffer.length} bytes JPEG).`,
      data: {
        url: validatedUrl.toString(),
        finalUrl,
        mimeType: 'image/jpeg',
        byteLength: buffer.length,
        fullPage,
        width,
        height,
        waitUntil,
        imageBase64,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unavailable = /browserType\.launch|Executable doesn't exist|playwright/i.test(message);
    return {
      ok: false,
      summary: unavailable
        ? 'Screenshot failed: Playwright Chromium is not installed. Run npx playwright install chromium.'
        : `Screenshot failed: ${message}`,
      error: unavailable ? 'screenshot_unavailable' : 'screenshot_failed',
    };
  }
};
