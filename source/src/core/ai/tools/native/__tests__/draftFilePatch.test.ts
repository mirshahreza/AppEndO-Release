import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeDraftFilePatch } from '../draftFilePatch';
import { getAgentDraft } from '../agentDraftStore';

describe('executeDraftFilePatch fast-apply (C.5)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendoo-draft-patch-'));
  const relPath = 'src/shared/lib/__draft_patch_test__.ts';
  const absPath = path.join(process.cwd(), relPath);

  afterEach(() => {
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  });

  it('applies fast-apply patch blocks to an existing file', async () => {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, 'export const value = 1;\n', 'utf8');

    const patch = [
      '<<<<<<< ORIGINAL',
      'export const value = 1;',
      '=======',
      'export const value = 2;',
      '>>>>>>> UPDATED',
    ].join('\n');

    const result = await executeDraftFilePatch({ path: relPath, patch });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.patchMode).toBe('fast_apply');
      expect(result.data?.blockCount).toBe(1);
      const draft = getAgentDraft(String(result.data?.draftId));
      expect(draft?.kind).toBe('file_patch');
      if (draft?.kind === 'file_patch') {
        expect(draft.diffZones).toEqual([{ startLine: 1, endLine: 1 }]);
      }
    }
  });

  it('rejects full content for large existing files', async () => {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    const lines = Array.from({ length: 90 }, (_, index) => `const line${index} = ${index};`).join('\n');
    fs.writeFileSync(absPath, `${lines}\n`, 'utf8');

    const result = await executeDraftFilePatch({
      path: relPath,
      content: `${lines}\nconst extra = true;\n`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('prefer_fast_apply_patch');
    }
  });
});
