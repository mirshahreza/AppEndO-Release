import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  expandAgentScopeRoots,
  isAgentSearchExcludedPath,
  isAllowlistedPath,
  isDeniedPath,
  isPlanModeDocumentPath,
  isPlanModeReadablePath,
  matchGlobPattern,
  normalizeRelativePath,
  resolveAllowlistedPath,
} from '../pathAllowlist';

describe('pathAllowlist', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-agent-'));
    process.chdir(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'src/features/demo'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/server/services'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/domain/users'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/components/ui'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'workspace/server-functions/custom'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'workspace/designer/drafts/math'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'src/features/demo/App.tsx'), 'export const Demo = true;\n');
    fs.writeFileSync(path.join(tempRoot, 'src/server/services/example.ts'), 'export const svc = true;\n');
    fs.writeFileSync(path.join(tempRoot, 'src/domain/users/model.ts'), 'export type User = { id: string };\n');
    fs.writeFileSync(path.join(tempRoot, 'src/components/ui/Button.tsx'), 'export const Button = () => null;\n');
    fs.writeFileSync(path.join(tempRoot, 'workspace/server-functions/custom/handler.ts'), 'export {};\n');
    fs.writeFileSync(path.join(tempRoot, 'workspace/designer/drafts/math/sum-two-numbers-calculator.json'), '{}\n');
    fs.writeFileSync(path.join(tempRoot, 'AGENTS.md'), '# Agents\n');
    fs.writeFileSync(path.join(tempRoot, '.env'), 'SECRET=1\n');
    fs.writeFileSync(path.join(tempRoot, 'settings.json'), '{}\n');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('allows allowlisted paths and denies secrets', () => {
    expect(isAllowlistedPath('src/features/demo/App.tsx')).toBe(true);
    expect(isAllowlistedPath('src/server/services/example.ts')).toBe(true);
    expect(isAllowlistedPath('src/domain/users/model.ts')).toBe(true);
    expect(isAllowlistedPath('src/components/ui/Button.tsx')).toBe(true);
    expect(isAllowlistedPath('workspace/server-functions/custom/handler.ts')).toBe(true);
    expect(isAllowlistedPath('workspace/designer/drafts/math/sum-two-numbers-calculator.json')).toBe(true);
    expect(isAllowlistedPath('runtime')).toBe(true);
    expect(isAllowlistedPath('workspace')).toBe(true);
    expect(expandAgentScopeRoots('workspace')).toEqual([
      'workspace/server-functions',
      'workspace/designer',
      'workspace/platform-registry',
    ]);
    expect(expandAgentScopeRoots('runtime')).toEqual([
      'workspace/server-functions',
      'workspace/designer',
      'workspace/platform-registry',
    ]);
    expect(isAllowlistedPath('AGENTS.md')).toBe(true);
    expect(isAllowlistedPath('.env')).toBe(false);
    expect(isAllowlistedPath('settings.json')).toBe(false);
    expect(isDeniedPath('node_modules/pkg/index.js')).toBe(true);
  });

  it('resolves allowlisted files to absolute paths', () => {
    const resolved = resolveAllowlistedPath('src/features/demo/App.tsx');
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(fs.existsSync(resolved.absolutePath)).toBe(true);
      expect(resolved.relativePath).toBe('src/features/demo/App.tsx');
    }
  });

  it('rejects parent traversal and absolute paths', () => {
    expect(resolveAllowlistedPath('../settings.json').ok).toBe(false);
    expect(resolveAllowlistedPath('/etc/passwd').ok).toBe(false);
    expect(normalizeRelativePath('.\\src\\features\\demo\\App.tsx')).toBe('src/features/demo/App.tsx');
  });

  it('matches glob patterns', () => {
    expect(matchGlobPattern('**/App.tsx', 'src/features/demo/App.tsx')).toBe(true);
    expect(matchGlobPattern('src/shared/*.ts', 'src/features/demo/App.tsx')).toBe(false);
  });

  it('excludes test files from agent search by default', () => {
    expect(isAgentSearchExcludedPath('src/features/demo/__tests__/Demo.test.tsx')).toBe(true);
    expect(isAgentSearchExcludedPath('src/features/demo/App.test.ts')).toBe(true);
    expect(isAgentSearchExcludedPath('src/features/demo/App.tsx')).toBe(false);
  });

  it('identifies plan mode document paths', () => {
    expect(isPlanModeDocumentPath('plans/core/todo/p-00-todo-index.md')).toBe(true);
    expect(isPlanModeDocumentPath('plans/core/next/p-42-marketplace.md')).toBe(true);
    expect(isPlanModeDocumentPath('plans/packages/todo/p-00-packages-index.md')).toBe(true);
    expect(isPlanModeDocumentPath('plans/core/todo/p-52-install-wizard-mysql-sqlite.md')).toBe(true);
    expect(isPlanModeDocumentPath('plans/core/todo/readme.txt')).toBe(false);
    expect(isPlanModeDocumentPath('src/features/plan.md')).toBe(false);
  });

  it('identifies plan mode readable paths', () => {
    expect(isPlanModeReadablePath('plans/core/todo')).toBe(true);
    expect(isPlanModeReadablePath('plans/core/next')).toBe(true);
    expect(isPlanModeReadablePath('plans/packages')).toBe(true);
    expect(isPlanModeReadablePath('plans/core/todo/p-19-git-native-unification.md')).toBe(true);
    expect(isPlanModeReadablePath('plans/core/next/p-42-marketplace.md')).toBe(true);
    expect(isPlanModeReadablePath('src/features/plan.md')).toBe(false);
  });
});
