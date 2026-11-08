import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FILE_MANAGER_WORKSPACE_DIR,
  getFileManagerBasename,
  isFileManagerPathInsideDirectory,
  isFileManagerHiddenEntryName,
  isFileManagerTextPath,
  isFileManagerZipPath,
  resolveFileManagerParentPath,
  resolveFileManagerPath,
  sanitizeFileManagerEntryName,
  validateZipEntryExtractPath,
} from '../pathScope';

describe('file-manager pathScope', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-file-manager-'));
    process.chdir(tmpDir);
    fs.mkdirSync(FILE_MANAGER_WORKSPACE_DIR, { recursive: true });
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'notes.txt'), 'hello', 'utf8');
    fs.writeFileSync('package.json', '{}', 'utf8');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('defaults workspace scope to the workspace folder', () => {
    const resolved = resolveFileManagerPath('', 'workspace');
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.relativePath).toBe(FILE_MANAGER_WORKSPACE_DIR);
    }
  });

  it('blocks workspace scope outside workspace/', () => {
    const resolved = resolveFileManagerPath('package.json', 'workspace');
    expect(resolved.ok).toBe(false);
  });

  it('allows project scope for repository files', () => {
    const resolved = resolveFileManagerPath('package.json', 'project');
    expect(resolved.ok).toBe(true);
  });

  it('blocks denied paths in project scope', () => {
    fs.writeFileSync('.env', 'SECRET=1', 'utf8');
    const resolved = resolveFileManagerPath('.env', 'project');
    expect(resolved.ok).toBe(false);
  });

  it('blocks additional sensitive root files (SEC-2-2)', () => {
    expect(resolveFileManagerPath('settings.install.json', 'project').ok).toBe(false);
    expect(resolveFileManagerPath('settings.json.install-backup', 'project').ok).toBe(false);
    expect(resolveFileManagerPath('cookies.txt', 'project').ok).toBe(false);
    expect(resolveFileManagerPath('logs/app.log', 'project').ok).toBe(false);
    expect(resolveFileManagerPath('control-plane.db', 'project').ok).toBe(false);
    expect(resolveFileManagerPath('.appendo-git-credentials.json', 'project').ok).toBe(false);
    expect(resolveFileManagerPath('tls/server.pem', 'project').ok).toBe(false);
    expect(resolveFileManagerPath('certs/app.key', 'project').ok).toBe(false);
  });

  it('rejects invalid entry names', () => {
    expect(sanitizeFileManagerEntryName('../escape')).toBeNull();
    expect(sanitizeFileManagerEntryName('valid-name.txt')).toBe('valid-name.txt');
  });

  it('detects zip archives', () => {
    expect(isFileManagerZipPath('workspace/archive.zip')).toBe(true);
    expect(isFileManagerZipPath('workspace/readme.txt')).toBe(false);
  });

  it('rejects zip slip entries', () => {
    const result = validateZipEntryExtractPath(
      path.join(tmpDir, 'workspace', 'out'),
      '../escape.txt',
      'workspace',
    );
    expect(result.ok).toBe(false);
  });

  it('treats dotfiles without extensions as text', () => {
    expect(isFileManagerTextPath('workspace/.gitkeep')).toBe(true);
    expect(isFileManagerTextPath('workspace/.gitignore')).toBe(true);
    expect(getFileManagerBasename('workspace/.gitkeep')).toBe('.gitkeep');
  });

  it('hides .gitkeep from tree listings', () => {
    expect(isFileManagerHiddenEntryName('.gitkeep')).toBe(true);
    expect(isFileManagerHiddenEntryName('.gitignore')).toBe(false);
  });

  it('detects descendant paths for move validation', () => {
    expect(isFileManagerPathInsideDirectory('workspace/docs', 'workspace/docs/readme.md')).toBe(true);
    expect(isFileManagerPathInsideDirectory('workspace/docs', 'workspace/assets')).toBe(false);
  });

  it('resolves parent paths for workspace scope', () => {
    expect(resolveFileManagerParentPath('workspace/docs/readme.md', 'workspace')).toBe('workspace/docs');
    expect(resolveFileManagerParentPath('workspace/readme.md', 'workspace')).toBe('workspace');
  });
});
