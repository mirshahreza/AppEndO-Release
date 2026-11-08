import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';
import { SHELL_DRAFT_FOLDER } from '../../../../shared/lib/designerShellEntry';
import { draftJsonPath } from '../../../domain/component-designer/draftFolderPaths';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'designer-shell-install-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

describe('designerShellInstall.service', () => {
  it('exports and re-imports a designer shell package round-trip', async () => {
    const { saveDesignerDraft } = await import('../../component-designer/draftCoordinator.service');
    const {
      buildDesignerShellPackageZip,
      seedDesignerShellsFromManifest,
    } = await import('../designerShellInstall.service');

    const state = createInitialDesignerState();
    const saved = saveDesignerDraft({
      name: 'exportable-shell',
      folder: SHELL_DRAFT_FOLDER,
      document: {
        ...state.document,
        name: 'exportable-shell',
      },
      bindingDefinitions: state.bindingDefinitions,
      actor: 'admin',
    });

    const sourcePath = draftJsonPath('exportable-shell', SHELL_DRAFT_FOLDER);
    const sourceRaw = fs.readFileSync(sourcePath, 'utf8');
    const sourceParsed = JSON.parse(sourceRaw) as { document: { rootNodeId: string } };

    const exported = buildDesignerShellPackageZip({
      shellKey: 'exportable-shell',
      packageId: 'shell-pack',
      version: '1.0.0',
      title: 'Exportable Shell',
    });

    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      throw new Error(exported.error);
    }

    expect(fs.existsSync(exported.zipPath)).toBe(true);
    expect(exported.manifest.capabilities.designer_shells?.[0]?.shellKey).toBe('exportable-shell');

    fs.unlinkSync(sourcePath);

    const seeded = seedDesignerShellsFromManifest('shell-pack', '1.0.0', exported.manifest);
    expect(seeded.seeded).toEqual(['exportable-shell']);
    expect(seeded.warnings).toEqual([]);
    expect(fs.existsSync(sourcePath)).toBe(true);

    const importedRaw = fs.readFileSync(sourcePath, 'utf8');
    const importedParsed = JSON.parse(importedRaw) as { document: { rootNodeId: string } };
    expect(importedParsed.document.rootNodeId).toBe(sourceParsed.document.rootNodeId);

    const zip = new AdmZip(exported.zipPath);
    const shellEntry = exported.shellEntry;
    const shellZipPayload = zip.getEntry(shellEntry)?.getData().toString('utf8') ?? '';
    expect(shellZipPayload).toContain('"exportable-shell"');
    expect(saved.id.length).toBeGreaterThan(0);
  });
});
