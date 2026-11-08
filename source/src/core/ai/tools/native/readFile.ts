import fs from 'fs';
import { resolveAllowlistedPath, resolvePlanModeReadPath } from '../pathAllowlist';
import type { ToolExecutionContext } from '../../agent/types';
import type { NativeToolDefinition } from '../ToolRegistry';

export const READ_FILE_TOOL_NAME = 'read_file';
const DEFAULT_MAX_LINES = 120;
const ABSOLUTE_MAX_LINES = 500;

export const executeReadFile = async (args: Record<string, unknown>, context?: ToolExecutionContext) => {
  const inputPath = typeof args.path === 'string' ? args.path.trim() : '';
  if (!inputPath) {
    return { ok: false as const, summary: 'File path is required.', error: 'missing_path' };
  }

  const resolved = context?.mode === 'plan'
    ? resolvePlanModeReadPath(inputPath)
    : resolveAllowlistedPath(inputPath);  if (resolved.ok === false) {
    return { ok: false as const, summary: resolved.error, error: 'path_not_allowed' };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved.absolutePath);
  } catch {
    return { ok: false as const, summary: `File not found: ${resolved.relativePath}`, error: 'not_found' };
  }

  if (!stat.isFile()) {
    return { ok: false as const, summary: `Path is not a file: ${resolved.relativePath}`, error: 'not_a_file' };
  }

  let content: string;
  try {
    content = fs.readFileSync(resolved.absolutePath, 'utf8');
  } catch {
    return { ok: false as const, summary: `Unable to read file: ${resolved.relativePath}`, error: 'read_failed' };
  }

  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;

  const requestedMaxLines = typeof args.maxLines === 'number' && args.maxLines > 0
    ? Math.min(Math.floor(args.maxLines), ABSOLUTE_MAX_LINES)
    : DEFAULT_MAX_LINES;

  const startLine = typeof args.startLine === 'number' && args.startLine > 0
    ? Math.floor(args.startLine)
    : 1;
  const endLine = typeof args.endLine === 'number' && args.endLine >= startLine
    ? Math.min(Math.floor(args.endLine), totalLines)
    : Math.min(startLine + requestedMaxLines - 1, totalLines);

  const sliceStart = Math.max(1, startLine);
  const sliceEnd = Math.max(sliceStart, endLine);
  const selectedLines = lines.slice(sliceStart - 1, sliceEnd);
  const numberedContent = selectedLines
    .map((line, index) => `${sliceStart + index}|${line}`)
    .join('\n');

  return {
    ok: true as const,
    summary: `Read ${selectedLines.length} line(s) from ${resolved.relativePath} (${totalLines} total).`,
    data: {
      path: resolved.relativePath,
      startLine: sliceStart,
      endLine: sliceEnd,
      totalLines,
      truncated: sliceEnd - sliceStart + 1 >= requestedMaxLines && sliceEnd < totalLines,
      content: numberedContent,
    },
  };
};

export const readFileTool: NativeToolDefinition = {
  name: READ_FILE_TOOL_NAME,
  description: 'Reads an allowlisted source file and returns numbered line content. Use after search_codebase hits to inspect a narrow line range (startLine/endLine). Returns path, line range, totalLines, truncated flag, and content. Example: read_file({ path: "src/server/routes/users.routes.ts", startLine: 42, endLine: 60 }).',
  group: 'read',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Allowlisted relative file path.' },
      startLine: { type: 'number', description: '1-based start line — use with search_codebase hit line numbers.' },
      endLine: { type: 'number', description: '1-based inclusive end line — prefer narrow ranges over full file.' },
      maxLines: { type: 'number', description: 'Max lines when endLine omitted (default 120, max 500).' },
    },
    required: ['path'],
  },
  execute: (args, context) => executeReadFile(args, context),
};