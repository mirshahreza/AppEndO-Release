import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import {
  GIT_BLAME_TOOL_NAME,
  GIT_DIFF_TOOL_NAME,
  GIT_LOG_TOOL_NAME,
  GIT_SHOW_TOOL_NAME,
  GIT_STATUS_TOOL_NAME,
} from '../../../../../../core/ai/tools/native/git/gitTools';
import {
  GIT_BRANCH_TOOL_NAME,
  GIT_CHECKOUT_TOOL_NAME,
  GIT_COMMIT_TOOL_NAME,
} from '../../../../../../core/ai/tools/native/git/gitWriteTools';
import { buildChangeSetsFromDrafts } from '../../../../../../core/ai/validation/changeSetBuilder';
import { clearAgentDrafts } from '../../../../../../core/ai/tools/native/agentDraftStore';
import { applyGitOperationChangeSet, rollbackGitOperationSnapshot } from '../../../gitOperationApply';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerBuiltinCapabilityPacks } from '../index';

const runGit = (cwd: string, args: string[]) => {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
};

const toolTextOutput = (data: unknown): string =>
  typeof data === 'object' && data !== null && 'output' in data && typeof (data as { output: unknown }).output === 'string'
    ? (data as { output: string }).output
    : '';

describe('appendo-git pack', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-git-pack-'));
    process.chdir(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'src/shared/ui'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, 'src/shared/ui/AppTableGrid.tsx'),
      'export const AppTableGrid = () => null;\n',
    );
    fs.writeFileSync(path.join(tempRoot, '.env'), 'SECRET=1\n');

    runGit(tempRoot, ['init']);
    runGit(tempRoot, ['config', 'user.email', 'test@appendo.local']);
    runGit(tempRoot, ['config', 'user.name', 'AppEndO Test']);
    runGit(tempRoot, ['add', 'src/shared/ui/AppTableGrid.tsx']);
    runGit(tempRoot, ['commit', '-m', 'Add AppTableGrid']);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('registers git pack tools when appendo-git is enabled', () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-git').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('git_status reports clean tree after initial commit', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const result = await registry.execute(GIT_STATUS_TOOL_NAME, {}, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toolTextOutput(result.data)).toContain('branch');
    }
  });

  it('git_log returns the initial commit', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const result = await registry.execute(GIT_LOG_TOOL_NAME, { maxCount: 5 }, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toolTextOutput(result.data)).toContain('Add AppTableGrid');
    }
  });

  it('git_show displays commit metadata', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const result = await registry.execute(GIT_SHOW_TOOL_NAME, { ref: 'HEAD' }, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toolTextOutput(result.data)).toContain('Add AppTableGrid');
    }
  });

  it('git_diff reports unstaged changes', async () => {
    fs.appendFileSync(
      path.join(tempRoot, 'src/shared/ui/AppTableGrid.tsx'),
      '\nexport const updated = true;\n',
    );

    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const result = await registry.execute(
      GIT_DIFF_TOOL_NAME,
      { path: 'src/shared/ui/AppTableGrid.tsx' },
      {},
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toolTextOutput(result.data)).toContain('updated');
    }
  });

  it('git_blame returns line attribution', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const result = await registry.execute(
      GIT_BLAME_TOOL_NAME,
      { path: 'src/shared/ui/AppTableGrid.tsx' },
      {},
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toolTextOutput(result.data)).toContain('AppTableGrid');
    }
  });

  it('rejects denied secret paths', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const result = await registry.execute(GIT_BLAME_TOOL_NAME, { path: '.env' }, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('path_not_allowed');
    }
  });

  it('fails when workspace is not a git repository', async () => {
    const nonGitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-nogit-'));
    process.chdir(nonGitRoot);

    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const result = await registry.execute(GIT_STATUS_TOOL_NAME, {}, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_a_git_repo');
    }

    process.chdir(tempRoot);
    fs.rmSync(nonGitRoot, { recursive: true, force: true });
  });

  it('registers git write tools with confirm-gated drafts', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    expect(getAiCapabilityPack('appendo-git').hasWriteTools).toBe(true);

    clearAgentDrafts();
    const commitResult = await registry.execute(
      GIT_COMMIT_TOOL_NAME,
      { message: 'Update grid', paths: ['src/shared/ui/AppTableGrid.tsx'] },
      {},
    );
    expect(commitResult.ok).toBe(true);

    const changeSets = buildChangeSetsFromDrafts();
    expect(changeSets).toHaveLength(1);
    expect(changeSets[0]).toMatchObject({
      kind: 'git_operation',
      operation: 'commit',
      message: 'Update grid',
    });
  });

  it('git_branch creates and checks out a branch on apply with rollback', async () => {
    clearAgentDrafts();
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const draftResult = await registry.execute(
      GIT_BRANCH_TOOL_NAME,
      { branchName: 'feature/test-branch' },
      {},
    );
    expect(draftResult.ok).toBe(true);

    const [changeSet] = buildChangeSetsFromDrafts();
    expect(changeSet.kind).toBe('git_operation');

    const applied = await applyGitOperationChangeSet(changeSet as Extract<typeof changeSet, { kind: 'git_operation' }>);
    expect(applied.target).toBe('branch:feature/test-branch');

    const statusOnBranch = await registry.execute(GIT_STATUS_TOOL_NAME, {}, {});
    expect(statusOnBranch.ok).toBe(true);
    if (statusOnBranch.ok) {
      expect(statusOnBranch.data?.output).toContain('feature/test-branch');
    }

    await rollbackGitOperationSnapshot(applied.before, applied.target);

    const statusAfterRollback = await registry.execute(GIT_STATUS_TOOL_NAME, {}, {});
    expect(statusAfterRollback.ok).toBe(true);
    if (statusAfterRollback.ok) {
      expect(statusAfterRollback.data?.output).not.toContain('feature/test-branch');
    }
  });

  it('git_checkout drafts valid targets only', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const invalid = await registry.execute(GIT_CHECKOUT_TOOL_NAME, { target: 'bad ref' }, {});
    expect(invalid.ok).toBe(false);

    const valid = await registry.execute(GIT_CHECKOUT_TOOL_NAME, { target: 'HEAD' }, {});
    expect(valid.ok).toBe(true);
  });

  it('blocks git write tools in plan mode', () => {
    const registry = createPhase1ToolRegistry('plan', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-git']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    expect(names).not.toContain(GIT_COMMIT_TOOL_NAME);
    expect(names).not.toContain(GIT_CHECKOUT_TOOL_NAME);
    expect(names).not.toContain(GIT_BRANCH_TOOL_NAME);
  });
});
