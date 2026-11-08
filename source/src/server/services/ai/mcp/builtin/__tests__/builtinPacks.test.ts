import { describe, expect, it, vi } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { GET_PROJECT_STANDARDS_TOOL_NAME } from '../../../../../../core/ai/tools/native/getProjectStandards';
import { READ_FILE_TOOL_NAME } from '../../../../../../core/ai/tools/native/readFile';
import { SEARCH_CODEBASE_TOOL_NAME } from '../../../../../../core/ai/tools/native/searchCodebase';
import { DEFAULT_ENABLED_CAPABILITY_PACK_IDS } from '../../../../../../shared/api/contracts/ai/capabilityPacks';

const packMocks = vi.hoisted(() => ({
  registerFilesPackTools: vi.fn(),
  registerGitPackTools: vi.fn(),
  registerCodebasePackTools: vi.fn(),
}));

vi.mock('../filesPack', () => ({
  registerFilesPackTools: packMocks.registerFilesPackTools,
}));

vi.mock('../gitPack', () => ({
  registerGitPackTools: packMocks.registerGitPackTools,
}));

vi.mock('../codebasePack', () => ({
  registerCodebasePackTools: packMocks.registerCodebasePackTools,
}));

vi.mock('../httpPack', () => ({ registerHttpPackTools: vi.fn() }));
vi.mock('../webPack', () => ({ registerWebPackTools: vi.fn() }));
vi.mock('../standardsPack', () => ({ registerStandardsPackTools: vi.fn() }));
vi.mock('../contextPack', () => ({ registerContextPackTools: vi.fn() }));
vi.mock('../designerPack', () => ({ registerDesignerPackTools: vi.fn() }));
vi.mock('../dataPack', () => ({ registerDataPackTools: vi.fn() }));
vi.mock('../openapiPack', () => ({ registerOpenApiPackTools: vi.fn() }));

import {
  registerBuiltinCapabilityPacks,
  resolveEnabledCapabilityPackIds,
} from '../index';

describe('resolveEnabledCapabilityPackIds', () => {
  it('falls back to default session packs when scope is empty or missing', () => {
    expect(resolveEnabledCapabilityPackIds()).toEqual([...DEFAULT_ENABLED_CAPABILITY_PACK_IDS]);
    expect(resolveEnabledCapabilityPackIds([])).toEqual([...DEFAULT_ENABLED_CAPABILITY_PACK_IDS]);
  });

  it('returns explicit enabled pack ids', () => {
    expect(resolveEnabledCapabilityPackIds(['appendo-git', 'appendo-web'])).toEqual([
      'appendo-git',
      'appendo-web',
    ]);
  });
});

describe('registerBuiltinCapabilityPacks', () => {
  it('invokes only enabled pack registrars', () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'write', 'search', 'standards', 'context', 'draft']);

    registerBuiltinCapabilityPacks(registry, ['appendo-files']);

    expect(packMocks.registerFilesPackTools).toHaveBeenCalledOnce();
    expect(packMocks.registerGitPackTools).not.toHaveBeenCalled();
  });

  it('registers tools only from enabled packs when registrars wire native tools', () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'write', 'search', 'standards', 'context', 'draft']);

    packMocks.registerFilesPackTools.mockImplementation((target) => {
      target.register({
        name: READ_FILE_TOOL_NAME,
        description: 'test read',
        group: 'read',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ ok: true, summary: 'ok' }),
      });
    });
    packMocks.registerCodebasePackTools.mockImplementation((target) => {
      target.register({
        name: SEARCH_CODEBASE_TOOL_NAME,
        description: 'test search',
        group: 'search',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ ok: true, summary: 'ok' }),
      });
    });

    registerBuiltinCapabilityPacks(registry, ['appendo-files']);

    const toolNames = registry.listDefinitions().map((tool) => tool.name);
    expect(toolNames).toContain(READ_FILE_TOOL_NAME);
    expect(toolNames).not.toContain(SEARCH_CODEBASE_TOOL_NAME);
    expect(toolNames).not.toContain(GET_PROJECT_STANDARDS_TOOL_NAME);
  });
});
