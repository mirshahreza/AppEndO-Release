import type { Plugin } from 'vite';

const PROD_ENTRY_TAG = '<script type="module" src="/src/main.tsx"></script>';
const DEV_BOOT_SCRIPT_RE = /<script type="module" src="\/dev-boot\.js[^"]*"><\/script>/;

/** Production build must bundle the SPA; dev keeps public/dev-boot.js for Vite gate + HMR. */
export const prodIndexHtmlPlugin = (): Plugin => ({
  name: 'appendo-prod-index-html',
  apply: 'build',
  enforce: 'pre',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      if (!DEV_BOOT_SCRIPT_RE.test(html)) {
        return html;
      }
      return html.replace(DEV_BOOT_SCRIPT_RE, PROD_ENTRY_TAG);
    },
  },
});
