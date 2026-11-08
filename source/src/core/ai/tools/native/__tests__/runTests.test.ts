import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPhase1ToolRegistry } from '../../ToolRegistry';
import { getAiCapabilityPack } from '../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerBuiltinCapabilityPacks } from '../../../../../server/services/ai/mcp/builtin';
import {
  RUN_TESTS_TOOL_NAME,
  executeRunTests,
  runTestsTool,
} from '../runTests';

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('node:util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:util')>();
  return {
    ...actual,
    promisify: () => execFileMock,
  };
});

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
  },
  existsSync: vi.fn(() => true),
}));

describe('run_tests tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execFileMock.mockResolvedValue({ stdout: 'Tests  3 passed', stderr: '' });
  });

  it('registers in appendo-standards pack', () => {
    const registry = createPhase1ToolRegistry('agent', ['standards']);
    registerBuiltinCapabilityPacks(registry, ['appendo-standards']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-standards').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
    expect(names).toContain(RUN_TESTS_TOOL_NAME);
  });

  it('runs test:critical by default', async () => {
    const result = await executeRunTests({});
    expect(result.ok).toBe(true);
    expect(execFileMock).toHaveBeenCalled();
    const [executable, args] = execFileMock.mock.calls[0] ?? [];
    expect(String(executable)).toMatch(/npm(\.cmd)?$/);
    expect(args).toEqual(['run', 'test:critical']);
  });

  it('runs vitest subset when testFiles provided', async () => {
    const testFile = 'src/server/services/ai/__tests__/postApplyVerify.service.test.ts';
    const result = await executeRunTests({ testFiles: [testFile] });
    expect(result.ok).toBe(true);
    const [executable, args] = execFileMock.mock.calls[0] ?? [];
    expect(String(executable)).toContain('vitest');
    expect(args).toEqual(['run', testFile]);
  });

  it('rejects invalid test file paths', async () => {
    const result = await executeRunTests({ testFiles: ['../secrets.test.ts'] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_test_files');
    }
  });

  it('reports failed exit codes', async () => {
    execFileMock.mockRejectedValue({
      code: 1,
      stdout: 'FAIL 1 test',
      stderr: '',
    });

    const result = await executeRunTests({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('tests_failed');
      expect(result.data?.exitCode).toBe(1);
    }
  });

  it('exposes tool metadata', () => {
    expect(runTestsTool.name).toBe(RUN_TESTS_TOOL_NAME);
    expect(runTestsTool.group).toBe('standards');
  });
});
