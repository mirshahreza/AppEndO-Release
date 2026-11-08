/**
 * Mirrors Package Builder output: managed API + designer UI (folder/name path, .tsx entry).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from '../packageArtifactHash';

function buildBuilderStyleZip(): Buffer {
  const packageId = 'builder-ui-api-pack';
  const componentKey = 'general/summary-card';
  const uiEntry = `ui/${componentKey}.tsx`;
  const apiEntry = 'edge/demo-health.js';

  const draftManifest = {
    $schemaVersion: '1.0',
    id: packageId,
    name: 'Builder UI API Pack',
    version: '1.0.0',
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      apis: [{
        id: 'get-demo-health-1',
        method: 'GET',
        path: `/packages/${packageId}/health`,
        entry: apiEntry,
        timeoutMs: 10000,
        auth: 'admin',
      }],
      ui_components: [{
        componentKey,
        slotId: 'core.dashboard.widgets',
        entry: uiEntry,
        order: 100,
      }],
      db_objects: [],
      mcp_servers: [],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
    integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) },
  };

  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify(draftManifest)));
  zip.addFile(
    apiEntry,
    Buffer.from('export default async function handler(_req, res) { return res.json({ ok: true, package: true }); }'),
  );
  zip.addFile(
    uiEntry,
    Buffer.from(`import React from 'react';\nexport default function SummaryCard() { return <div data-testid="summary-card">Summary</div>; }\n`),
  );

  const artifactHash = computePackageArtifactHashFromZip(zip);
  const manifest = {
    ...draftManifest,
    integrity: { algorithm: 'sha256', artifactHash },
  };
  zip.updateFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  return zip.toBuffer();
}

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-builder-ui-install-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(origCwd);
  try {
    const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
  } catch {
    // module may not be loaded
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // Windows may briefly lock package-storage handles
  }
  vi.resetModules();
});

describe('package builder component install', () => {
  it('installs API+UI artifact with nested component path and serves compiled UI module', async () => {
    const { enrichPackageArtifactBuffer } = await import('../../../server/services/package/packageComponentExport.service');
    const artifact = await import('../PackageArtifactService');
    const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const rawZip = buildBuilderStyleZip();
    const enrichedZip = enrichPackageArtifactBuffer(rawZip);

    const upload = await artifact.uploadPackageArtifact(enrichedZip, 'builder-ui-api-pack.zip', 'admin');
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const install = await coordinator.install('builder-ui-api-pack', 'admin@example.com', {
      overridePolicy: { apis: 'allow', ui_components: 'allow', db_objects: 'allow' },
    });
    expect(install.success, (install as { error?: string }).error).toBe(true);

    const { listActiveSlotComponents, resolveUiComponentModule } = await import(
      '../../../server/services/package-runtime/packageUiRuntime.service'
    );
    const { resolvePackageApiRoute } = await import(
      '../../../server/services/package-runtime/packageApiRuntime.service'
    );

    const active = listActiveSlotComponents();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      packageId: 'builder-ui-api-pack',
      componentKey: 'general/summary-card',
      slotId: 'core.dashboard.widgets',
    });

    expect(resolvePackageApiRoute('GET', '/api/packages/builder-ui-api-pack/health')?.packageId).toBe(
      'builder-ui-api-pack',
    );

    const resolved = resolveUiComponentModule('builder-ui-api-pack', 'general/summary-card');
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const React = await import('react');
    const ReactJSXRuntime = await import('react/jsx-runtime');
    const ReactRouterDOM = await import('react-router-dom');
    const HeroUIReact = await import('@heroui/react');
    globalThis.__APPENDO_PACKAGE_RUNTIME__ = { React, ReactJSXRuntime, ReactRouterDOM, HeroUIReact, AppInternalModules: {} };

    const { compilePackageUiModuleFile } = await import(
      '../../../server/services/package-runtime/packageUiModuleCompile.service'
    );
    const compiled = await compilePackageUiModuleFile(resolved.absPath, fs.statSync(resolved.absPath).mtimeMs);
    expect(compiled).toContain('SummaryCard');
    expect(compiled).toMatch(/export\s*\{[^}]*\bdefault\b[^}]*\}/);
  });
});
