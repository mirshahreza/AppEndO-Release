import { apiFetch } from '../api/authSession';

const PACKAGE_UI_MODULE_ACCEPT = 'text/javascript, application/javascript, */*';

function moduleLoadErrorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
    const error = typeof parsed.error === 'string' ? parsed.error.trim() : '';
    if (error) return error;
    const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    if (message) return message;
  } catch {
    // Response is not JSON.
  }
  const preview = body.replace(/\s+/g, ' ').trim().slice(0, 180);
  if (preview) {
    return preview;
  }
  return `Package UI module request failed (HTTP ${status}).`;
}

/**
 * Load a server-compiled package UI ESM without going through Vite `import()`.
 * Vite rewrites `import(apiUrl)` to `?import`, which 404s the module and toasts
 * "Failed to fetch dynamically imported module" on every admin page.
 */
export async function importPackageUiModule(moduleUrl: string): Promise<Record<string, unknown>> {
  const response = await apiFetch(moduleUrl, {
    headers: { Accept: PACKAGE_UI_MODULE_ACCEPT },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  if (!response.ok || contentType.includes('json')) {
    throw new Error(moduleLoadErrorMessage(response.status, body));
  }

  const blobUrl = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
  try {
    return await import(/* @vite-ignore */ blobUrl) as Record<string, unknown>;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
