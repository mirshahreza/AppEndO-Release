import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPlatformRegistryCanonicalRenames } from '../platformRegistryDefaults';

const tempRoots: string[] = [];

function makeTempRegistryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-registry-'));
  tempRoots.push(root);
  return root;
}

describe('applyPlatformRegistryCanonicalRenames', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    vi.doUnmock('../platformRegistryPaths');
    vi.doUnmock('../PlatformRegistryFileStore');
  });

  it('migrates legacy components registry rows to client-components', async () => {
    const runtimeRoot = makeTempRegistryRoot();
    const defaultsRoot = path.join(runtimeRoot, 'defaults');
    const pageModulesDir = path.join(runtimeRoot, 'page-modules');
    const routeBindingsDir = path.join(runtimeRoot, 'route-bindings');
    const shellRulesDir = path.join(runtimeRoot, 'shell-rules');
    const navigationDir = path.join(runtimeRoot, 'navigation');

    for (const dir of [pageModulesDir, routeBindingsDir, shellRulesDir, navigationDir, path.join(defaultsRoot, 'page-modules'), path.join(defaultsRoot, 'navigation')]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path.join(pageModulesDir, 'components.json'), JSON.stringify({
      pageKey: 'components',
      title: 'Components',
      loaderRef: 'core:ComponentDesigner',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'page-modules', 'client-components.json'), JSON.stringify({
      pageKey: 'client-components',
      title: 'Client Components',
      loaderRef: 'core:ComponentDesigner',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(routeBindingsDir, '3.json'), JSON.stringify({
      id: 3,
      mountId: 'studio',
      routePattern: 'components',
      pageKey: 'components',
      enabled: true,
      nav: { label: 'Components' },
    }, null, 2));
    fs.writeFileSync(path.join(shellRulesDir, '1.json'), JSON.stringify({
      id: 1,
      mountId: 'studio',
      pathPrefix: '/studio/components',
      shellKey: 'designer',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'navigation', 'studio.json'), JSON.stringify({
      id: 'studio',
      version: '1',
      groups: [],
    }, null, 2));

    vi.doMock('../platformRegistryPaths', () => ({
      platformRegistryDirs: {
        root: runtimeRoot,
        pageModules: pageModulesDir,
        routeBindings: routeBindingsDir,
        shellRules: shellRulesDir,
        navigation: navigationDir,
        tmp: path.join(runtimeRoot, 'tmp'),
      },
      PLATFORM_REGISTRY_DEFAULTS_ROOT: defaultsRoot,
    }));
    vi.doMock('../PlatformRegistryFileStore', () => ({
      ensurePlatformRegistryDirs: () => {
        fs.mkdirSync(path.join(runtimeRoot, 'tmp'), { recursive: true });
      },
      touchPlatformRegistryIndex: () => undefined,
      listMountFiles: () => [],
      listRouteBindingFiles: () => [],
      writeRouteBindingFile: () => undefined,
    }));

    const { applyPlatformRegistryCanonicalRenames: migrate } = await import('../platformRegistryDefaults');
    migrate();

    expect(fs.existsSync(path.join(pageModulesDir, 'components.json'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(pageModulesDir, 'client-components.json'), 'utf8'))).toMatchObject({
      pageKey: 'client-components',
      title: 'Client Components',
    });
    expect(JSON.parse(fs.readFileSync(path.join(routeBindingsDir, '3.json'), 'utf8'))).toMatchObject({
      pageKey: 'client-components',
      routePattern: 'client-components/*',
      nav: { label: 'Client Components' },
    });
    expect(JSON.parse(fs.readFileSync(path.join(shellRulesDir, '1.json'), 'utf8'))).toMatchObject({
      pathPrefix: '/studio/client-components',
    });
  });

  it('migrates legacy packages registry rows to package-manager', async () => {
    const runtimeRoot = makeTempRegistryRoot();
    const defaultsRoot = path.join(runtimeRoot, 'defaults');
    const pageModulesDir = path.join(runtimeRoot, 'page-modules');
    const routeBindingsDir = path.join(runtimeRoot, 'route-bindings');
    const navigationDir = path.join(runtimeRoot, 'navigation');

    for (const dir of [pageModulesDir, routeBindingsDir, navigationDir, path.join(defaultsRoot, 'page-modules'), path.join(defaultsRoot, 'navigation')]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path.join(pageModulesDir, 'packages.json'), JSON.stringify({
      pageKey: 'packages',
      title: 'Packages',
      loaderRef: 'core:Packages',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'page-modules', 'package-manager.json'), JSON.stringify({
      pageKey: 'package-manager',
      title: 'Package Manager',
      loaderRef: 'core:PackageManager',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(routeBindingsDir, '4.json'), JSON.stringify({
      id: 4,
      mountId: 'studio',
      routePattern: 'packages',
      pageKey: 'packages',
      enabled: true,
      nav: { label: 'Packages' },
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'navigation', 'studio.json'), JSON.stringify({
      id: 'studio',
      version: '1',
      groups: [],
    }, null, 2));

    vi.doMock('../platformRegistryPaths', () => ({
      platformRegistryDirs: {
        root: runtimeRoot,
        pageModules: pageModulesDir,
        routeBindings: routeBindingsDir,
        shellRules: path.join(runtimeRoot, 'shell-rules'),
        navigation: navigationDir,
        tmp: path.join(runtimeRoot, 'tmp'),
      },
      PLATFORM_REGISTRY_DEFAULTS_ROOT: defaultsRoot,
    }));
    vi.doMock('../PlatformRegistryFileStore', () => ({
      ensurePlatformRegistryDirs: () => {
        fs.mkdirSync(path.join(runtimeRoot, 'tmp'), { recursive: true });
      },
      touchPlatformRegistryIndex: () => undefined,
      listMountFiles: () => [],
      listRouteBindingFiles: () => [],
      writeRouteBindingFile: () => undefined,
    }));

    const { applyPlatformRegistryCanonicalRenames: migrate } = await import('../platformRegistryDefaults');
    migrate();

    expect(fs.existsSync(path.join(pageModulesDir, 'packages.json'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(pageModulesDir, 'package-manager.json'), 'utf8'))).toMatchObject({
      pageKey: 'package-manager',
      title: 'Package Manager',
      loaderRef: 'core:PackageManager',
    });
    expect(JSON.parse(fs.readFileSync(path.join(routeBindingsDir, '4.json'), 'utf8'))).toMatchObject({
      pageKey: 'package-manager',
      routePattern: 'package-manager',
      nav: { label: 'Package Manager', group: 'Extensions', order: 1 },
    });
  });

  it('flattens grouped extensions/ studio routes', async () => {
    const runtimeRoot = makeTempRegistryRoot();
    const defaultsRoot = path.join(runtimeRoot, 'defaults');
    const pageModulesDir = path.join(runtimeRoot, 'page-modules');
    const routeBindingsDir = path.join(runtimeRoot, 'route-bindings');
    const navigationDir = path.join(runtimeRoot, 'navigation');

    for (const dir of [pageModulesDir, routeBindingsDir, navigationDir, path.join(defaultsRoot, 'page-modules'), path.join(defaultsRoot, 'navigation')]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path.join(defaultsRoot, 'page-modules', 'package-manager.json'), JSON.stringify({
      pageKey: 'package-manager',
      title: 'Package Manager',
      loaderRef: 'core:PackageManager',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(routeBindingsDir, '4.json'), JSON.stringify({
      id: 4,
      mountId: 'studio',
      routePattern: 'extensions/package-manager',
      pageKey: 'package-manager',
      enabled: true,
      nav: { label: 'Package Manager', group: 'Extensions', order: 1 },
    }, null, 2));
    fs.writeFileSync(path.join(routeBindingsDir, '62.json'), JSON.stringify({
      id: 62,
      mountId: 'studio',
      routePattern: 'extensions/libraries',
      pageKey: 'libraries',
      enabled: true,
      nav: { label: 'Libraries', group: 'Extensions', order: 2 },
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'navigation', 'studio.json'), JSON.stringify({
      id: 'studio',
      version: '1',
      groups: [],
    }, null, 2));

    vi.doMock('../platformRegistryPaths', () => ({
      platformRegistryDirs: {
        root: runtimeRoot,
        pageModules: pageModulesDir,
        routeBindings: routeBindingsDir,
        shellRules: path.join(runtimeRoot, 'shell-rules'),
        navigation: navigationDir,
        tmp: path.join(runtimeRoot, 'tmp'),
      },
      PLATFORM_REGISTRY_DEFAULTS_ROOT: defaultsRoot,
    }));
    vi.doMock('../PlatformRegistryFileStore', () => ({
      ensurePlatformRegistryDirs: () => {
        fs.mkdirSync(path.join(runtimeRoot, 'tmp'), { recursive: true });
      },
      touchPlatformRegistryIndex: () => undefined,
      listMountFiles: () => [],
      listRouteBindingFiles: () => [],
      writeRouteBindingFile: () => undefined,
    }));

    const { applyPlatformRegistryCanonicalRenames: migrate } = await import('../platformRegistryDefaults');
    migrate();

    expect(JSON.parse(fs.readFileSync(path.join(routeBindingsDir, '4.json'), 'utf8')).routePattern).toBe(
      'package-manager',
    );
    expect(JSON.parse(fs.readFileSync(path.join(routeBindingsDir, '62.json'), 'utf8')).routePattern).toBe(
      'libraries',
    );
  });

  it('migrates legacy sandbox registry rows to base-components', async () => {
    const runtimeRoot = makeTempRegistryRoot();
    const defaultsRoot = path.join(runtimeRoot, 'defaults');
    const pageModulesDir = path.join(runtimeRoot, 'page-modules');
    const routeBindingsDir = path.join(runtimeRoot, 'route-bindings');
    const navigationDir = path.join(runtimeRoot, 'navigation');

    for (const dir of [pageModulesDir, routeBindingsDir, navigationDir, path.join(defaultsRoot, 'page-modules'), path.join(defaultsRoot, 'navigation')]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path.join(pageModulesDir, 'sandbox.json'), JSON.stringify({
      pageKey: 'sandbox',
      title: 'Sandbox',
      loaderRef: 'core:Sandbox',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'page-modules', 'base-components.json'), JSON.stringify({
      pageKey: 'base-components',
      title: 'Base Components',
      loaderRef: 'core:BaseComponents',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(routeBindingsDir, '24.json'), JSON.stringify({
      id: 24,
      mountId: 'studio',
      routePattern: 'sandbox/*',
      pageKey: 'sandbox',
      enabled: true,
      nav: { label: 'Sandbox', icon: 'FlaskConical' },
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'navigation', 'studio.json'), JSON.stringify({
      id: 'studio',
      version: '1',
      groups: [],
    }, null, 2));

    vi.doMock('../platformRegistryPaths', () => ({
      platformRegistryDirs: {
        root: runtimeRoot,
        pageModules: pageModulesDir,
        routeBindings: routeBindingsDir,
        shellRules: path.join(runtimeRoot, 'shell-rules'),
        navigation: navigationDir,
        tmp: path.join(runtimeRoot, 'tmp'),
      },
      PLATFORM_REGISTRY_DEFAULTS_ROOT: defaultsRoot,
    }));
    vi.doMock('../PlatformRegistryFileStore', () => ({
      ensurePlatformRegistryDirs: () => {
        fs.mkdirSync(path.join(runtimeRoot, 'tmp'), { recursive: true });
      },
      touchPlatformRegistryIndex: () => undefined,
      listMountFiles: () => [],
      listRouteBindingFiles: () => [],
      writeRouteBindingFile: () => undefined,
    }));

    const { applyPlatformRegistryCanonicalRenames: migrate } = await import('../platformRegistryDefaults');
    migrate();

    expect(fs.existsSync(path.join(pageModulesDir, 'sandbox.json'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(pageModulesDir, 'base-components.json'), 'utf8'))).toMatchObject({
      pageKey: 'base-components',
      title: 'Base Components',
      loaderRef: 'core:BaseComponents',
    });
    expect(JSON.parse(fs.readFileSync(path.join(routeBindingsDir, '24.json'), 'utf8'))).toMatchObject({
      pageKey: 'base-components',
      routePattern: 'base-components/*',
      nav: {
        label: 'Base Components',
        icon: 'tabler:IconComponents',
      },
    });
  });

  it('migrates legacy workflow-designer registry rows to canonical workflows page module', async () => {
    const runtimeRoot = makeTempRegistryRoot();
    const defaultsRoot = path.join(runtimeRoot, 'defaults');
    const pageModulesDir = path.join(runtimeRoot, 'page-modules');
    const routeBindingsDir = path.join(runtimeRoot, 'route-bindings');
    const navigationDir = path.join(runtimeRoot, 'navigation');

    for (const dir of [pageModulesDir, routeBindingsDir, navigationDir, path.join(defaultsRoot, 'page-modules'), path.join(defaultsRoot, 'navigation')]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(path.join(pageModulesDir, 'workflow-designer.json'), JSON.stringify({
      pageKey: 'workflow-designer',
      title: 'Workflows',
      loaderRef: 'core:WorkflowDesigner',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'page-modules', 'workflows.json'), JSON.stringify({
      pageKey: 'workflows',
      title: 'Workflows',
      loaderRef: 'core:Workflows',
      enabled: true,
    }, null, 2));
    fs.writeFileSync(path.join(routeBindingsDir, '27.json'), JSON.stringify({
      id: 27,
      mountId: 'studio',
      routePattern: 'workflow-designer',
      pageKey: 'workflow-designer',
      enabled: true,
      nav: { label: 'Workflows' },
    }, null, 2));
    fs.writeFileSync(path.join(defaultsRoot, 'navigation', 'studio.json'), JSON.stringify({
      id: 'studio',
      version: '1',
      groups: [],
    }, null, 2));

    vi.doMock('../platformRegistryPaths', () => ({
      platformRegistryDirs: {
        root: runtimeRoot,
        pageModules: pageModulesDir,
        routeBindings: routeBindingsDir,
        shellRules: path.join(runtimeRoot, 'shell-rules'),
        navigation: navigationDir,
        tmp: path.join(runtimeRoot, 'tmp'),
      },
      PLATFORM_REGISTRY_DEFAULTS_ROOT: defaultsRoot,
    }));
    vi.doMock('../PlatformRegistryFileStore', () => ({
      ensurePlatformRegistryDirs: () => {
        fs.mkdirSync(path.join(runtimeRoot, 'tmp'), { recursive: true });
      },
      touchPlatformRegistryIndex: () => undefined,
      listMountFiles: () => [],
      listRouteBindingFiles: () => [],
      writeRouteBindingFile: () => undefined,
    }));

    const { applyPlatformRegistryCanonicalRenames: migrate } = await import('../platformRegistryDefaults');
    migrate();

    expect(fs.existsSync(path.join(pageModulesDir, 'workflow-designer.json'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(pageModulesDir, 'workflows.json'), 'utf8'))).toMatchObject({
      pageKey: 'workflows',
      title: 'Workflows',
      loaderRef: 'core:Workflows',
    });
    expect(JSON.parse(fs.readFileSync(path.join(routeBindingsDir, '27.json'), 'utf8'))).toMatchObject({
      pageKey: 'workflows',
      routePattern: 'workflows',
      nav: { label: 'Workflows' },
    });
  });
});
