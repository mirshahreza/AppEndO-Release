import { createHash } from 'crypto';
import fs from 'fs';
import { isPlanModeDocumentPath, resolveAllowlistedPath } from '../pathAllowlist';
import type { ToolExecutionContext } from '../../agent/types';
import type { NativeToolDefinition } from '../ToolRegistry';
import { createDraftId, putAgentDraft } from './agentDraftStore';
import {
  applyFastApplyPatch,
  parseFastApplyBlocks,
  FAST_APPLY_RECOMMENDED_MIN_LINES,
} from '../../../../shared/lib/appendoo/fastApplyPatch';
import { computeLineDiffZones } from '../../../../shared/lib/appendoo/diffZones';
import { recordFastApplyOutcome } from '../../../../shared/lib/appendoo/fastApplyOutcomeTelemetry';

export const DRAFT_FILE_PATCH_TOOL_NAME = 'draft_file_patch';

const resolvePatchedContent = (
  path: string,
  beforeContent: string | undefined,
  contentArg: string,
  patchArg: string,
): { ok: true; content: string; patchMode: 'full' | 'fast_apply'; blockCount?: number } | { ok: false; summary: string; error: string } => {
  const content = contentArg.trim();
  const patch = patchArg.trim();

  if (content && patch) {
    return {
      ok: false,
      summary: 'Provide either content (full file) or patch (fast-apply block), not both.',
      error: 'ambiguous_patch_input',
    };
  }

  if (!content && !patch) {
    return {
      ok: false,
      summary: 'File content or a fast-apply patch block is required.',
      error: 'missing_content',
    };
  }

  if (patch) {
    if (beforeContent === undefined) {
      return {
        ok: false,
        summary: 'Fast-apply patch requires an existing file. Use content for new files.',
        error: 'patch_on_new_file',
      };
    }
    const applied = applyFastApplyPatch(beforeContent, patch);
    if (!applied.ok) {
      recordFastApplyOutcome({ path, blockCount: parseFastApplyBlocks(patch).length, failureReason: applied.error });
      return { ok: false, summary: applied.error, error: 'patch_apply_failed' };
    }
    recordFastApplyOutcome({ path, blockCount: applied.blockCount, healedBlockCount: applied.healedBlockCount });
    return {
      ok: true,
      content: applied.content,
      patchMode: 'fast_apply',
      blockCount: applied.blockCount,
    };
  }

  return { ok: true, content: contentArg, patchMode: 'full' };
};

export const executeDraftFilePatch = async (args: Record<string, unknown>, context?: ToolExecutionContext) => {
  const pathArg = typeof args.path === 'string' ? args.path.trim() : '';
  if (!pathArg) {
    return { ok: false as const, summary: 'File path is required.', error: 'missing_path' };
  }

  if (context?.mode === 'plan' && !isPlanModeDocumentPath(pathArg)) {
    return {
      ok: false as const,
      summary: `Plan mode only allows .md files under plans/core/ or plans/packages/ (got "${pathArg}").`,
      error: 'path_not_allowed',
    };
  }

  const resolved = resolveAllowlistedPath(pathArg);
  if (resolved.ok === false) {
    return { ok: false as const, summary: resolved.error, error: 'path_not_allowed' };
  }

  let beforeContent: string | undefined;
  try {
    if (fs.existsSync(resolved.absolutePath) && fs.statSync(resolved.absolutePath).isFile()) {
      beforeContent = fs.readFileSync(resolved.absolutePath, 'utf8');
    }
  } catch {
    beforeContent = undefined;
  }

  const contentArg = typeof args.content === 'string' ? args.content : '';
  const patchArg = typeof args.patch === 'string' ? args.patch : '';
  const resolvedContent = resolvePatchedContent(resolved.relativePath, beforeContent, contentArg, patchArg);
  if (!resolvedContent.ok) {
    return { ok: false as const, summary: resolvedContent.summary, error: resolvedContent.error };
  }

  const { content, patchMode, blockCount } = resolvedContent;
  const beforeLineCount = beforeContent?.split(/\r?\n/).length ?? 0;
  if (
    patchMode === 'full'
    && beforeContent !== undefined
    && beforeLineCount >= FAST_APPLY_RECOMMENDED_MIN_LINES
  ) {
    return {
      ok: false as const,
      summary: `File has ${beforeLineCount} lines — prefer fast-apply patch blocks instead of full content (C.5).`,
      error: 'prefer_fast_apply_patch',
    };
  }

  const beforeHash = beforeContent
    ? createHash('sha256').update(beforeContent).digest('hex').slice(0, 16)
    : undefined;
  const diffZones = beforeContent !== undefined && beforeContent !== content
    ? computeLineDiffZones(beforeContent, content)
    : undefined;

  const draftId = createDraftId();
  const draft = putAgentDraft({
    kind: 'file_patch',
    id: draftId,
    path: resolved.relativePath,
    content,
    beforeContent,
    beforeHash,
    diffZones,
  }) as import('./agentDraftStore').FilePatchDraft;

  const lineCount = content.split(/\r?\n/).length;
  const patchSummary = patchMode === 'fast_apply'
    ? `fast-apply (${blockCount ?? 1} block${(blockCount ?? 1) === 1 ? '' : 's'})`
    : 'full content';

  return {
    ok: true as const,
    summary: `Drafted file patch for ${resolved.relativePath} (${lineCount} lines, ${patchSummary}).`,
    data: {
      draftId: draft.id,
      path: draft.path,
      lineCount,
      isNewFile: beforeContent === undefined,
      patchMode,
      blockCount: blockCount ?? null,
    },
    artifacts: [{ kind: 'draft' as const, id: draft.id, label: draft.path }],
  };
};

const FAST_APPLY_EXAMPLE = [
  '<<<<<<< ORIGINAL',
  '// original code',
  '=======',
  '// replaced code',
  '>>>>>>> UPDATED',
].join('\n');

export const draftFilePatchTool: NativeToolDefinition = {
  name: DRAFT_FILE_PATCH_TOOL_NAME,
  description: 'Creates a draft file patch (no disk write) for an allowlisted path. Prefer fast-apply patch blocks for existing files (especially large ones); use full content only for new/small files. Not for Server Functions — use draft_server_function. Example patch: draft_file_patch({ path: "src/shared/ui/AppButton.tsx", patch: "<ORIGINAL/UPDATED block>" }).',
  group: 'draft',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Allowlisted relative file path' },
      content: { type: 'string', description: 'Full proposed file content — new files or small files only' },
      patch: {
        type: 'string',
        description: `Fast-apply search/replace block(s):\n${FAST_APPLY_EXAMPLE}`,
      },
    },
    required: ['path'],
  },
  execute: (args, context) => executeDraftFilePatch(args, context),
};
