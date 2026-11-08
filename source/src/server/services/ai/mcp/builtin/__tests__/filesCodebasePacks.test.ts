import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { DRAFT_FILE_PATCH_TOOL_NAME } from '../../../../../../core/ai/tools/native/draftFilePatch';
import { GLOB_FILES_TOOL_NAME } from '../../../../../../core/ai/tools/native/globFiles';
import { LIST_DIR_TOOL_NAME } from '../../../../../../core/ai/tools/native/listDir';
import { READ_FILE_TOOL_NAME } from '../../../../../../core/ai/tools/native/readFile';
import { SEARCH_CODEBASE_TOOL_NAME } from '../../../../../../core/ai/tools/native/searchCodebase';
import { GET_FEATURE_GRAPH_TOOL_NAME } from '../../../../../../core/ai/tools/native/getFeatureGraph';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerBuiltinCapabilityPacks } from '../index';

const toolNames = (registry: ReturnType<typeof createPhase1ToolRegistry>) =>
  registry.listDefinitions().map((tool) => tool.name);

describe('appendo-files + appendo-codebase packs', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-packs-'));
    process.chdir(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'src/shared/ui'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, 'src/shared/ui/AppTableGrid.tsx'),
      'export const AppTableGrid = () => null;\n',
    );
    fs.writeFileSync(path.join(tempRoot, '.env'), 'SECRET=1\n');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('registers files pack tools when appendo-files is enabled', () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'write', 'search', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-files']);

    const names = toolNames(registry);
    const filesTools = getAiCapabilityPack('appendo-files').toolNames;
    filesTools.forEach((name) => expect(names).toContain(name));
    expect(names).not.toContain(SEARCH_CODEBASE_TOOL_NAME);
  });

  it('registers codebase pack tool when appendo-codebase is enabled', () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'write', 'search', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-codebase']);

    const names = toolNames(registry);
    expect(names).toContain(SEARCH_CODEBASE_TOOL_NAME);
    expect(names).toContain(GET_FEATURE_GRAPH_TOOL_NAME);
    expect(names).not.toContain(READ_FILE_TOOL_NAME);
    expect(names).not.toContain(GLOB_FILES_TOOL_NAME);
    expect(names).not.toContain(LIST_DIR_TOOL_NAME);
    expect(names).not.toContain(DRAFT_FILE_PATCH_TOOL_NAME);
  });

  it('read_file rejects denied secret paths via pack-registered tool', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'write', 'search', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-files']);

    const result = await registry.execute(READ_FILE_TOOL_NAME, { path: '.env' }, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('path_not_allowed');
    }
  });

  it('glob_files finds allowlisted matches via pack-registered tool', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'write', 'search', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-files']);

    const result = await registry.execute(GLOB_FILES_TOOL_NAME, { pattern: '**/AppTableGrid.tsx' }, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.paths).toEqual(['src/shared/ui/AppTableGrid.tsx']);
    }
  });

  it('search_codebase finds symbols via pack-registered tool', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'write', 'search', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-codebase']);

    const result = await registry.execute(SEARCH_CODEBASE_TOOL_NAME, { query: 'AppTableGrid' }, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.matches?.some((match: { path: string }) => match.path.includes('AppTableGrid.tsx'))).toBe(
        true,
      );
    }
  });
});
