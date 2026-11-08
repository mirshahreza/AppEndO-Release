import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeReadFile } from '../native/readFile';
import { executeSearchCodebase } from '../native/searchCodebase';
import { executeGlobFiles } from '../native/globFiles';
import { executeListDir } from '../native/listDir';

describe('native read/search tools', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-tools-'));
    process.chdir(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'src/shared/ui'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'workspace/designer/drafts/math'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'plans/core/todo'), { recursive: true });
    const lines = Array.from({ length: 300 }, (_, index) => `line-${index + 1}`);
    lines[42] = 'export const AppTableGrid = () => null;';
    fs.writeFileSync(path.join(tempRoot, 'src/shared/ui/AppTableGrid.tsx'), `${lines.join('\n')}\n`);
    fs.writeFileSync(path.join(tempRoot, 'plans/core/todo/p-00-todo-index.md'), '# Plan\n');
    fs.writeFileSync(
      path.join(tempRoot, 'workspace/designer/drafts/math/sum-two-numbers-calculator.json'),
      '{}\n',
    );
    fs.writeFileSync(path.join(tempRoot, '.env'), 'SECRET=1\n');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('read_file returns numbered line ranges with default cap', async () => {
    const result = await executeReadFile({ path: 'src/shared/ui/AppTableGrid.tsx', startLine: 40, endLine: 45 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.content).toContain('43|export const AppTableGrid');
      expect(result.data?.totalLines).toBeGreaterThanOrEqual(300);
    }
  });

  it('read_file rejects denied paths', async () => {
    const result = await executeReadFile({ path: '.env' });
    expect(result.ok).toBe(false);
  });

  it('glob_files finds allowlisted matches only', async () => {
    const result = await executeGlobFiles({ pattern: '**/AppTableGrid.tsx' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.paths).toEqual(['src/shared/ui/AppTableGrid.tsx']);
    }
  });

  it('glob_files scopes runtime and workspace/designer without allowlist errors', async () => {
    for (const scopePath of ['runtime', 'workspace/designer']) {
      const result = await executeGlobFiles({
        pattern: '**/sum-two-numbers-calculator.json',
        path: scopePath,
      });
      expect(result.ok, scopePath).toBe(true);
      if (result.ok) {
        expect(result.data?.paths).toContain(
          'workspace/designer/drafts/math/sum-two-numbers-calculator.json',
        );
      }
    }
  });

  it('search_codebase finds symbol and hints verify', async () => {
    const result = await executeSearchCodebase({ query: 'AppTableGrid' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.matches?.some((match) => match.path.includes('AppTableGrid.tsx'))).toBe(true);
      expect(result.summary).toContain('read_file');
    }
  });

  it('list_dir lists allowlisted roots when path omitted', async () => {
    const result = await executeListDir({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.entries?.some((entry) => entry.name === 'src/features')).toBe(true);
    }
  });

  it('plan mode read_file only allows plans/core/ and plans/packages/', async () => {
    const allowed = await executeReadFile({ path: 'plans/core/todo/p-00-todo-index.md' }, { mode: 'plan', allowedGroups: ['read'] });
    const denied = await executeReadFile({ path: 'src/shared/ui/AppTableGrid.tsx' }, { mode: 'plan', allowedGroups: ['read'] });
    expect(allowed.ok).toBe(true);
    expect(denied.ok).toBe(false);
  });

  it('plan mode glob_files scopes to plans/core/', async () => {
    const result = await executeGlobFiles({ pattern: '**/*.md' }, { mode: 'plan', allowedGroups: ['search'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.paths).toEqual(['plans/core/todo/p-00-todo-index.md']);
    }
  });
});
