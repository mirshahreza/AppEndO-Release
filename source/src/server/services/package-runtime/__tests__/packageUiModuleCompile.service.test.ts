import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensurePackageUiModuleDefaultExport,
  rewriteDefaultReExportFromNamedOnlyModule,
} from '../../../../shared/packages/packageUiModuleExport';

describe('packageUiModuleExport', () => {
  it('appends a default export for GeneratedComponent modules', () => {
    const source = `import React from 'react';\nexport const GeneratedComponent = () => null;\n`;
    const prepared = ensurePackageUiModuleDefaultExport(source);
    expect(prepared).toContain('export default GeneratedComponent;');
  });

  it('rewrites export { default } when the target module only has a named export', () => {
    const stub = `export { default } from '@/features/demo/DemoPage';\n`;
    const prepared = rewriteDefaultReExportFromNamedOnlyModule(stub, (importPath) => {
      if (importPath !== '@/features/demo/DemoPage') {
        return null;
      }
      return `export const DemoPage = () => null;\n`;
    });
    expect(prepared).toBe(`export { DemoPage as default } from '@/features/demo/DemoPage';\n`);
  });
});

describe('packageUiModuleCompile.service', () => {
  let tmpDir = '';

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = '';
    }
    delete (globalThis as { __APPENDO_PACKAGE_RUNTIME__?: unknown }).__APPENDO_PACKAGE_RUNTIME__;
  });

  it('compiles Hawiety targhin stub with a default export (named host page re-export)', async () => {
    const entryPath = path.join(
      process.cwd(),
      'packages-storage/runtimes/hawiety/0.2.0/ui/pages/hwy_targhin_requests.tsx',
    );
    if (!fs.existsSync(entryPath)) {
      return;
    }

    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    const ReactQuery = await import('@tanstack/react-query');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = {
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      HeroUIReact,
      ReactQuery,
      AppInternalModules: {},
    };

    const { clearPackageUiCompileCache, compilePackageUiModuleFile } = await import(
      '../packageUiModuleCompile.service'
    );
    clearPackageUiCompileCache();
    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);

    expect(compiled).toContain('HwyMemberTarghinAdminPage');
    expect(compiled).toMatch(/export\s*\{[^}]*\bdefault\b[^}]*\}/);
  });

  it('compiles designer TSX into browser ESM with a default export', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = { React, ReactJSXRuntime, ReactRouterDOM, HeroUIReact, AppInternalModules: {} };

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-compile-'));
    const entryPath = path.join(tmpDir, 'widget.tsx');
    fs.writeFileSync(entryPath, `import React from 'react';
import { Input } from '@heroui/react';

export const GeneratedComponent: React.FC = () => {
  return <Input aria-label="demo" />;
};
`);

    const { compilePackageUiModuleFile } = await import('../packageUiModuleCompile.service');
    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);

    expect(compiled).toContain('export');
    expect(compiled).toMatch(/export\s*\{[^}]*\bdefault\b[^}]*\}/);
    expect(compiled).not.toContain('import React from "react"');
  });

  it('re-exports useQuery/useQueryClient from the host ReactQuery instance instead of bundling a second copy', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    const ReactQuery = await import('@tanstack/react-query');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = { React, ReactJSXRuntime, ReactRouterDOM, HeroUIReact, ReactQuery, AppInternalModules: {} };

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-compile-'));
    const entryPath = path.join(tmpDir, 'query-widget.tsx');
    fs.writeFileSync(entryPath, `import { useQuery, useQueryClient } from '@tanstack/react-query';
export default function QueryWidget() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['demo'], queryFn: async () => 1 });
  return null;
}
`);

    const { compilePackageUiModuleFile } = await import('../packageUiModuleCompile.service');
    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);

    expect(compiled).toContain('__APPENDO_PACKAGE_RUNTIME__');
    expect(compiled).toContain('__runtime.ReactQuery');
    expect(compiled).toMatch(/\buseQueryClient\b/);
    // A real bundled second copy of react-query would include its actual class implementations
    // (e.g. `class QueryClient {`) — the shim only destructures names off the shared instance.
    expect(compiled).not.toMatch(/class QueryClient[\s{]/);
    expect(compiled).not.toMatch(/class QueryObserver[\s{]/);
  });

  it('re-exports createPortal from the host react-dom instead of bundling a second copy', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactDOM = await import('react-dom');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = {
      React,
      ReactJSXRuntime,
      ReactDOM,
      ReactRouterDOM,
      HeroUIReact,
      AppInternalModules: {},
    };

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-portal-'));
    const entryPath = path.join(tmpDir, 'portal-widget.tsx');
    fs.writeFileSync(entryPath, `import { createPortal } from 'react-dom';
export default function PortalWidget() {
  return createPortal(<div>menu</div>, document.body);
}
`);

    const { compilePackageUiModuleFile } = await import('../packageUiModuleCompile.service');
    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);

    expect(compiled).toContain('__APPENDO_PACKAGE_RUNTIME__');
    expect(compiled).toContain('__runtime.ReactDOM');
    expect(compiled).toMatch(/\bcreatePortal\b/);
    expect(compiled).not.toContain('react-dom.development.js');
    expect(compiled).not.toContain('react-dom.production');
  });

  it('re-exports usePlatformMount from the host PlatformMountContext instead of bundling a second createContext instance', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    const PlatformMountContext = await import('../../../../app/platform/PlatformMountContext');
    const PortalContext = await import('../../../../app/platform/PortalContext');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = {
      React,
      ReactJSXRuntime,
      ReactRouterDOM,
      HeroUIReact,
      AppInternalModules: {
        '@/app/platform/PlatformMountContext': PlatformMountContext as Record<string, unknown>,
        '@/app/platform/PortalContext': PortalContext as Record<string, unknown>,
      },
    };

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-compile-'));
    const entryPath = path.join(tmpDir, 'remote-hub-widget.tsx');
    fs.writeFileSync(entryPath, `import { usePlatformMount } from '@/app/platform/PlatformMountContext';
import { useOptionalPortal } from '@/app/platform/PortalContext';
export default function RemoteHubWidget() {
  const { mountId } = usePlatformMount();
  const portal = useOptionalPortal();
  return null;
}
`);

    const { compilePackageUiModuleFile } = await import('../packageUiModuleCompile.service');
    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);

    expect(compiled).toContain("AppInternalModules?.[\"@/app/platform/PlatformMountContext\"]");
    expect(compiled).toContain("AppInternalModules?.[\"@/app/platform/PortalContext\"]");
    // A real bundled second copy would call createContext() itself instead of reading the shared instance.
    expect(compiled).not.toContain('createContext(');
  });

  it('re-exports CreateEditModalShell from the shared UI barrel shim', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = { React, ReactJSXRuntime, ReactRouterDOM, HeroUIReact, AppInternalModules: {} };

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-compile-'));
    const entryPath = path.join(tmpDir, 'vocab.tsx');
    fs.writeFileSync(entryPath, `import { AppTableGrid, ConfirmDialogShell, CreateEditModalShell, GridPagingFooter, ToolbarFilterSelect } from '@/shared/ui';
export default function Vocab() {
  return <CreateEditModalShell title="demo" onClose={() => undefined}>{null}</CreateEditModalShell>;
}
`);

    const { compilePackageUiModuleFile, collectValueExportNamesFromBarrel } = await import('../packageUiModuleCompile.service');
    const barrel = fs.readFileSync(path.join(process.cwd(), 'src/shared/ui/index.ts'), 'utf8');
    expect(collectValueExportNamesFromBarrel(barrel)).toEqual(
      expect.arrayContaining(['CreateEditModalShell', 'ConfirmDialogShell', 'ToolbarFilterSelect']),
    );

    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);
    expect(compiled).toContain('CreateEditModalShell');
    expect(compiled).not.toMatch(/No matching export/);
  });

  it('injects imported CSS as a document style tag', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = { React, ReactJSXRuntime, ReactRouterDOM, HeroUIReact, AppInternalModules: {} };

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-css-'));
    fs.writeFileSync(path.join(tmpDir, 'widget.css'), '.pkg-widget { color: teal; }');
    const entryPath = path.join(tmpDir, 'widget.tsx');
    fs.writeFileSync(
      entryPath,
      `import './widget.css';\nexport default function Widget() { return <div className="pkg-widget" />; }\n`,
    );

    const { compilePackageUiModuleFile } = await import('../packageUiModuleCompile.service');
    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);
    expect(compiled).toContain('.pkg-widget { color: teal; }');
    expect(compiled).toContain('document.createElement("style")');
  });

  it('shims relative imports of the shared UI barrel to the host runtime', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = { React, ReactJSXRuntime, ReactRouterDOM, HeroUIReact, AppInternalModules: {} };

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-rel-'));
    const entryPath = path.join(tmpDir, 'widget.tsx');
    const relativeBarrel = path.relative(tmpDir, path.join(process.cwd(), 'src/shared/ui')).replace(/\\/g, '/');
    fs.writeFileSync(
      entryPath,
      `import { AppButton } from '${relativeBarrel}';\nexport default function Widget() { return <AppButton />; }\n`,
    );

    const { compilePackageUiModuleFile } = await import('../packageUiModuleCompile.service');
    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);
    expect(compiled).toContain('AppInternalModules?.["@/shared/ui"]');
    expect(compiled.length).toBeLessThan(50_000);
  });

  it('keeps compile shims aligned with host-internal package UI specifiers', async () => {
    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = { React, ReactJSXRuntime, ReactRouterDOM, HeroUIReact, AppInternalModules: {} };

    const { PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS } = await import(
      '../../../../core/packages/packageUiRuntimeGlobals'
    );
    const { compilePackageUiModuleFile } = await import('../packageUiModuleCompile.service');

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-spec-'));
    const entryPath = path.join(tmpDir, 'widget.tsx');
    fs.writeFileSync(
      entryPath,
      `import { AppButton } from '@/shared/ui';
import { UiInput } from '@/shared/ui/HeroFieldControls';
import { DesignerCodeEditorField } from '@/shared/ui/DesignerFormFields';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';
import { usePlatformMount } from '@/app/platform/PlatformMountContext';
import { useOptionalPortal } from '@/app/platform/PortalContext';
import { usePlatformConfig } from '@/app/platform/PlatformConfigProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useAccentTheme } from '@/contexts/AccentThemeContext';
import { useGridColumnLayouts } from '@/contexts/GridColumnLayoutsContext';
import { useViewportTier } from '@/shared/lib/useViewportTier';
import { useCultureT } from '@/core/culture/CultureContext';
import { useShellHeaderOverrideState } from '@/layouts/adminShell/ShellHeaderOverrideContext';
export default function Widget() {
  void UiInput;
  void DesignerCodeEditorField;
  void buildAppTableGridColumns;
  void applyDesignerGridToolbarClientFilters;
  void validateDesignerFieldNode;
  void usePlatformMount;
  void useOptionalPortal;
  void usePlatformConfig;
  void useAuth;
  void useAccentTheme;
  void useGridColumnLayouts;
  void useViewportTier;
  void useCultureT;
  void useShellHeaderOverrideState;
  return <AppButton />;
}
`,
    );

    const compiled = await compilePackageUiModuleFile(entryPath, fs.statSync(entryPath).mtimeMs);
    for (const specifier of PACKAGE_UI_INTERNAL_MODULE_SPECIFIERS) {
      expect(compiled).toContain(`AppInternalModules?.[${JSON.stringify(specifier)}]`);
    }
    expect(compiled).toContain('UiInput');
    expect(compiled).toContain('DesignerCodeEditorField');
    expect(compiled).toContain('buildAppTableGridColumns');
    expect(compiled).toContain('applyDesignerGridToolbarClientFilters');
    expect(compiled).toContain('validateDesignerFieldNode');
    expect(compiled).toContain('usePlatformMount');
    expect(compiled).toContain('useOptionalPortal');
    expect(compiled).toContain('usePlatformConfig');
    expect(compiled).toContain('useAuth');
    expect(compiled).toContain('useAccentTheme');
    expect(compiled).toContain('useGridColumnLayouts');
    expect(compiled).toContain('useViewportTier');
    expect(compiled).toContain('useCultureT');
    expect(compiled).toContain('useShellHeaderOverrideState');
  });
});
