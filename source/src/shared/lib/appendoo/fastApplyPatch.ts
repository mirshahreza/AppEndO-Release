export type FastApplyBlock = {
  original: string;
  updated: string;
};

export type FastApplyHealMode = 'exact' | 'line_trimmed';

export type FastApplyResult =
  | { ok: true; content: string; blockCount: number; healedBlockCount?: number }
  | { ok: false; error: string };

const FAST_APPLY_BLOCK_PATTERN = /<<<<<<< ORIGINAL\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> UPDATED/g;

export const parseFastApplyBlocks = (patchText: string): FastApplyBlock[] => {
  const blocks: FastApplyBlock[] = [];
  const pattern = new RegExp(FAST_APPLY_BLOCK_PATTERN.source, 'g');
  let match = pattern.exec(patchText);
  while (match) {
    blocks.push({
      original: match[1] ?? '',
      updated: match[2] ?? '',
    });
    match = pattern.exec(patchText);
  }
  return blocks;
};

/**
 * Healing fallback for near-miss snippets (editFileHealing pattern): match the original
 * block line-by-line ignoring trailing whitespace and CR/LF differences. Only applies when
 * the match is UNIQUE in the file — an ambiguous healed match is a wrong-spot risk and is
 * rejected so the model retries with more context instead of us corrupting the file.
 */
const findLineTrimmedMatch = (
  content: string,
  original: string,
): { start: number; end: number } | 'not_found' | 'ambiguous' => {
  const contentLines = content.split('\n');
  const originalLines = original.split('\n').map((line) => line.replace(/\r$/, '').trimEnd());
  while (originalLines.length && originalLines[originalLines.length - 1] === '') originalLines.pop();
  if (!originalLines.length) return 'not_found';

  const normalizedContentLines = contentLines.map((line) => line.replace(/\r$/, '').trimEnd());
  const matches: number[] = [];
  for (let start = 0; start <= normalizedContentLines.length - originalLines.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < originalLines.length; offset += 1) {
      if (normalizedContentLines[start + offset] !== originalLines[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) matches.push(start);
  }

  if (matches.length === 0) return 'not_found';
  if (matches.length > 1) return 'ambiguous';

  const startLine = matches[0]!;
  let charStart = 0;
  for (let line = 0; line < startLine; line += 1) {
    charStart += contentLines[line]!.length + 1;
  }
  let charEnd = charStart;
  for (let line = startLine; line < startLine + originalLines.length; line += 1) {
    charEnd += contentLines[line]!.length + 1;
  }
  // Drop the trailing newline of the last matched line unless it is the file's end.
  if (charEnd > 0 && content[charEnd - 1] === '\n') charEnd -= 1;
  return { start: charStart, end: charEnd };
};

export const applyFastApplyBlocks = (source: string, blocks: FastApplyBlock[]): FastApplyResult => {
  if (!blocks.length) {
    return { ok: false, error: 'No fast-apply blocks found in patch.' };
  }

  let content = source;
  let healedBlockCount = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const position = content.indexOf(block.original);
    if (position >= 0) {
      content = `${content.slice(0, position)}${block.updated}${content.slice(position + block.original.length)}`;
      continue;
    }

    const healed = findLineTrimmedMatch(content, block.original);
    if (healed === 'ambiguous') {
      const preview = block.original.slice(0, 80).replace(/\s+/g, ' ');
      return {
        ok: false,
        error: `Block ${index + 1}: original snippet matches multiple locations after whitespace-tolerant healing — add more surrounding context (starts with "${preview}${block.original.length > 80 ? '…' : ''}").`,
      };
    }
    if (healed === 'not_found') {
      const preview = block.original.slice(0, 80).replace(/\s+/g, ' ');
      return {
        ok: false,
        error: `Block ${index + 1}: original snippet not found in file (starts with "${preview}${block.original.length > 80 ? '…' : ''}").`,
      };
    }

    content = `${content.slice(0, healed.start)}${block.updated}${content.slice(healed.end)}`;
    healedBlockCount += 1;
  }

  return {
    ok: true,
    content,
    blockCount: blocks.length,
    ...(healedBlockCount > 0 ? { healedBlockCount } : {}),
  };
};

export const applyFastApplyPatch = (source: string, patchText: string): FastApplyResult => {
  const blocks = parseFastApplyBlocks(patchText);
  return applyFastApplyBlocks(source, blocks);
};

/** Prefer fast-apply patch when editing an existing file above this line count (C.5). */
export const FAST_APPLY_RECOMMENDED_MIN_LINES = 80;
