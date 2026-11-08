export const CHAT_CODE_BLOCK_COLLAPSE_AFTER_LINES = 5;

export type ChatCodeDisplayLine = {
  kind: 'add' | 'remove' | 'plain';
  text: string;
};

export type ChatCodeDisplay = {
  mode: 'diff' | 'code';
  lines: ChatCodeDisplayLine[];
};

const normalize = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\n$/, '');

const looksLikeFullReplacement = (code: string, baseline: string): boolean => {
  if (code === baseline) {
    return false;
  }
  const codeLines = code.split('\n').length;
  const baseLines = baseline.split('\n').length;
  if (/\bfunction handler\b/.test(code) && /\bfunction handler\b/.test(baseline)) {
    return true;
  }
  return codeLines >= 8 && codeLines >= Math.ceil(baseLines * 0.45);
};

const buildChangedOnlyLines = (before: string, after: string): ChatCodeDisplayLine[] => {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  const lines: ChatCodeDisplayLine[] = [];
  for (let index = 0; index < maxLen; index += 1) {
    const beforeLine = beforeLines[index];
    const afterLine = afterLines[index];
    if (beforeLine === afterLine) {
      continue;
    }
    if (beforeLine !== undefined) {
      lines.push({ kind: 'remove', text: beforeLine });
    }
    if (afterLine !== undefined) {
      lines.push({ kind: 'add', text: afterLine });
    }
  }
  return lines;
};

export const resolveChatCodeDisplay = (
  code: string,
  options?: { diffAgainst?: string; diffMode?: 'auto' | 'always' },
): ChatCodeDisplay => {
  const next = normalize(code);
  const baseline = normalize(options?.diffAgainst ?? '');
  const asReplacement = options?.diffMode === 'always'
    || looksLikeFullReplacement(next, baseline)
    || (next === baseline && Boolean(baseline) && (
      /\bfunction handler\b/.test(next) || next.split('\n').length >= 8
    ));

  if (Boolean(baseline) && asReplacement) {
    if (next === baseline) {
      return { mode: 'diff', lines: [] };
    }
    const lines = buildChangedOnlyLines(baseline, next);
    if (lines.length > 0) {
      return { mode: 'diff', lines };
    }
  }

  return {
    mode: 'code',
    lines: next.split('\n').map((text) => ({ kind: 'plain' as const, text })),
  };
};
