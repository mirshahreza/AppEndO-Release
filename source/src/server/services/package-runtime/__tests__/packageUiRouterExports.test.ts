import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import esbuild from 'esbuild';
import {
  importInstalledPackageNamespace,
  resolveInstalledPackageEntry,
} from '../importInstalledPackageNamespace';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('package UI react-router-dom exports', () => {
  it('reads Link and useSearchParams from the installed package, not a bundle stub', async () => {
    const entry = resolveInstalledPackageEntry('react-router-dom');
    expect(fs.existsSync(entry)).toBe(true);
    const mod = await importInstalledPackageNamespace('react-router-dom');
    // Link is a forwardRef object. The server stub returns a function for every property.
    expect(typeof mod.Link).toBe('object');
    expect(mod.Link).not.toBeNull();
    expect(typeof mod.useSearchParams).toBe('function');
  });

  it('keeps those exports when esbuild aliases the specifier to the server stub', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rrd-stub-'));
    tempDirs.push(tmp);
    const stubPath = path.join(tmp, 'react-router-dom.cjs');
    fs.writeFileSync(
      stubPath,
      [
        "'use strict';",
        'const handler = { get(_target, prop) {',
        "  if (prop === '__esModule') return true;",
        '  return () => null;',
        '} };',
        'module.exports = new Proxy(function noop() {}, handler);',
        '',
      ].join('\n'),
    );
    const helperPath = path.join(
      process.cwd(),
      'src/server/services/package-runtime/importInstalledPackageNamespace.ts',
    );
    const entryPath = path.join(tmp, 'entry.ts');
    fs.writeFileSync(
      entryPath,
      [
        `import { importInstalledPackageNamespace } from ${JSON.stringify(helperPath)};`,
        "importInstalledPackageNamespace('react-router-dom').then((mod) => {",
        "  if (typeof mod.Link !== 'object' || mod.Link === null) process.exit(2);",
        "  if (typeof mod.useSearchParams !== 'function') process.exit(3);",
        '}).catch((error) => { console.error(error); process.exit(1); });',
        '',
      ].join('\n'),
    );
    const outfile = path.join(tmp, 'out.cjs');
    await esbuild.build({
      entryPoints: [entryPath],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      alias: { 'react-router-dom': stubPath },
      logLevel: 'silent',
    });

    const result = spawnSync(process.execPath, [outfile], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('compiles a package page that imports Link and useSearchParams', async () => {
    const { compilePackageUiModuleSource } = await import('../packageUiModuleCompile.service');
    const code = await compilePackageUiModuleSource(
      [
        "import { Link, useSearchParams } from 'react-router-dom';",
        'export const GeneratedComponent = () => null;',
        'void Link; void useSearchParams;',
        '',
      ].join('\n'),
      { entryPath: 'SiteHome.tsx', resolveDir: process.cwd() },
    );
    expect(code).toContain('useSearchParams');
    expect(code).toContain('Link');
  });

  it('does not literal-import packages the server bundle stubs', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/server/services/package-runtime/packageUiModuleCompile.service.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/import\(\s*['"]react-router-dom['"]\s*\)/);
    expect(source).not.toMatch(/import\(\s*['"]@heroui\/react['"]\s*\)/);
    expect(source).toContain("importInstalledPackageNamespace('react-router-dom')");
  });
});
