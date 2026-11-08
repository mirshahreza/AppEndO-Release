import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { NativeToolDefinition } from '../ToolRegistry';
import { getRepoRoot } from '../pathAllowlist';

const execFileAsync = promisify(execFile);

export const RUN_TESTS_TOOL_NAME = 'run_tests';
export const RUN_TESTS_TIMEOUT_MS = 300_000;
export const RUN_TESTS_MAX_OUTPUT_BYTES = 256_000;

const TEST_FILE_PATTERN = /^src\/.*\.test\.tsx?$/;

const truncateTestOutput = (output: string): { text: string; truncated: boolean } => {
  if (Buffer.byteLength(output, 'utf8') <= RUN_TESTS_MAX_OUTPUT_BYTES) {
    return { text: output, truncated: false };
  }

  let truncated = output;
  while (truncated.length > 0 && Buffer.byteLength(truncated, 'utf8') > RUN_TESTS_MAX_OUTPUT_BYTES) {
    truncated = truncated.slice(0, Math.floor(truncated.length * 0.9));
  }

  return { text: `${truncated}\n… [output truncated]`, truncated: true };
};

const validateTestFilePath = (filePath: string): string | null => {
  const normalized = filePath.replace(/\\/g, '/').trim();
  if (!normalized || normalized.includes('..') || !TEST_FILE_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const resolveVitestExecutable = (repoRoot: string): string => {
  const binaryName = process.platform === 'win32' ? 'vitest.cmd' : 'vitest';
  return path.join(repoRoot, 'node_modules', '.bin', binaryName);
};

const parseTestFiles = (raw: unknown): { ok: true; files: string[] } | { ok: false; error: string } => {
  if (raw === undefined) {
    return { ok: true, files: [] };
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'testFiles must be a non-empty array when provided.' };
  }

  const files: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      return { ok: false, error: 'Each testFiles entry must be a string path under src/.' };
    }
    const validated = validateTestFilePath(entry);
    if (!validated) {
      return { ok: false, error: `Invalid test file path "${entry}". Use src/**/*.test.ts(x) only.` };
    }
    files.push(validated);
  }

  return { ok: true, files: [...new Set(files)] };
};

export const executeRunTests = async (args: Record<string, unknown>) => {
  const suite = typeof args.suite === 'string' ? args.suite.trim().toLowerCase() : 'critical';
  if (suite !== 'critical') {
    return {
      ok: false as const,
      summary: `Unsupported suite "${suite}". Only "critical" is available in v1.`,
      error: 'unsupported_suite',
    };
  }

  const parsedFiles = parseTestFiles(args.testFiles);
  if (!parsedFiles.ok) {
    return {
      ok: false as const,
      summary: parsedFiles.error,
      error: 'invalid_test_files',
    };
  }

  const repoRoot = getRepoRoot();
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return {
      ok: false as const,
      summary: 'Workspace package.json was not found.',
      error: 'missing_package_json',
    };
  }

  const vitestExecutable = resolveVitestExecutable(repoRoot);
  if (!fs.existsSync(vitestExecutable)) {
    return {
      ok: false as const,
      summary: 'Vitest binary was not found. Install dependencies before running tests.',
      error: 'missing_vitest',
    };
  }

  const commandArgs = parsedFiles.files.length > 0
    ? ['run', ...parsedFiles.files]
    : ['run', 'test:critical'];

  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmArgs = parsedFiles.files.length > 0
    ? null
    : ['run', 'test:critical'];

  try {
    const { stdout, stderr } = parsedFiles.files.length > 0
      ? await execFileAsync(vitestExecutable, commandArgs, {
        cwd: repoRoot,
        timeout: RUN_TESTS_TIMEOUT_MS,
        maxBuffer: RUN_TESTS_MAX_OUTPUT_BYTES + 64_000,
        encoding: 'utf8',
        windowsHide: true,
      })
      : await execFileAsync(npmExecutable, npmArgs!, {
        cwd: repoRoot,
        timeout: RUN_TESTS_TIMEOUT_MS,
        maxBuffer: RUN_TESTS_MAX_OUTPUT_BYTES + 64_000,
        encoding: 'utf8',
        windowsHide: true,
      });

    const truncatedStdout = truncateTestOutput(stdout);
    const truncatedStderr = truncateTestOutput(stderr);
    const combined = [truncatedStdout.text, truncatedStderr.text].filter(Boolean).join('\n').trim();

    return {
      ok: true as const,
      summary: parsedFiles.files.length > 0
        ? `Vitest subset passed (${parsedFiles.files.length} file${parsedFiles.files.length === 1 ? '' : 's'}).`
        : 'test:critical passed on live runtime.',
      data: {
        suite,
        testFiles: parsedFiles.files.length > 0 ? parsedFiles.files : undefined,
        exitCode: 0,
        output: combined || '(no output)',
        truncated: truncatedStdout.truncated || truncatedStderr.truncated,
      },
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        code?: number | string;
        killed?: boolean;
        signal?: string;
      };

      const truncatedStdout = truncateTestOutput(execError.stdout ?? '');
      const truncatedStderr = truncateTestOutput(execError.stderr ?? '');
      const combined = [truncatedStdout.text, truncatedStderr.text].filter(Boolean).join('\n').trim();
      const exitCode = typeof execError.code === 'number' ? execError.code : 1;

      if (execError.killed || execError.signal) {
        return {
          ok: false as const,
          summary: 'Test run timed out or was interrupted.',
          error: 'test_timeout',
          data: {
            suite,
            testFiles: parsedFiles.files.length > 0 ? parsedFiles.files : undefined,
            exitCode,
            output: combined || '(no output)',
            truncated: truncatedStdout.truncated || truncatedStderr.truncated,
          },
        };
      }

      return {
        ok: false as const,
        summary: parsedFiles.files.length > 0
          ? `Vitest subset failed (exit ${exitCode}).`
          : `test:critical failed (exit ${exitCode}).`,
        error: 'tests_failed',
        data: {
          suite,
          testFiles: parsedFiles.files.length > 0 ? parsedFiles.files : undefined,
          exitCode,
          output: combined || '(no output)',
          truncated: truncatedStdout.truncated || truncatedStderr.truncated,
        },
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      summary: `Test run failed: ${message}`,
      error: 'execution_failed',
    };
  }
};

export const runTestsTool: NativeToolDefinition = {
  name: RUN_TESTS_TOOL_NAME,
  description: 'Runs Vitest on the live AppEndO runtime (default suite: npm run test:critical). Use after draft apply to verify regressions. Optional testFiles limits to specific paths under src/. Returns exit code, pass/fail counts, and truncated output.',
  group: 'standards',
  parameters: {
    type: 'object',
    properties: {
      suite: {
        type: 'string',
        description: 'Test suite name. v1 supports "critical" only (default).',
      },
      testFiles: {
        type: 'string',
        description: 'Optional vitest file paths under src/ (e.g. src/server/services/ai/__tests__/postApplyVerify.service.test.ts).',
      },
    },
  },
  execute: async (args) => executeRunTests(args),
};
