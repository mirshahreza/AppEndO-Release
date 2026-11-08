import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { resolveRemoteHubClientLibFromLibs } from '../../src/core/packages/remoteHubsClientLibResolve';
import { REMOTE_HUBS_CLIENT_LIB_SPECIFIERS } from '../../src/core/packages/remoteHubsPackage';

const stubsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'remote-hub-client-lib-stubs');

const STUB_FILES: Record<string, string> = {
  '@xterm/xterm': path.join(stubsDir, 'xterm.ts'),
  '@xterm/addon-fit': path.join(stubsDir, 'addon-fit.ts'),
  '@xterm/xterm/css/xterm.css': path.join(stubsDir, 'xterm.css'),
  'guacamole-common-js': path.join(stubsDir, 'guacamole-common-js.ts'),
};

const CLIENT_SPECIFIERS = new Set<string>(REMOTE_HUBS_CLIENT_LIB_SPECIFIERS);

function bareSpecifier(id: string): string {
  return id.split('?')[0] ?? id;
}

/**
 * Resolve Remote Hubs client widgets from packages-storage/libs when the package is
 * installed; otherwise load in-repo stubs so Vite/tsc still graph the hub pages.
 */
export function remoteHubClientLibsPlugin(): Plugin {
  return {
    name: 'appendo-remote-hub-client-libs',
    enforce: 'pre',
    resolveId(id) {
      const specifier = bareSpecifier(id);
      if (!CLIENT_SPECIFIERS.has(specifier)) {
        return null;
      }
      return resolveRemoteHubClientLibFromLibs(specifier) ?? STUB_FILES[specifier] ?? null;
    },
  };
}
