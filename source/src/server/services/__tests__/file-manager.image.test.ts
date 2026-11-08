import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FILE_MANAGER_WORKSPACE_DIR } from '../../domain/file-manager/pathScope';
import { FileManagerService } from '../file-manager.service';

describe('file-manager replaceImageFile', () => {
  let tmpDir: string;
  let originalCwd: string;
  let service: FileManagerService;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-file-manager-image-'));
    process.chdir(tmpDir);
    fs.mkdirSync(FILE_MANAGER_WORKSPACE_DIR, { recursive: true });
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'notes.txt'), 'hello', 'utf8');
    service = new FileManagerService();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('replaces an existing image file', async () => {
    const nextBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

    const result = await service.replaceImageFile('workspace/photo.png', nextBuffer, 'workspace');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.path).toBe('workspace/photo.png');
      expect(result.body.sizeBytes).toBe(nextBuffer.length);
    }

    const saved = fs.readFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'photo.png'));
    expect(saved.equals(nextBuffer)).toBe(true);
  });

  it('rejects non-image paths', async () => {
    const result = await service.replaceImageFile('workspace/notes.txt', Buffer.from('x'), 'workspace');

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ status: 400, error: expect.stringContaining('image') });
  });
});
