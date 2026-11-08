import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveRemoteHubClientLibFromLibs } from '../remoteHubsClientLibResolve';

describe('resolveRemoteHubClientLibFromLibs', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prefers package.json module over CJS main', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-hub-libs-'));
    roots.push(projectRoot);
    const pkgDir = path.join(projectRoot, 'packages-storage', 'libs', 'node_modules', '@xterm', 'addon-fit');
    fs.mkdirSync(path.join(pkgDir, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'lib', 'addon-fit.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(pkgDir, 'lib', 'addon-fit.mjs'), 'export class FitAddon {}');
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@xterm/addon-fit',
        main: 'lib/addon-fit.js',
        module: 'lib/addon-fit.mjs',
      }),
    );

    const resolved = resolveRemoteHubClientLibFromLibs('@xterm/addon-fit', projectRoot);
    expect(resolved).toBe(path.join(pkgDir, 'lib', 'addon-fit.mjs'));
  });

  it('prefers exports.import for guacamole-common-js', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-hub-libs-'));
    roots.push(projectRoot);
    const pkgDir = path.join(projectRoot, 'packages-storage', 'libs', 'node_modules', 'guacamole-common-js');
    fs.mkdirSync(path.join(pkgDir, 'dist', 'esm'), { recursive: true });
    fs.mkdirSync(path.join(pkgDir, 'dist', 'cjs'), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'dist', 'cjs', 'guacamole-common.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(pkgDir, 'dist', 'esm', 'guacamole-common.js'), 'export default {};');
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: 'guacamole-common-js',
        main: 'dist/cjs/guacamole-common.js',
        module: 'dist/esm/guacamole-common.js',
        exports: {
          '.': {
            import: './dist/esm/guacamole-common.js',
            require: './dist/cjs/guacamole-common.js',
          },
        },
      }),
    );

    const resolved = resolveRemoteHubClientLibFromLibs('guacamole-common-js', projectRoot);
    expect(resolved).toBe(path.join(pkgDir, 'dist', 'esm', 'guacamole-common.js'));
  });

  it('resolves css subpaths from the package folder', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-hub-libs-'));
    roots.push(projectRoot);
    const cssPath = path.join(
      projectRoot,
      'packages-storage',
      'libs',
      'node_modules',
      '@xterm',
      'xterm',
      'css',
      'xterm.css',
    );
    fs.mkdirSync(path.dirname(cssPath), { recursive: true });
    fs.writeFileSync(cssPath, '/* xterm */');

    const resolved = resolveRemoteHubClientLibFromLibs('@xterm/xterm/css/xterm.css', projectRoot);
    expect(resolved).toBe(cssPath);
  });
});
