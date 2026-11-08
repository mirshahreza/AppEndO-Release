import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium, defineConfig, firefox, webkit } from 'playwright/test';
import type { Project } from 'playwright/test';

type BrowserGate = {
  name: 'chromium' | 'firefox' | 'webkit';
  project?: Project;
  skipReason?: string;
};

function bundledBrowserExists(executablePath: string) {
  return existsSync(executablePath);
}

function edgeExecutable() {
  if (process.platform !== 'win32') return undefined;
  const candidates = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.LOCALAPPDATA,
  ]
    .filter((root): root is string => Boolean(root))
    .map((root) => path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  return candidates.find(existsSync);
}

function discoverBrowsers(): BrowserGate[] {
  const chromiumBundled = bundledBrowserExists(chromium.executablePath());
  const edge = edgeExecutable();
  return [
    {
      name: 'chromium',
      ...(chromiumBundled
        ? { project: { name: 'chromium', use: { browserName: 'chromium' as const } } }
        : edge
          ? {
              project: {
                name: 'chromium-edge',
                use: { browserName: 'chromium' as const, channel: 'msedge' },
              },
            }
          : {
              skipReason:
                'Chromium bundled binary and Microsoft Edge channel are both unavailable.',
            }),
    },
    {
      name: 'firefox',
      ...(bundledBrowserExists(firefox.executablePath())
        ? { project: { name: 'firefox', use: { browserName: 'firefox' as const } } }
        : { skipReason: `Firefox binary unavailable at ${firefox.executablePath()}.` }),
    },
    {
      name: 'webkit',
      ...(bundledBrowserExists(webkit.executablePath())
        ? { project: { name: 'webkit', use: { browserName: 'webkit' as const } } }
        : { skipReason: `WebKit binary unavailable at ${webkit.executablePath()}.` }),
    },
  ];
}

const browserGates = discoverBrowsers();
for (const gate of browserGates) {
  if (gate.skipReason) {
    console.warn(`[creative-shell browser gate] SKIP ${gate.name}: ${gate.skipReason}`);
  }
}
const projects = browserGates.flatMap((gate) => (gate.project ? [gate.project] : []));
if (projects.length === 0) {
  throw new Error(
    '[creative-shell browser gate] No executable browser is available. Install Playwright browsers or Microsoft Edge.',
  );
}

export default defineConfig({
  testDir: './tests/creative-shell',
  testMatch: /creative-shell\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  reporter: [['list']],
  outputDir: 'workspace/temp/creative-shell-playwright',
  use: {
    baseURL: 'http://127.0.0.1:4179',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects,
  webServer: {
    command:
      'npm exec vite -- --config tests/creative-shell/vite.config.ts --host 127.0.0.1 --port 4179',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
