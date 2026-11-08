import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { aiManager } from '../../../../../../core/ai/AiManager';
import { DEFAULT_AI_SETTINGS } from '../../../../../../shared/api/contracts/ai/constants';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeReadMemory,
  executeWriteMemory,
  READ_MEMORY_TOOL_NAME,
  WRITE_MEMORY_TOOL_NAME,
} from '../memoryTools';

vi.mock('../../../../db/aiSettingsStore', () => ({
  getAiSettingsFromFile: vi.fn(() => ({ ...DEFAULT_AI_SETTINGS, projectNotes: 'seed notes' })),
  saveAiSettingsToFile: vi.fn((_path: string, settings: unknown) => settings),
}));

describe('appendo-memory pack', () => {
  let originalCwd = process.cwd();
  let tempDir = '';

  beforeEach(() => {
    aiManager.reloadFromSettings({ ...DEFAULT_AI_SETTINGS, projectNotes: 'seed notes' });
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-memory-pack-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers memory pack tools', () => {
    const registry = createPhase1ToolRegistry('agent', ['memory']);
    registerBuiltinCapabilityPacks(registry, ['appendo-memory']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-memory').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('reads project notes via _project_notes key', async () => {
    const result = await executeReadMemory({ key: '_project_notes' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.value).toBe('seed notes');
    }
  });

  it('writes workspace memory entries', async () => {
    const write = await executeWriteMemory({ key: 'conventions', value: 'Use AppButton.' });
    expect(write.ok).toBe(true);

    const read = await executeReadMemory({ key: 'conventions' });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.data?.value).toBe('Use AppButton.');
    }
  });

  it('exposes catalog tool names', () => {
    expect(READ_MEMORY_TOOL_NAME).toBe('read_memory');
    expect(WRITE_MEMORY_TOOL_NAME).toBe('write_memory');
  });
});
