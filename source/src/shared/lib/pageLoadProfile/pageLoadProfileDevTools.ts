import { serializePageLoadProfileExport } from './buildExportPayload';
import { getPageLoadProfileSnapshot } from './store';
import { verifyPageLoadProfileDisplay } from './verifyProfileDisplay';
import type { PageLoadProfileVerifyReport } from './verifyProfileDisplay';

declare global {
  interface Window {
    __appendoPageLoadProfileDev?: {
      snapshot: () => ReturnType<typeof getPageLoadProfileSnapshot>;
      verify: () => PageLoadProfileVerifyReport | null;
      exportJson: () => string | null;
    };
  }
}

/** Browser-only dev hook (never import from server bundles). */
export const installPageLoadProfileDevTools = (): void => {
  if (!import.meta.env.DEV) {
    return;
  }
  window.__appendoPageLoadProfileDev = {
    snapshot: () => getPageLoadProfileSnapshot(),
    verify: () => {
      const snap = getPageLoadProfileSnapshot();
      return snap ? verifyPageLoadProfileDisplay(snap) : null;
    },
    exportJson: () => {
      const snap = getPageLoadProfileSnapshot();
      return snap ? serializePageLoadProfileExport(sap) : null;
    },
  };
};
