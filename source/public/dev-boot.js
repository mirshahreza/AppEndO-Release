// Dev boot loader (served as a static file). Keeps /api/boot ahead of the SPA graph
// so leftover tabs / Cursor Simple Browser cannot stampede Vite before the API is ready.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BOOT_FETCH_TIMEOUT_MS = 15_000;
const BOOT_WAIT_DEADLINE_MS = 45_000;

const showBootError = (title, detail) => {
  const splash = document.getElementById('app-boot-splash');
  if (!splash) {
    return;
  }
  splash.removeAttribute('hidden');
  splash.setAttribute('aria-busy', 'false');
  splash.innerHTML = `
    <div style="max-width:28rem;padding:0 1.25rem;text-align:center;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <p style="margin:0 0 0.5rem;font-size:1rem;font-weight:700;">${title}</p>
      <p style="margin:0 0 1rem;font-size:0.8125rem;line-height:1.5;color:#475569;word-break:break-word;">${detail}</p>
      <p style="margin:0;font-size:0.75rem;line-height:1.5;color:#64748b;">
        Confirm <code style="font-family:ui-monospace,monospace;">npm run dev</code> is running,
        open <strong>http://127.0.0.1:3000</strong> (not localhost),
        then hard refresh with <kbd>Ctrl+Shift+R</kbd>.
      </p>
    </div>
  `;
};

const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

const waitForBoot = async () => {
  const startedAt = Date.now();
  let attempt = 0;
  while (Date.now() - startedAt < BOOT_WAIT_DEADLINE_MS) {
    try {
      const response = await fetchWithTimeout('/api/boot', BOOT_FETCH_TIMEOUT_MS);
      if (response.ok) {
        return;
      }
    } catch {
      // Server still starting, or the boot request hung — keep splash visible and retry.
    }
    attempt += 1;
    await sleep(attempt < 10 ? 250 : 500);
  }
  // Never leave the splash up forever if /api/boot never returns.
  // Load the SPA anyway; PlatformConfigProvider shows a retryable error if boot is still down.
};

const importWithBusyRetry = async (specifier) => {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await import(specifier);
    } catch (error) {
      lastError = error;
      await sleep(attempt < 10 ? 400 : 900);
    }
  }
  throw lastError ?? new Error(`Failed to import ${specifier}`);
};

const installReactRefreshPreamble = async () => {
  // Disk-served index.html skips Vite transformIndexHtml, so @vitejs/plugin-react
  // never injects its preamble. Without window.$RefreshReg$, every .tsx module throws
  // "@vitejs/plugin-react can't detect preamble" and boot sticks on the splash.
  const { injectIntoGlobalHook } = await importWithBusyRetry('/@react-refresh');
  injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => (type) => type;
};

const loadApp = async () => {
  await waitForBoot();
  // Disk-served HTML skips Vite's HTML transform — pull the client + React Refresh preamble.
  await importWithBusyRetry('/@vite/client');
  await installReactRefreshPreamble();
  await importWithBusyRetry('/src/main.tsx');
};

loadApp().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[AppEndO] Boot/load failed:', error);
  showBootError('AppEndO could not start', message);
});
