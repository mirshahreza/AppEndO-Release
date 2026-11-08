import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FILE_MANAGER_WORKSPACE_DIR } from '../../domain/file-manager/pathScope';
import { FileManagerService } from '../file-manager.service';

describe('file-manager emptyFolder', () => {
  let tmpDir: string;
  let originalCwd: string;
  let service: FileManagerService;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-file-manager-empty-'));
    process.chdir(tmpDir);
    fs.mkdirSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target', 'a.txt'), 'a', 'utf8');
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target', 'nested', 'b.txt'), 'b', 'utf8');
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target', '.gitkeep'), '', 'utf8');
    service = new FileManagerService();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes all accessible children but keeps the folder', async () => {
    const result = await service.emptyFolder('workspace/target', 'workspace');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.removedEntries).toBe(3);
      expect(fs.existsSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target'))).toBe(true);
      expect(fs.readdirSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target'))).toEqual([]);
    }
  });

  it('returns zero removed entries for an already empty folder', async () => {
    fs.rmSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target', 'a.txt'));
    fs.rmSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target', 'nested'), { recursive: true, force: true });
    fs.rmSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'target', '.gitkeep'));

    const result = await service.emptyFolder('workspace/target', 'workspace');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.removedEntries).toBe(0);
    }
  });

  it('rejects non-directory paths', async () => {
    const result = await service.emptyFolder('workspace/target/a.txt', 'workspace');

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Path is not a directory.',
    });
  });
});
