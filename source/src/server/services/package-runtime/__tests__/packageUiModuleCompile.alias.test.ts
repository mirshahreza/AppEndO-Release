import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

describe('packageUiModuleCompile alias imports', () => {
  let tmpDir = '';

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = '';
    }
    delete (globalThis as { __APPENDO_PACKAGE_RUNTIME__?: unknown }).__APPENDO_PACKAGE_RUNTIME__;
  });

  it('bundles designer TSX that uses @/ path aliases', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = { React, ReactJSXRuntime, ReactRouterDOM, HeroUIReact, AppInternalModules: {} };

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-alias-'));
    const entryPath = path.join(tmpDir, 'widget.tsx');
    fs.writeFileSync(
      entryPath,
      `import { UiSelect } from '@/shared/ui/HeroFieldControls';\nexport default function Widget() { return <UiSelect aria-label="demo" />; }\n`,
    );

    const { compilePackageUiModuleFile } = await import('../packageUiModuleCompile.service');
    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);
    expect(compiled).toContain('export');
    expect(compiled).toMatch(/export\s*\{[^}]*\bdefault\b[^}]*\}/);
  });
});
