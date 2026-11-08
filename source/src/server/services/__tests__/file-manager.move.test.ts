import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FILE_MANAGER_DESTINATION_EXISTS_ERROR } from '../../../shared/api/contracts/file-manager/types';
import { FILE_MANAGER_WORKSPACE_DIR } from '../../domain/file-manager/pathScope';
import { FileManagerService } from '../file-manager.service';

describe('file-manager moveEntry', () => {
  let tmpDir: string;
  let originalCwd: string;
  let service: FileManagerService;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-file-manager-move-'));
    process.chdir(tmpDir);
    fs.mkdirSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'dest'), { recursive: true });
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'source.txt'), 'source', 'utf8');
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'dest', 'source.txt'), 'old', 'utf8');
    service = new FileManagerService();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns conflict when destination entry exists', async () => {
    const result = await service.moveEntry(
      'workspace/source.txt',
      'workspace/dest',
      'workspace',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe(FILE_MANAGER_DESTINATION_EXISTS_ERROR);
    }
  });

  it('replaces destination entry when overwrite is enabled', async () => {
    const result = await service.moveEntry(
      'workspace/source.txt',
      'workspace/dest',
      'workspace',
      true,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.path).toBe('workspace/dest/source.txt');
      expect(fs.readFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'dest', 'source.txt'), 'utf8')).toBe('source');
      expect(fs.existsSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'source.txt'))).toBe(false);
    }
  });

  it('replaces a nested same-name folder when moving the inner folder up', async () => {
    fs.mkdirSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'outer', 'outer'), { recursive: true });
    fs.writeFileSync(
      path.join(FILE_MANAGER_WORKSPACE_DIR, 'outer', 'outer', 'inside.txt'),
      'inner',
      'utf8',
    );
    fs.writeFileSync(
      path.join(FILE_MANAGER_WORKSPACE_DIR, 'outer', 'outer-only.txt'),
      'outer',
      'utf8',
    );

    const result = await service.moveEntry(
      'workspace/outer/outer',
      'workspace',
      'workspace',
      true,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.path).toBe('workspace/outer');
      expect(fs.readFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'outer', 'inside.txt'), 'utf8')).toBe('inner');
      expect(fs.existsSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'outer', 'outer'))).toBe(false);
      expect(fs.existsSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'outer', 'outer-only.txt'))).toBe(false);
    }
  });
});
