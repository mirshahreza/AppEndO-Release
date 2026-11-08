import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CORE_LIBRARY_PACKAGES } from '../../../../core/packages/developerLibraries';
import { createDeveloperLibrariesService } from '../developerLibraries.service';

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-libs-'));
}

describe('DeveloperLibrariesService', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists host package.json dependencies as core', () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'host',
        dependencies: { ssh2: '^1.17.0', react: '^19.0.0' },
      }),
    );
    fs.mkdirSync(path.join(projectRoot, 'node_modules', 'ssh2'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'node_modules', 'ssh2', 'package.json'),
      JSON.stringify({ name: 'ssh2', version: '1.17.0' }),
    );
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async () => ({ ok: true, stdout: '' }),
    });
    const ssh2 = service.list().find((item) => item.name === 'ssh2');
    expect(ssh2?.core).toBe(true);
    expect(ssh2?.version).toBe('1.17.0');
  });

  it('lists core libraries with the core flag', () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async () => ({ ok: true, stdout: '' }),
    });
    const items = service.list();
    for (const name of CORE_LIBRARY_PACKAGES) {
      const row = items.find((item) => item.name === name);
      expect(row?.core).toBe(true);
    }
  });

  it('refuses to install a core library', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async () => ({ ok: true, stdout: '' }),
    });
    const result = await service.install('react');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(409);
    }
  });

  it('refuses to upgrade a core library', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async () => ({ ok: true, stdout: '' }),
    });
    const result = await service.upgrade('react');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(409);
    }
  });

  it('installs a non-core library through npm', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const calls: string[][] = [];
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async (args) => {
        calls.push(args);
        const libsRoot = path.join(projectRoot, 'packages-storage', 'libs');
        fs.mkdirSync(path.join(libsRoot, 'node_modules', 'xlsx'), { recursive: true });
        fs.writeFileSync(
          path.join(libsRoot, 'node_modules', 'xlsx', 'package.json'),
          JSON.stringify({ name: 'xlsx', version: '0.18.5' }),
        );
        const manifestPath = path.join(libsRoot, 'package.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { dependencies: Record<string, string> };
        manifest.dependencies.xlsx = '^0.18.5';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        return { ok: true, stdout: '' };
      },
    });
    const result = await service.install('xlsx', '^0.18.5');
    expect(result.ok).toBe(true);
    expect(calls[0]?.slice(0, 2)).toEqual(['install', 'xlsx@^0.18.5']);
    if (result.ok) {
      expect(result.library.core).toBe(false);
      expect(result.library.name).toBe('xlsx');
    }
    const listed = service.list();
    expect(listed.some((row) => row.name === 'xlsx' && row.core === false)).toBe(true);
  });

  it('satisfies core library declarations without npm', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const calls: string[][] = [];
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async (args) => {
        calls.push(args);
        return { ok: true, stdout: '' };
      },
    });
    const result = await service.satisfy([{ name: 'react' }]);
    expect(result.ok).toBe(true);
    expect(calls).toEqual([]);
  });

  it('stops package library satisfy when npm install fails', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async () => ({ ok: false, error: 'network down' }),
    });
    const result = await service.satisfy([{ name: 'xlsx', versionRange: '^0.18.5' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details?.[0]).toContain('xlsx');
    }
  });

  it('marks core packages in registry search hits from the platform lock list', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const service = createDeveloperLibrariesService({
      projectRoot,
      searchRegistry: async () => [
        { name: 'react', version: '19.0.0', description: 'ui', core: false },
        { name: 'xlsx', version: '0.18.5', description: 'sheets', core: false },
      ],
    });
    const hits = await service.search('re');
    expect(hits.find((hit) => hit.name === 'react')?.core).toBe(true);
    expect(hits.find((hit) => hit.name === 'xlsx')?.core).toBe(false);
  });

  it('refuses uninstall when an installed package still declares the library', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async () => {
        const libsRoot = path.join(projectRoot, 'packages-storage', 'libs');
        fs.mkdirSync(path.join(libsRoot, 'node_modules', 'xlsx'), { recursive: true });
        fs.writeFileSync(
          path.join(libsRoot, 'node_modules', 'xlsx', 'package.json'),
          JSON.stringify({ name: 'xlsx', version: '0.18.5' }),
        );
        const manifestPath = path.join(libsRoot, 'package.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { dependencies: Record<string, string> };
        manifest.dependencies.xlsx = '^0.18.5';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        return { ok: true, stdout: '' };
      },
    });
    const installed = await service.install('xlsx', '^0.18.5');
    expect(installed.ok).toBe(true);

    const originalList = service.list.bind(service);
    service.list = () => originalList().map((row) => (
      row.name === 'xlsx' ? { ...row, requestedBy: ['cms'] } : row
    ));

    const result = await service.uninstall('xlsx');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(409);
      expect(result.error).toContain('cms');
    }
  });

  it('installs package libraries into libs even when host node_modules already has them', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'host',
        dependencies: { ssh2: '^1.17.0' },
      }),
    );
    fs.mkdirSync(path.join(projectRoot, 'node_modules', 'ssh2'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'node_modules', 'ssh2', 'package.json'),
      JSON.stringify({ name: 'ssh2', version: '1.17.0' }),
    );
    const calls: string[][] = [];
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async (args) => {
        calls.push(args);
        const libsRoot = path.join(projectRoot, 'packages-storage', 'libs');
        fs.mkdirSync(path.join(libsRoot, 'node_modules', 'ssh2'), { recursive: true });
        fs.writeFileSync(
          path.join(libsRoot, 'node_modules', 'ssh2', 'package.json'),
          JSON.stringify({ name: 'ssh2', version: '1.17.0' }),
        );
        const manifestPath = path.join(libsRoot, 'package.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { dependencies: Record<string, string> };
        manifest.dependencies.ssh2 = '^1.17.0';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        return { ok: true, stdout: '' };
      },
    });
    const result = await service.satisfy([{ name: 'ssh2', versionRange: '^1.17.0' }]);
    expect(result.ok).toBe(true);
    expect(calls[0]?.slice(0, 2)).toEqual(['install', 'ssh2@^1.17.0']);
  });

  it('prunes unreferenced developer libraries from libs', async () => {
    const projectRoot = makeRoot();
    roots.push(projectRoot);
    const calls: string[][] = [];
    const service = createDeveloperLibrariesService({
      projectRoot,
      runNpm: async (args) => {
        calls.push(args);
        const libsRoot = path.join(projectRoot, 'packages-storage', 'libs');
        const pkgDir = path.join(libsRoot, 'node_modules', 'xlsx');
        const manifestPath = path.join(libsRoot, 'package.json');
        if (args[0] === 'install') {
          fs.mkdirSync(pkgDir, { recursive: true });
          fs.writeFileSync(
            path.join(pkgDir, 'package.json'),
            JSON.stringify({ name: 'xlsx', version: '0.18.5' }),
          );
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { dependencies: Record<string, string> };
          manifest.dependencies.xlsx = '^0.18.5';
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        } else if (args[0] === 'uninstall') {
          fs.rmSync(pkgDir, { recursive: true, force: true });
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { dependencies: Record<string, string> };
          delete manifest.dependencies.xlsx;
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        }
        return { ok: true, stdout: '' };
      },
    });
    const installed = await service.install('xlsx', '^0.18.5');
    expect(installed.ok).toBe(true);
    expect(service.list().some((row) => row.name === 'xlsx')).toBe(true);

    await service.pruneUnreferencedLibraries(['xlsx']);
    expect(calls.some((args) => args[0] === 'uninstall' && args[1] === 'xlsx')).toBe(true);
    expect(service.list().some((row) => row.name === 'xlsx')).toBe(false);
  });
});
